"""Оркестратор: веб-скрапинг → нормализация → БД."""
import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal
from app.models.models import Clinic, ParsedPriceRow, Service, ParserLog
from app.normalizer.ingestion import RawPriceRow, ingest_price_list, parse_price
from app.normalizer.matcher import MatchResult, ServiceMatcher
from scrapers import ALL_SCRAPERS
from scrapers.base import ScrapeResult
from scrapers.document_pipeline import augment_all_scrapers_with_documents, reset_session_cache
from app.services.address_enrich import enrich_clinic_meta
from scrapers.validate import filter_scraped_items, is_valid_price, is_valid_service_name, normalize_name

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

SCRAPE_LOG_PATH = Path(__file__).resolve().parent / "logs" / "scrape_runs.jsonl"


def write_scrape_audit(results: list[dict], started_at: datetime, finished_at: datetime) -> None:
    """Append one machine-readable scrape run summary for audit and demo review."""
    SCRAPE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_sec": round((finished_at - started_at).total_seconds(), 2),
        "sources_total": len(results),
        "sources_failed": sum(1 for row in results if row.get("errors")),
        "items_scraped": sum(int(row.get("scraped", 0)) for row in results),
        "items_ingested": sum(int(row.get("ingested", 0)) for row in results),
        "results": results,
    }
    with SCRAPE_LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, ensure_ascii=False, default=str) + "\n")


async def get_or_create_clinic(db, meta: dict) -> Clinic:
    meta = enrich_clinic_meta(dict(meta))
    clinic = None
    source_id = meta.get("source_id")
    # Match primarily by source_id (most reliable unique key from scrapers)
    if source_id:
        res = await db.execute(
            select(Clinic).where(Clinic.source_id == source_id)
        )
        clinic = res.scalars().first()
    # Fallback: match by name + city (use first() in case of duplicates)
    if clinic is None:
        res = await db.execute(
            select(Clinic).where(Clinic.name == meta["name"], Clinic.city == meta["city"])
        )
        clinic = res.scalars().first()
    if clinic:
        for key, val in meta.items():
            if val is not None and hasattr(clinic, key):
                setattr(clinic, key, val)
        return clinic
    clinic = Clinic(
        name=meta["name"],
        city=meta["city"],
        address=meta["address"],
        phone=meta.get("phone"),
        working_hours=meta.get("working_hours"),
        website_url=meta.get("website_url"),
        logo_url=meta.get("logo_url"),
        latitude=meta.get("latitude"),
        longitude=meta.get("longitude"),
        rating=Decimal(str(meta["rating"])) if meta.get("rating") else None,
        source_id=meta.get("source_id"),
        external_id=meta.get("external_id"),
        has_online_booking=bool(meta.get("has_online_booking", False)),
    )
    db.add(clinic)
    await db.flush()
    return clinic


async def ingest_scrape_result(
    db,
    matcher: ServiceMatcher,
    scrape: ScrapeResult,
    scraper,
    clinic_meta: dict | None = None,
    items=None,
) -> dict:
    work_items = items if items is not None else scrape.items
    stats = {
        "source": scrape.source_id,
        "source_name": scrape.source_name,
        "source_url": scrape.source_url,
        "clinic": scrape.clinic_name,
        "city": scrape.city,
        "scraped": len(work_items),
        "ingested": 0,
        "matched": 0,
        "needs_review": 0,
        "unmatched": 0,
        "errors": scrape.errors,
    }
    if not work_items:
        return stats

    clinic = await get_or_create_clinic(db, clinic_meta or scraper.clinic_meta())
    price_date = datetime.now(timezone.utc).date()
    parsed_at = datetime.now(timezone.utc)
    
    # Дедупликация: очищаем старые сырые данные для этой клиники перед вставкой новых
    from sqlalchemy import delete
    await db.execute(
        delete(ParsedPriceRow).where(ParsedPriceRow.clinic_id == clinic.id)
    )
    
    candidates: list[tuple[RawPriceRow, MatchResult]] = []
    best: dict[int, tuple[RawPriceRow, MatchResult, float]] = {}

    for item in work_items:
        price = parse_price(str(item.price))
        if price is None or not is_valid_price(float(price)):
            continue
        raw_name = normalize_name(item.name)
        if not is_valid_service_name(raw_name):
            continue
        match = matcher.match_single(raw_name)

        # Дата из документа (PDF meta / текст «действует с …») или сегодня
        item_price_date = price_date
        if item.extra.get("document_date"):
            try:
                from datetime import date as date_cls
                parts = str(item.extra["document_date"]).split("-")
                if len(parts) == 3:
                    item_price_date = date_cls(int(parts[0]), int(parts[1]), int(parts[2]))
            except (ValueError, TypeError):
                pass

        source_label = item.source_url
        if item.extra.get("source_type"):
            source_label = f"{item.extra['source_type']}:{item.source_url}"

        db.add(ParsedPriceRow(
            clinic_id=clinic.id,
            source_file=source_label[:500],
            raw_name=raw_name[:500],
            raw_price=str(item.price),
            parsed_price_kzt=price,
            match_status=match.status,
            matched_service_id=match.matched_service_id,
            match_score=match.score,
            parsed_at=parsed_at,
            duration_days=item.duration_days,
            currency="KZT",
        ))

        if match.status == "auto_accepted" and match.matched_service_id:
            stats["matched"] += 1
            sid = match.matched_service_id
            prev = best.get(sid)
            if prev is None or float(price) < prev[2]:
                best[sid] = (
                    RawPriceRow(
                        name=raw_name[:500],
                        price_str=str(item.price),
                        price_date=item_price_date,
                        duration_days=item.duration_days,
                        currency="KZT",
                    ),
                    match,
                    float(price),
                )
        elif match.status == "needs_review":
            stats["needs_review"] += 1
        else:
            stats["unmatched"] += 1

    for raw_row, match, _ in best.values():
        candidates.append((raw_row, match))

    if candidates:
        raw_rows, matches = zip(*candidates)
        result = await ingest_price_list(
            db=db,
            clinic_id=clinic.id,
            raw_rows=list(raw_rows),
            match_results=list(matches),
            price_date=price_date,
            accept_review=False,
        )
        stats["ingested"] = result.inserted + result.updated
        
        # Если были выявлены аномалии, обновляем match_status у соответствующих ParsedPriceRow
        if result.anomalies_detected > 0:
            for sid in result.anomalous_service_ids:
                stmt = select(ParsedPriceRow).where(
                    (ParsedPriceRow.clinic_id == clinic.id) &
                    (ParsedPriceRow.matched_service_id == sid) &
                    (ParsedPriceRow.match_status == "auto_accepted")
                )
                rows = await db.execute(stmt)
                for pr_row in rows.scalars():
                    pr_row.match_status = "needs_review"
                    
    await db.commit()
    return stats


async def run_all(scraper_ids: list[str] | None = None, deep_documents: bool = True) -> list[dict]:
    started_at = datetime.now(timezone.utc)
    results = []
    reset_session_cache()

    from app.services.db_migrate import ensure_clinic_columns
    await ensure_clinic_columns()

    try:
        from app.api import scrape as api_scrape
    except ImportError:
        api_scrape = None

    total_scrapers = len([s for s in ALL_SCRAPERS if not scraper_ids or s().source_id in scraper_ids])
    if api_scrape:
        api_scrape._scrape_progress.update({
            "running": True,
            "total": total_scrapers,
            "completed": 0,
            "errors_count": 0,
            "completed_list": [],
            "current_parser": None
        })

    async with AsyncSessionLocal() as db:
        matcher = ServiceMatcher()
        await matcher.load_index(db)
        await db.commit()

        scrape_cache = {}

        for ScraperCls in ALL_SCRAPERS:
            scraper = ScraperCls()
            if scraper_ids and scraper.source_id not in scraper_ids:
                continue
            if api_scrape:
                api_scrape._scrape_progress["current_parser"] = scraper.source_id

            cached_items = scrape_cache.get(scraper.source_url)
            if cached_items is not None:
                log.info("Скрапинг %s (%s) -> [Используем кэш сессии]", scraper.source_name, scraper.source_url)
                scrape = ScrapeResult(
                    source_id=scraper.source_id,
                    source_name=scraper.source_name,
                    source_url=scraper.source_url,
                    clinic_name=scraper.clinic_name,
                    city=scraper.city,
                    items=list(cached_items),
                    errors=[],
                )
            else:
                log.info("Скрапинг %s (%s)...", scraper.source_name, scraper.source_url)
                try:
                    scrape = await asyncio.to_thread(scraper.scrape)
                    if scrape.items and not scrape.errors and not scrape.branches:
                        scrape_cache[scraper.source_url] = scrape.items
                except Exception as exc:
                    log.error("Скрапер %s упал: %s", scraper.source_id, exc)
                    db.add(ParserLog(
                        parser_name=scraper.source_id,
                        status="error",
                        error_message=str(exc)
                    ))
                    await db.commit()
                    scrape = ScrapeResult(
                        source_id=scraper.source_id,
                        source_name=scraper.source_name,
                        source_url=scraper.source_url,
                        clinic_name=scraper.clinic_name,
                        city=scraper.city,
                        errors=[str(exc)],
                    )
            if scrape.branches:
                log.info("  → %s филиалов (мульти-клиника)", len(scrape.branches))
                branch_stats = []
                for branch in scrape.branches:
                    if not branch.items:
                        continue
                    bstats = await ingest_scrape_result(
                        db, matcher, scrape, scraper,
                        clinic_meta=branch.clinic_meta,
                        items=branch.items,
                    )
                    # подменяем items для статистики филиала
                    bstats["scraped"] = len(branch.items)
                    bstats["clinic"] = branch.clinic_meta.get("name")
                    branch_stats.append(bstats)
                stats = {
                    "source": scrape.source_id,
                    "source_name": scrape.source_name,
                    "branches": len(scrape.branches),
                    "scraped": sum(b.get("scraped", 0) for b in branch_stats),
                    "ingested": sum(b.get("ingested", 0) for b in branch_stats),
                    "matched": sum(b.get("matched", 0) for b in branch_stats),
                    "needs_review": sum(b.get("needs_review", 0) for b in branch_stats),
                    "unmatched": sum(b.get("unmatched", 0) for b in branch_stats),
                    "errors": scrape.errors,
                    "branch_details": branch_stats[:5],
                }
                db.add(ParserLog(
                    parser_name=scraper.source_id,
                    status="success" if not scrape.errors else "error",
                    error_message="; ".join(scrape.errors) if scrape.errors else None,
                    records_processed=stats.get("scraped", 0),
                    records_inserted=stats.get("ingested", 0)
                ))
                await db.commit()
            else:
                if scrape.items:
                    filtered, skipped = filter_scraped_items(scrape.items)
                    if skipped:
                        log.info("  фильтр: пропущено %s некорректных строк", skipped)
                    scrape.items = filtered

                # Deep crawl: PDF / DOCX / Excel / HTML-прайсы на сайте клиники
                stats_pre: dict = {}
                if deep_documents and (scraper.website_url or scraper.source_url):
                    try:
                        doc_stats = await asyncio.to_thread(
                            augment_all_scrapers_with_documents, scrape, scraper
                        )
                        if doc_stats.get("items_added"):
                            log.info(
                                "  документы: +%s поз., pdf/docx=%s, html=%s",
                                doc_stats["items_added"],
                                doc_stats.get("documents_parsed", 0),
                                doc_stats.get("html_pages_parsed", 0),
                            )
                        stats_pre = {"doc_augment": doc_stats}
                    except Exception as exc:
                        log.warning("  document augment failed: %s", exc)
                        scrape.errors.append(f"document_augment: {exc}")

                log.info("  → %s позиций, ошибок: %s", len(scrape.items), len(scrape.errors))
                for err in scrape.errors:
                    log.warning("  ! %s", err)
                stats = await ingest_scrape_result(db, matcher, scrape, scraper)
                stats.update(stats_pre)
                db.add(ParserLog(
                    parser_name=scraper.source_id,
                    status="success" if not scrape.errors else "error",
                    error_message="; ".join(scrape.errors) if scrape.errors else None,
                    records_processed=stats.get("scraped", 0),
                    records_inserted=stats.get("ingested", 0)
                ))
                await db.commit()
            results.append(stats)
            completed_list = [
                {
                    "source": r.get("source"),
                    "clinic": r.get("clinic"),
                    "city": r.get("city"),
                    "status": "error" if r.get("errors") else "success",
                    "rows": r.get("scraped", 0)
                }
                for r in results
            ]
            if api_scrape:
                api_scrape._scrape_progress.update({
                    "completed": len(results),
                    "errors_count": sum(1 for r in results if r.get("errors")),
                    "completed_list": completed_list
                })

        clinics = await db.scalar(select(func.count()).select_from(Clinic))
        svc = await db.scalar(select(func.count()).select_from(Service))
        prices = await db.scalar(select(func.count()).select_from(ParsedPriceRow))
        log.info("Итого: %s клиник, %s услуг, raw-строк: %s", clinics, svc, prices)

        from app.services.maintenance import purge_old_raw_rows
        purged = await purge_old_raw_rows(db)
        if purged:
            log.info("Retention (ТЗ §4): удалено %s raw-строк старше 90 дней", purged)
    finished_at = datetime.now(timezone.utc)
    write_scrape_audit(results, started_at, finished_at)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Скрапинг открытых источников из ТЗ")
    parser.add_argument("--source", action="append", help="ID источника (см. /api/scrape/sources)")
    parser.add_argument("--no-deep", action="store_true", help="Без обхода PDF/DOCX/Excel на сайтах")
    args = parser.parse_args()
    asyncio.run(run_all(args.source, deep_documents=not args.no_deep))


if __name__ == "__main__":
    main()
