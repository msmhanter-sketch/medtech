"""Base scraper helper for PDF price lists parsed through Docling."""

from parsers.price_text import parse_price_lines
from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult


class DoclingBaseScraper(BaseScraper):
    """Use Docling to convert a PDF into markdown, then extract real price rows."""

    def scrape_pdf_with_docling(self, pdf_url_or_path: str) -> ScrapeResult:
        res = self._result()

        try:
            from docling.document_converter import DocumentConverter

            converter = DocumentConverter()
            result = converter.convert(pdf_url_or_path)
            md_text = result.document.export_to_markdown() or ""

            rows = parse_price_lines(md_text)
            for row in rows:
                res.items.append(
                    ScrapedPrice(
                        name=str(row["name"]),
                        price=row["price"],
                        source_url=pdf_url_or_path,
                        extra={"source_type": "docling_markdown"},
                    )
                )

            if not res.items:
                res.errors.append("Docling parsed the document, but no real price rows were extracted")

        except ImportError:
            res.errors.append("Docling package is not installed. Run: pip install docling")
        except Exception as e:
            res.errors.append(f"Docling error: {e}")

        return res
