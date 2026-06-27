"""Тестовый парсер PDF-прайса через Docling."""
from scrapers.docling_base import DoclingBaseScraper, ScrapeResult

class TestPDFScraper(DoclingBaseScraper):
    source_id = "test_pdf_docling"
    source_name = "Test PDF Clinic"
    source_url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    clinic_name = "UMC Demo Clinic"
    city = "Астана"
    address = "Тестовый адрес"
    
    def scrape(self) -> ScrapeResult:
        # Для реальной задачи здесь был бы URL на прайс клиники UMC или Сункар
        return self.scrape_pdf_with_docling(self.source_url)

if __name__ == "__main__":
    scraper = TestPDFScraper()
    result = scraper.scrape()
    print(f"Scraped {len(result.items)} items.")
    for item in result.items:
        print(item.name, item.price)
        print("Markdown Preview:\n", item.extra.get("markdown_preview", ""))
