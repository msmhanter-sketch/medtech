"""
Пайплайн: скачать PDF/DOCX/Excel → распарсить → извлечь дату → добавить в ScrapeResult.
"""
from __future__ import annotations

import hashlib
import logging
import os
import tempfile
from datetime import date
from pathlib import Path
from typing import TYPE_CHECKING

from parsers import get_parser
from parsers.date_utils import best_document_date, extract_date_from_pdf_metadata
from scrapers.base import ScrapeResult, ScrapedPrice
from scrapers.document_discovery import discover_site_assets
from scrapers.html_prices import parse_html_prices
from scrapers.http_client import get_client, polite_get
from scrapers.validate import filter_scraped_items

if TYPE_CHECKING:
    from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

# Кэш хешей документов за сессию — не парсить один файл дважды
_SESSION_HASHES: set[str] = set()


def _content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def _suffix_for_url(url: str) -> str:
    low = url.lower().split("?")[0]
    for ext in (".pdf", ".doc", ".docx", ".xlsx", ".xls"):
        if low.endswith(ext):
            return ext
    return ".bin"


def download_and_parse_document(
    client,
    url: str,
    *,
    delay_sec: float = 1.0,
) -> tuple[list[dict], date | None, str | None, list[str]]:
    """
    Returns: (rows [{name, price}], document_date, content_hash, errors)
    """
    errors: list[str] = []
    try:
        resp = polite_get(client, url, delay_sec=delay_sec)
    except Exception as exc:
        return [], None, None, [f"download {url}: {exc}"]

    data = resp.content
    if len(data) < 100:
        return [], None, None, [f"empty document: {url}"]

    chash = _content_hash(data)
    if chash in _SESSION_HASHES:
        return [], None, chash, [f"skip duplicate hash {chash}"]
    _SESSION_HASHES.add(chash)

    suffix = _suffix_for_url(url)
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        text_sample = ""
        pdf_meta: dict = {}
        if suffix == ".pdf":
            try:
                import pdfplumber
                with pdfplumber.open(tmp_path) as pdf:
                    if pdf.metadata:
                        pdf_meta = dict(pdf.metadata)
                    for page in pdf.pages[:3]:
                        t = page.extract_text() or ""
                        text_sample += t + "\n"
            except Exception:
                pass

        doc_date = best_document_date(
            text=text_sample,
            headers=dict(resp.headers),
            pdf_meta=pdf_meta,
            url=url,
        )

        try:
            parser_fn = get_parser(tmp_path, fast=True)
            rows = parser_fn(tmp_path)
        except ValueError as exc:
            return [], doc_date, chash, [f"no parser for {url}: {exc}"]
        except Exception as exc:
            return [], doc_date, chash, [f"parse {url}: {exc}"]

        clean = []
        for row in rows:
            name = str(row.get("name", "")).strip()
            price = row.get("price")
            if not name or price is None:
                continue
            clean.append({"name": name, "price": price})

        return clean, doc_date, chash, errors
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def augment_scrape_with_site_documents(
    scrape: ScrapeResult,
    scraper: "BaseScraper",
    client,
    *,
    max_pages: int = 20,
    max_documents: int = 25,
    delay_sec: float = 1.0,
) -> dict:
    """
    Deep crawl website_url клиники: PDF/DOCX/XLS + HTML-прайсы.
    Дополняет scrape.items и scrape.errors.
    """
    stats = {
        "documents_found": 0,
        "documents_parsed": 0,
        "html_pages_parsed": 0,
        "items_added": 0,
        "errors": [],
    }

    base = scraper.website_url or scraper.source_url
    if not base:
        return stats

    discovery = discover_site_assets(
        base, client, max_pages=max_pages, max_documents=max_documents, delay_sec=delay_sec,
    )
    stats["documents_found"] = len(discovery.documents)
    stats["errors"].extend(discovery.errors)

    existing_keys = {(i.name.lower(), int(i.price)) for i in scrape.items}
    existing_doc_urls = {i.source_url for i in scrape.items if i.source_url}

    # Сначала свежие документы (по дате в URL/имени)
    from parsers.date_utils import extract_date_from_url
    from datetime import date as date_cls

    def _doc_sort_key(asset):
        d = extract_date_from_url(asset.url)
        return d or date_cls(2000, 1, 1)

    sorted_docs = sorted(discovery.documents, key=_doc_sort_key, reverse=True)
    # Не парсить старые PDF, если уже есть свежий с того же сайта
    parse_docs = sorted_docs[:max_documents]
    if sorted_docs:
        newest = _doc_sort_key(sorted_docs[0])
        parse_docs = [d for d in sorted_docs if _doc_sort_key(d) >= newest.replace(month=1, day=1)]

    for doc in parse_docs:
        if doc.url in existing_doc_urls:
            continue
        rows, doc_date, chash, errs = download_and_parse_document(
            client, doc.url, delay_sec=delay_sec,
        )
        stats["errors"].extend(errs)
        if not rows:
            continue
        stats["documents_parsed"] += 1
        for row in rows:
            key = (row["name"].lower(), int(row["price"]))
            if key in existing_keys:
                continue
            existing_keys.add(key)
            scrape.items.append(ScrapedPrice(
                name=row["name"],
                price=row["price"],
                source_url=doc.url,
                extra={
                    "source_type": doc.kind,
                    "document_date": doc_date.isoformat() if doc_date else None,
                    "content_hash": chash,
                    "link_text": doc.link_text,
                },
            ))
            stats["items_added"] += 1

    seen_html: set[str] = set()
    for page in discovery.html_pages:
        if page.url in seen_html:
            continue
        seen_html.add(page.url)
        try:
            resp = polite_get(client, page.url, delay_sec=delay_sec)
            html_items = parse_html_prices(resp.text, page.url)
            doc_date = best_document_date(
                text=resp.text[:8000],
                headers=dict(resp.headers),
            )
            stats["html_pages_parsed"] += 1
            for item in html_items:
                key = (item.name.lower(), int(item.price))
                if key in existing_keys:
                    continue
                existing_keys.add(key)
                item.extra = {
                    "source_type": "html",
                    "document_date": doc_date.isoformat(),
                }
                scrape.items.append(item)
                stats["items_added"] += 1
        except Exception as exc:
            stats["errors"].append(f"html {page.url}: {exc}")

    scrape.errors.extend(stats["errors"][:5])  # не раздувать лог
    filtered, skipped = filter_scraped_items(scrape.items)
    scrape.items = filtered
    if skipped:
        log.info("%s: document augment filtered %s junk rows", scrape.source_id, skipped)

    return stats


def augment_all_scrapers_with_documents(
    scrape: ScrapeResult,
    scraper: "BaseScraper",
) -> dict:
    """Sync wrapper для вызова из scrape_and_ingest."""
    global _SESSION_HASHES
    with get_client(timeout=90) as client:
        return augment_scrape_with_site_documents(scrape, scraper, client)


def reset_session_cache() -> None:
    _SESSION_HASHES.clear()
