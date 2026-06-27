"""HELIX Kazakhstan — полный обход каталога."""
import re

from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get
from scrapers.validate import filter_scraped_items

HELIX_CATALOG = "https://helix.ru/almaty/catalog/"
MAX_PAGES_PER_CATEGORY = 50


def _decode_title(raw: str) -> str:
    if "\\u" not in raw and "\\x" not in raw:
        return raw
    try:
        return raw.encode("utf-8").decode("unicode_escape")
    except Exception:
        return raw


def _extract_pairs(html: str) -> list[tuple[str, int]]:
    pairs = re.findall(
        r'"title"\s*:\s*"((?:[^"\\]|\\.)+)"[^}]{0,500}?"price"\s*:\s*(\d+)',
        html,
    )
    return [(_decode_title(title), int(price)) for title, price in pairs]


class HelixScraper(BaseScraper):
    source_id = "helix_kz"
    source_name = "HELIX Kazakhstan"
    source_url = HELIX_CATALOG
    clinic_name = "HELIX Диагностика"
    city = "Алматы"
    address = "г. Алматы, филиальная сеть HELIX"
    phone = "+7 (727) 300-00-00"
    website_url = "https://helix.kz"
    logo_url = "https://helix.ru/logo.png"
    latitude = 43.2389
    longitude = 76.8897
    rating = 4.6

    def scrape(self) -> ScrapeResult:
        result = self._result()
        seen: set[tuple[str, int]] = set()

        try:
            with get_client(timeout=90) as client:
                root = polite_get(client, HELIX_CATALOG, delay_sec=1.0)
                category_paths = sorted(set(
                    re.findall(r'href="(/almaty/catalog/\d+[^"]*)"', root.text)
                ))
                if not category_paths:
                    result.errors.append("HELIX: категории не найдены")
                    return result

                for path in category_paths:
                    page = 1
                    while page <= MAX_PAGES_PER_CATEGORY:
                        url = f"https://helix.ru{path}" + (f"?page={page}" if page > 1 else "")
                        try:
                            resp = polite_get(client, url, delay_sec=0.6)
                        except Exception:
                            break
                        pairs = _extract_pairs(resp.text)
                        if not pairs:
                            break
                        new_on_page = 0
                        for name, price in pairs:
                            key = (name, price)
                            if key in seen:
                                continue
                            seen.add(key)
                            new_on_page += 1
                            result.items.append(ScrapedPrice(
                                name=name, price=price, source_url=url,
                            ))
                        if new_on_page == 0:
                            break
                        page += 1
        except Exception as exc:
            result.errors.append(str(exc))

        result.items, skipped = filter_scraped_items(result.items)
        if skipped:
            result.errors.append(f"helix: отфильтровано {skipped} некорректных строк")
        return result
