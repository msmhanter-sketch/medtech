"""Парсер KDL ОЛИМП (kdlolymp.kz) — прайсы по городам Казахстана."""
from scrapers.base import BaseScraper, ScrapeResult
from scrapers.http_client import get_client, polite_get
from scrapers.kdlolymp_parser import fetch_rendered, parse_kdlolymp_html
from scrapers.kz_cities import KZ_CITY_COORDS

BASE = "https://www.kdlolymp.kz/pricelist"

# Города с рабочими страницами /pricelist/{slug}
KDLOLymp_CITY_SLUGS = [
    "almaty", "astana", "shymkent", "karaganda", "aktobe", "pavlodar",
    "ust-kamenogorsk", "atyrau", "semey", "aktau", "kokshetau", "taraz",
    "kyzylorda", "petropavlovsk", "kostanay", "oral", "turkestan",
]

KDLOLymp_CITIES: list[tuple[str, str, float, float]] = [
    (slug, KZ_CITY_COORDS[slug][0], KZ_CITY_COORDS[slug][1], KZ_CITY_COORDS[slug][2])
    for slug in KDLOLymp_CITY_SLUGS
    if slug in KZ_CITY_COORDS
]

def make_kdlolymp_scraper(
    city_slug: str,
    city_name: str,
    lat: float,
    lng: float,
) -> type[BaseScraper]:
    price_url = f"{BASE}/{city_slug}"

    class KdlOlympCityScraper(BaseScraper):
        source_id = f"kdlolymp_{city_slug}"
        source_name = f"KDL ОЛИМП ({city_name})"
        source_url = price_url
        clinic_name = f"KDL ОЛИМП — {city_name}"
        city = city_name
        address = f"г. {city_name}, сеть KDL ОЛИМП"
        phone = "+7 (727) 300-11-11"
        website_url = "https://www.kdlolymp.kz"
        logo_url = "https://kdlolymp.kz/icons/logo__desktop.svg"
        latitude = lat
        longitude = lng
        rating = 4.5

        def scrape(self) -> ScrapeResult:
            result = self._result()
            html = None
            try:
                with get_client(timeout=90) as client:
                    resp = polite_get(client, price_url, delay_sec=1.2)
                    html = resp.text
            except Exception as exc:
                result.errors.append(str(exc))

            if html:
                result.items = parse_kdlolymp_html(html, price_url)

            if not result.items:
                rendered = fetch_rendered(price_url)
                if rendered:
                    result.items = parse_kdlolymp_html(rendered, price_url)

            if not result.items:
                result.errors.append(f"KDL ОЛИМП {city_name}: не удалось извлечь прайс")
            from scrapers.validate import filter_scraped_items
            result.items, skipped = filter_scraped_items(result.items)
            if skipped:
                result.errors.append(f"KDL {city_name}: отфильтровано {skipped}")
            return result

    KdlOlympCityScraper.__name__ = f"KdlOlympScraper_{city_slug}"
    return KdlOlympCityScraper
