"""Быстрая проверка парсеров на живых источниках."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.aksay import AksayScraper
from scrapers.helix import HelixScraper
from scrapers.invitro import InvitroScraper
from scrapers.medelica import MedelicaScraper
from scrapers.validate import is_valid_service_name


def check(scraper_cls):
    s = scraper_cls()
    r = s.scrape()
    bad = [i for i in r.items if not is_valid_service_name(i.name) or i.price < 300]
    trunc = [i for i in r.items if i.name.rstrip().endswith(("определени", " (", " -"))]
    print(f"{s.source_id}: {len(r.items)} items, bad={len(bad)}, trunc_suspect={len(trunc)}, errors={r.errors[:2]}")
    if r.items:
        soe = [i for i in r.items if i.name.startswith("СОЭ")]
        if soe:
            print(f"  СОЭ price={soe[0].price} (expect ~1200)")
    return len(bad) == 0 and len(r.items) > 0


if __name__ == "__main__":
    ok = all(check(C) for C in [InvitroScraper, HelixScraper, MedelicaScraper, AksayScraper])
    print("ALL OK" if ok else "ISSUES FOUND")
