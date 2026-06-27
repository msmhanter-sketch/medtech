"""МЦК (mck.kz) — домен недоступен; скрапер фиксирует статус для аудита."""

from scrapers.base import BaseScraper, ScrapeResult
from scrapers.http_client import get_client, polite_get


class MckScraper(BaseScraper):
    source_id = "mck_kz"
    source_name = "МЦК (mck.kz)"
    source_url = "https://mck.kz/"
    clinic_name = "Медицинский центр МЦК"
    city = "Алматы"
    address = "г. Алматы"
    website_url = "https://mck.kz"
    rating = None

    def scrape(self) -> ScrapeResult:
        result = self._result()
        try:
            with get_client(timeout=20) as client:
                resp = polite_get(client, self.source_url, delay_sec=0.5)
                if "продается" in resp.text.lower() or "parking" in resp.text.lower():
                    result.errors.append(
                        "mck.kz: домен на продаже, медицинский сайт недоступен"
                    )
                else:
                    result.errors.append("mck.kz: прайс-лист не найден на сайте")
        except Exception as exc:
            result.errors.append(f"mck.kz недоступен: {exc}")
        return result
