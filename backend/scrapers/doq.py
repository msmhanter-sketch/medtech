"""Парсер DOQ.kz — все клиники/филиалы Казахстана с реальными адресами."""
from __future__ import annotations

import logging
from collections import defaultdict

from scrapers.base import BaseScraper, BranchScrape, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get
from scrapers.kz_cities import city_display_name
from scrapers.validate import filter_scraped_items

log = logging.getLogger(__name__)

API = "https://api.doq.kz/api/v1"
MAX_PAGES_PER_CITY = 40


def _parse_price(svc: dict) -> int | None:
    for key in ("total", "discount_price", "base_price", "price"):
        val = svc.get(key)
        if isinstance(val, (int, float)) and val >= 500:
            return int(val)
    return None


def fetch_doq_cities() -> list[tuple[str, str, int]]:
    """Актуальный список городов: (slug, название, doq_city_id)."""
    cities: list[tuple[str, str, int]] = []
    url = f"{API}/cities/?limit=100"
    try:
        with get_client(timeout=30) as client:
            resp = polite_get(client, url, delay_sec=0.3)
            payload = resp.json()
        for row in payload.get("results") or []:
            slug = (row.get("slug") or "").strip()
            name = (row.get("name") or "").strip()
            cid = row.get("id")
            if slug and cid is not None:
                cities.append((slug, city_display_name(slug, name or None), int(cid)))
    except Exception as exc:
        log.warning("DOQ cities API: %s", exc)
    return cities


def _fetch_all_branches_for_city(client, doq_city_id: int) -> dict[int, dict]:
    """Филиалы одного города по numeric city id."""
    branches: dict[int, dict] = {}
    offset = 0
    while True:
        url = f"{API}/clinic-branches/?city={doq_city_id}&limit=100&offset={offset}"
        try:
            resp = polite_get(client, url, delay_sec=0.35)
            payload = resp.json()
        except Exception as exc:
            log.warning("DOQ branches city=%s offset=%s: %s", doq_city_id, offset, exc)
            break
        rows = payload.get("results") or []
        if not rows:
            break
        for row in rows:
            bid = row.get("id")
            if bid is not None:
                branches[int(bid)] = row
        if not payload.get("next"):
            break
        offset += 100
    return branches


def fetch_doq_city_branches(city_slug: str, city_name: str, doq_city_id: int) -> list[BranchScrape]:
    """
    По каждому филиалу DOQ — отдельная клиника с адресом и координатами.
    Цена услуги = минимум среди врачей этого филиала.
    """
    by_branch: dict[int, dict[str, int]] = defaultdict(dict)

    with get_client(timeout=90) as client:
        branch_cache = _fetch_all_branches_for_city(client, doq_city_id)
        offset = 0
        page = 0

        while page < MAX_PAGES_PER_CITY:
            url = (
                f"{API}/doctors/?city={doq_city_id}"
                f"&expand=services&limit=100&offset={offset}"
            )
            try:
                resp = polite_get(client, url, delay_sec=0.45)
                payload = resp.json()
            except Exception as exc:
                log.warning("DOQ %s offset=%s: %s", city_slug, offset, exc)
                break

            results = payload.get("results") or []
            if not results:
                break

            for doc in results:
                for svc in doc.get("services") or []:
                    branch_id = svc.get("clinic_branch")
                    if not branch_id:
                        continue
                    branch_id = int(branch_id)
                    if branch_id not in branch_cache:
                        continue
                    service = svc.get("service") or {}
                    name = (service.get("name") or "").strip()
                    if not name:
                        continue
                    stype = service.get("type") or ""
                    label = name if stype == "procedure" else f"Приём: {name}"
                    price = _parse_price(svc)
                    if not price:
                        continue
                    prev = by_branch[branch_id].get(label)
                    if prev is None or price < prev:
                        by_branch[branch_id][label] = price

            if not payload.get("next"):
                break
            offset += 100
            page += 1

        branches: list[BranchScrape] = []
        for branch_id, prices in by_branch.items():
            if not prices:
                continue
            branch = branch_cache.get(branch_id)
            if not branch:
                continue

            raw_address = (branch.get("address") or "").replace("\u200b", "").strip()
            loc = branch.get("location") or {}
            phones = branch.get("phones") or []
            branch_slug = branch.get("slug")
            branch_name = (branch.get("name") or f"Клиника #{branch_id}").strip()
            website = f"https://doq.kz/{branch_slug}" if branch_slug else "https://doq.kz"

            score = branch.get("feedback_score")
            rating = round(float(score) / 2, 1) if isinstance(score, (int, float)) else None

            items = [
                ScrapedPrice(
                    name=label,
                    price=price,
                    source_url=website,
                    extra={"city": city_name, "doq_branch_id": branch_id},
                )
                for label, price in prices.items()
            ]
            filtered, _ = filter_scraped_items(items)
            if not filtered:
                continue

            branches.append(BranchScrape(
                clinic_meta={
                    "name": branch_name,
                    "city": city_name,
                    "address": raw_address,
                    "phone": phones[0] if phones else None,
                    "website_url": website,
                    "logo_url": "https://doq.kz/apple-touch-icon.png",
                    "latitude": loc.get("lat"),
                    "longitude": loc.get("lng"),
                    "rating": rating,
                    "source_id": "doq",
                    "external_id": f"branch_{branch_id}",
                },
                items=filtered,
            ))

    return branches


def make_doq_scraper(
    city_slug: str,
    city_name: str,
    lat: float,
    lng: float,
    doq_city_id: int,
) -> type[BaseScraper]:
    _city_id = doq_city_id

    class DoqCityScraper(BaseScraper):
        source_id = f"doq_{city_slug}"
        source_name = f"DOQ.kz ({city_name})"
        source_url = f"https://doq.kz/doctors/{city_slug}"
        clinic_name = f"DOQ.kz — {city_name}"
        city = city_name
        address = f"г. {city_name}"
        phone = "+7 (727) 300-30-30"
        website_url = "https://doq.kz"
        logo_url = "https://doq.kz/apple-touch-icon.png"
        latitude = lat
        longitude = lng
        rating = 4.4

        def scrape(self) -> ScrapeResult:
            result = self._result()
            try:
                branches = fetch_doq_city_branches(city_slug, city_name, _city_id)
                result.branches = branches
                if not branches:
                    result.errors.append(f"DOQ {city_name}: филиалы не найдены")
                else:
                    total = sum(len(b.items) for b in branches)
                    log.info("DOQ %s: %s филиалов, %s позиций", city_name, len(branches), total)
            except Exception as exc:
                result.errors.append(str(exc))
            return result

    DoqCityScraper.__name__ = f"DoqScraper_{city_slug}"
    return DoqCityScraper


def build_doq_scrapers() -> list[type[BaseScraper]]:
    """Города DOQ из API + координаты из справочника."""
    from scrapers.kz_cities import city_coords

    scrapers: list[type[BaseScraper]] = []
    for slug, name, doq_id in fetch_doq_cities():
        coords = city_coords(slug)
        lat, lng = coords if coords else (0.0, 0.0)
        scrapers.append(make_doq_scraper(slug, name, lat, lng, doq_id))
    if not scrapers:
        from scrapers.kz_cities import KZ_CITY_COORDS
        for slug, (name, lat, lng) in list(KZ_CITY_COORDS.items())[:12]:
            scrapers.append(make_doq_scraper(slug, name, lat, lng, 0))
    return scrapers


# Обратная совместимость для тестов
DOQ_CITIES: list[tuple[str, str, float, float]] = [
    (slug, city_display_name(slug), lat, lng)
    for slug, (name, lat, lng) in __import__("scrapers.kz_cities", fromlist=["KZ_CITY_COORDS"]).KZ_CITY_COORDS.items()
    if slug in {
        "almaty", "astana", "shymkent", "karaganda", "aktobe", "pavlodar",
        "ust-kamenogorsk", "semey", "taraz", "kyzylorda", "aktau", "kokshetau",
    }
]
