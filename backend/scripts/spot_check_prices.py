"""Сверка эталонных цен live vs парсер."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.helix import HelixScraper, _extract_pairs
from scrapers.http_client import get_client, polite_get
from scrapers.invitro import parse_invitro_html
from scrapers.kdlolymp import make_kdlolymp_scraper

CHECKS = [
    ("invitro", "СОЭ", 1200),
    ("invitro", "Общий анализ крови", 520),
    ("invitro", "Глюкоза", None),
]


def invitro_prices():
    with get_client(timeout=120) as c:
        html = polite_get(c, "https://invitro.kz/analizes/for-doctors/", delay_sec=1).text
    items = parse_invitro_html(html, "")
    return {i.name: i.price for i in items}


def helix_prices():
    with get_client(timeout=60) as c:
        resp = polite_get(c, "https://helix.ru/almaty/catalog/190-vse-analizy", delay_sec=1)
    pairs = _extract_pairs(resp.text)
    return {name: price for name, price in pairs}


def kdl_prices():
    s = make_kdlolymp_scraper("almaty", "Алматы", 0, 0)()
    r = s.scrape()
    return {i.name: i.price for i in r.items}


def find_price(catalog: dict, needle: str) -> tuple[str | None, int | None]:
    needle_l = needle.lower()
    for name, price in catalog.items():
        if needle_l in name.lower():
            return name, price
    return None, None


def main():
    print("=== INVITRO spot checks ===")
    inv = invitro_prices()
    print(f"total: {len(inv)}")
    for _, needle, expected in CHECKS:
        if _ == "invitro":
            name, price = find_price(inv, needle)
            ok = expected is None or price == expected
            mark = "OK" if ok else f"FAIL expected {expected}"
            print(f"  {needle}: {price} ({name[:60] if name else '?'}) {mark}")

    print("\n=== HELIX (vse-analizy page1) ===")
    hx = helix_prices()
    print(f"page1 pairs: {len(hx)}")
    for needle in ("Общий анализ крови", "СОЭ", "Глюкоза"):
        name, price = find_price(hx, needle)
        print(f"  {needle}: {price} | {name[:70] if name else '?'}")

    print("\n=== KDL Алматы ===")
    kdl = kdl_prices()
    print(f"total: {len(kdl)}")
    for needle in ("Общий анализ крови", "ОАК", "СОЭ"):
        name, price = find_price(kdl, needle)
        print(f"  {needle}: {price} | {name[:70] if name else '?'}")


if __name__ == "__main__":
    main()
