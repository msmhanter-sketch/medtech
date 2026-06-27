"""Парсер Университетской клиники Аксай (aksai-clinic → aksay.kaznmu.edu.kz)."""
import logging
import re
import tempfile
from pathlib import Path

from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get

log = logging.getLogger(__name__)

MEDIA_API = "https://aksay.kaznmu.edu.kz/wp-json/wp/v2/media?per_page=100"


def _latest_pricelist_pdf_url(client) -> str | None:
    resp = polite_get(client, MEDIA_API, delay_sec=1.0)
    items = resp.json()
    candidates = []
    for item in items:
        mime = item.get("mime_type") or ""
        if "pdf" not in mime:
            continue
        title = (item.get("title") or {}).get("rendered") or ""
        if not re.search(r"прейскурант|прайс|цен", title, re.I):
            continue
        url = item.get("source_url") or ""
        if url:
            candidates.append((item.get("date") or "", url, title))
    if not candidates:
        for item in items:
            if "pdf" in (item.get("mime_type") or ""):
                url = item.get("source_url")
                if url:
                    candidates.append((item.get("date") or "", url, ""))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]


class AksayScraper(BaseScraper):
    source_id = "aksai_clinic_kz"
    source_name = "Клиника Аксай (КазНМУ)"
    source_url = "https://aksay.kaznmu.edu.kz/"
    clinic_name = "Университетская клиника Аксай"
    city = "Алматы"
    address = "г. Алматы, мкр. Тастыбулак, ул. Таутаған 2/1"
    phone = "+7 (727) 379-79-79"
    website_url = "https://aksay.kaznmu.edu.kz"
    logo_url = "https://aksay.kaznmu.edu.kz/wp-content/themes/aksay/img/logo3.png"
    latitude = 43.2220
    longitude = 76.8512
    rating = 4.3

    def scrape(self) -> ScrapeResult:
        result = self._result()
        try:
            with get_client(timeout=90) as client:
                pdf_url = _latest_pricelist_pdf_url(client)
                if not pdf_url:
                    result.errors.append("Аксай: PDF прейскурант не найден")
                    return result

                resp = polite_get(client, pdf_url, delay_sec=1.0)
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(resp.content)
                    tmp_path = tmp.name

                try:
                    from parsers.pdf_parser import parse_pdf

                    rows = parse_pdf(tmp_path)
                    for row in rows:
                        name = (row.get("name") or "").strip()
                        price = row.get("price")
                        if not name or not price or float(price) < 100:
                            continue
                        result.items.append(ScrapedPrice(
                            name=name[:300],
                            price=int(float(price)),
                            source_url=pdf_url,
                        ))
                finally:
                    Path(tmp_path).unlink(missing_ok=True)
        except Exception as exc:
            result.errors.append(str(exc))
        from scrapers.validate import filter_scraped_items
        result.items, skipped = filter_scraped_items(result.items)
        if skipped:
            result.errors.append(f"Аксай: отфильтровано {skipped} строк")
        if not result.items and not result.errors:
            result.errors.append("Аксай: пустой прайс из PDF")
        return result
