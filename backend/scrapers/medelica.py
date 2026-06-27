"""Парсер MEDEL (medelica.kz) — клиника в Астане."""
import re

from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get

PRICE_URL = "https://medelica.kz/price"


def _parse_price_str(raw: str) -> int | None:
    raw = raw.strip()
    m = re.match(r"^(\d{3,7})", raw.replace(" ", ""))
    if m:
        return int(m.group(1))
    m = re.match(r"^(\d+)-(\d+)", raw.replace(" ", ""))
    if m:
        return int(m.group(1))
    return None


def parse_medelica_html(html: str, source_url: str) -> list[ScrapedPrice]:
    items: list[ScrapedPrice] = []
    seen: set[tuple[str, int]] = set()

    # Только карточки каталога (не попапы t754__product-full)
    for block in re.findall(
        r't754__col[^>]*js-product[^>]*>(.*?)</div>\s*</div>\s*</div>',
        html,
        flags=re.S,
    ):
        nm = re.search(r'js-product-name[^>]*>\s*([^<]+?)\s*</div>', block, re.S)
        pr = re.search(r'js-product-price[^>]*>\s*([^<]+?)\s*</div>', block, re.S)
        if not nm or not pr:
            continue
        name = re.sub(r"\s+", " ", nm.group(1)).strip()
        price = _parse_price_str(pr.group(1))
        if not name or not price or price < 500:
            continue
        key = (name, price)
        if key in seen:
            continue
        seen.add(key)
        items.append(ScrapedPrice(name=name, price=price, source_url=source_url))

    from scrapers.validate import filter_scraped_items
    filtered, _ = filter_scraped_items(items)
    return filtered


class MedelicaScraper(BaseScraper):
    """MEDEL — домен medel.kz паркуется; рабочий сайт medelica.kz."""

    source_id = "medel_kz"
    source_name = "МЕДЭЛ (MEDELICA)"
    source_url = PRICE_URL
    clinic_name = "Клиника MEDELICA"
    city = "Астана"
    address = "г. Астана, ул. Сыганак 64/1"
    phone = "+7 (7172) 57-57-57"
    website_url = "https://medelica.kz"
    logo_url = "https://static.tildacdn.pro/tild3438-6238-4538-a462-613439366565/photo.png"
    latitude = 51.0906
    longitude = 71.3984
    rating = 4.5

    def scrape(self) -> ScrapeResult:
        result = self._result()
        try:
            with get_client(timeout=60) as client:
                resp = polite_get(client, PRICE_URL, delay_sec=1.0)
                result.items = parse_medelica_html(resp.text, PRICE_URL)
        except Exception as exc:
            result.errors.append(str(exc))
        if not result.items:
            result.errors.append("MEDELICA: не удалось извлечь прайс")
        return result
