"""Скрапер для клиники Сункар (sunkar.kz)"""
import logging
import re
from bs4 import BeautifulSoup
import urllib3

from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get
from scrapers.validate import filter_scraped_items

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger(__name__)

class SunkarScraper(BaseScraper):
    source_id = "sunkar_kz"
    source_name = "МЦ Сункар"
    source_url = "https://sunkar.kz/prices/"
    clinic_name = "Медицинский центр Сункар"
    city = "Алматы"
    address = "Сеть клиник Сункар, Алматы"
    phone = "+7 (727) 333-33-33"
    website_url = "https://sunkar.kz"
    rating = 4.2

    def scrape(self) -> ScrapeResult:
        result = self._result()
        items = []
        try:
            with get_client(timeout=15) as client:
                resp = polite_get(client, self.source_url, delay_sec=1.0)
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # Поиск строк прайса
                rows = soup.find_all('tr')
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) >= 2:
                        name = cols[0].get_text(strip=True)
                        price_text = cols[1].get_text(strip=True)
                        digits = re.sub(r'\D', '', price_text)
                        if name and digits and int(digits) > 200:
                            items.append(ScrapedPrice(
                                name=name,
                                price=int(digits),
                                source_url=self.source_url
                            ))
        except Exception as e:
            log.warning("SunkarScraper: не удалось получить данные (%s).", e)
            result.errors.append(f"Sunkar: {e}")

        result.items, _ = filter_scraped_items(items)
        if not result.items:
            result.errors.append("Не удалось извлечь реальные данные: Sunkar")
            
        return result
