"""Парсер для сети лабораторий Invivo.kz"""
import logging
import re
from bs4 import BeautifulSoup
import urllib3

from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get
from scrapers.validate import filter_scraped_items

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger(__name__)

class InvivoScraper(BaseScraper):
    source_id = "invivo_kz"
    source_name = "Invivo"
    source_url = "https://invivo.kz/ru/almaty/services/"
    clinic_name = "Invivo Clinic"
    city = "Алматы"
    address = "Сеть лабораторий Invivo"
    phone = "8 727 333 33 33"
    website_url = "https://invivo.kz"
    rating = 4.3

    def scrape(self) -> ScrapeResult:
        result = self._result()
        items = []
        try:
            with get_client(timeout=15) as client:
                # Попытка реального скрапинга
                resp = polite_get(client, self.source_url, delay_sec=1.0)
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # Поиск карточек услуг на сайте Invivo
                blocks = soup.find_all('div', class_=re.compile(r'service-card|price-item', re.I))
                for block in blocks:
                    title_elem = block.find(['h3', 'div'], class_=re.compile(r'title|name', re.I))
                    price_elem = block.find(['span', 'div'], class_=re.compile(r'price|cost', re.I))
                    
                    if title_elem and price_elem:
                        name = title_elem.get_text(strip=True)
                        price_text = price_elem.get_text(strip=True)
                        digits = re.sub(r'\D', '', price_text)
                        if digits and int(digits) > 200:
                            items.append(ScrapedPrice(
                                name=name,
                                price=int(digits),
                                source_url=self.source_url
                            ))
        except Exception as e:
            log.warning("InvivoScraper: не удалось получить данные (%s).", e)
            result.errors.append(f"Invivo: {e}")

        result.items, _ = filter_scraped_items(items)
        if not result.items:
            result.errors.append("Не удалось извлечь реальные данные: Invivo")
            
        return result

