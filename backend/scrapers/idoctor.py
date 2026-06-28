"""Скрапер для агрегатора iDoctor.kz"""
import logging
import re
from bs4 import BeautifulSoup
import urllib3

from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get
from scrapers.validate import filter_scraped_items

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger(__name__)

class IDoctorScraper(BaseScraper):
    source_id = "idoctor_kz"
    source_name = "iDoctor.kz"
    source_url = "https://idoctor.kz/doctors/almaty"
    clinic_name = "Агрегатор iDoctor"
    city = "Алматы"
    address = "Онлайн-агрегатор"
    phone = "+7 (727) 222-22-22"
    website_url = "https://idoctor.kz"

    def scrape(self) -> ScrapeResult:
        result = self._result()
        items = []
        try:
            with get_client(timeout=15) as client:
                resp = polite_get(client, self.source_url, delay_sec=1.0)
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # Ищем блоки с ценами (зависит от верстки)
                doctor_cards = soup.find_all('div', class_=re.compile(r'doctor-card|item', re.I))
                for card in doctor_cards:
                    spec_elem = card.find(['div', 'span', 'p'], class_=re.compile(r'spec|title', re.I))
                    price_elem = card.find(['div', 'span'], class_=re.compile(r'price', re.I))
                    
                    if spec_elem and price_elem:
                        name = f"Прием: {spec_elem.get_text(strip=True)}"
                        price_text = price_elem.get_text(strip=True)
                        digits = re.sub(r'\D', '', price_text)
                        if digits and int(digits) > 1000:
                            items.append(ScrapedPrice(
                                name=name,
                                price=int(digits),
                                source_url=self.source_url
                            ))
        except Exception as e:
            log.warning("IDoctorScraper: не удалось получить данные (%s).", e)
            result.errors.append(f"iDoctor: {e}")

        # Оставляем минимальную цену для каждой специальности
        by_label = {}
        for item in items:
            if item.name not in by_label or item.price < by_label[item.name].price:
                by_label[item.name] = item
                
        result.items, _ = filter_scraped_items(list(by_label.values()))
        if not result.items:
            result.errors.append("Не удалось извлечь реальные данные: iDoctor")
            
        return result
