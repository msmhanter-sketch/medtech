"""Парсер Nuxt payload kdlolymp.kz."""
import json
import logging
import re

from scrapers.base import ScrapedPrice

log = logging.getLogger(__name__)


def deref_nuxt(data: list, val, depth: int = 0):
    if depth > 30:
        return val
    if isinstance(val, int) and 0 <= val < len(data):
        return deref_nuxt(data, data[val], depth + 1)
    return val


def parse_kdlolymp_html(html: str, source_url: str) -> list[ScrapedPrice]:
    m = re.search(r'id="__NUXT_DATA__"[^>]*>([^<]+)', html)
    if not m:
        return []

    data = json.loads(m.group(1))
    items: list[ScrapedPrice] = []
    seen: set[tuple[str, int]] = set()

    for el in data:
        if not isinstance(el, dict) or "translation" not in el or "price" not in el:
            continue

        trans = deref_nuxt(data, el.get("translation"))
        if not isinstance(trans, dict):
            continue
        name = deref_nuxt(data, trans.get("title"))
        if not isinstance(name, str) or len(name.strip()) < 3:
            continue

        price_obj = deref_nuxt(data, el.get("price"))
        price_val = price_obj
        if isinstance(price_obj, dict):
            price_val = deref_nuxt(data, price_obj.get("price"))
        if not isinstance(price_val, (int, float)):
            continue

        price = int(price_val)
        if price < 100:
            continue

        key = (name.strip(), price)
        if key in seen:
            continue
        seen.add(key)
        items.append(ScrapedPrice(name=name.strip(), price=price, source_url=source_url))

    from scrapers.validate import filter_scraped_items
    filtered, _ = filter_scraped_items(items)
    return filtered


def fetch_rendered(url: str) -> str | None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=120_000)
            page.wait_for_timeout(2500)
            html = page.content()
            browser.close()
            return html
    except Exception as exc:
        log.warning("KDL Olymp playwright: %s", exc)
        return None
