"""Подсчёт позиций HELIX при полном обходе."""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.helix import _extract_pairs
from scrapers.http_client import get_client, polite_get

HELIX = "https://helix.ru/almaty/catalog/"


def crawl_all():
    with get_client(timeout=90) as c:
        root = polite_get(c, HELIX, delay_sec=1).text
        paths = sorted(set(re.findall(r'href="(/almaty/catalog/\d+[^"]*)"', root.text if hasattr(root, "text") else root)))
        if not paths:
            paths = sorted(set(re.findall(r'href="(/catalog/\d+[^"]*)"', root)))
        seen: set[tuple[str, int]] = set()
        per_cat: dict[str, int] = {}
        for path in paths:
            rel = path if path.startswith("/almaty") else f"/almaty{path}"
            slug = rel.split("/")[-1]
            page = 1
            cat_count = 0
            while page <= 50:
                url = f"https://helix.ru{rel}" + (f"?page={page}" if page > 1 else "")
                try:
                    resp = polite_get(c, url, delay_sec=0.5)
                except Exception:
                    break
                pairs = _extract_pairs(resp.text)
                if not pairs:
                    break
                new = 0
                for name, price in pairs:
                    k = (name, price)
                    if k not in seen:
                        seen.add(k)
                        new += 1
                cat_count += new
                if new == 0:
                    break
                page += 1
            per_cat[slug] = cat_count
        print("categories", len(paths), "unique items", len(seen))
        for slug, n in sorted(per_cat.items(), key=lambda x: -x[1])[:15]:
            print(f"  {n:4d}  {slug}")


if __name__ == "__main__":
    crawl_all()
