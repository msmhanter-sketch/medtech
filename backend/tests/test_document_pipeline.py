"""Тесты парсинга документов и дат."""
from datetime import date

from parsers.date_utils import extract_date_from_text, best_document_date, extract_date_from_url
from scrapers.html_prices import parse_html_prices


def test_extract_date_from_text_russian():
    text = "Прейскурант действует с 15.03.2025. Все цены в тенге."
    assert extract_date_from_text(text) == date(2025, 3, 15)


def test_extract_date_iso():
    text = "Price list valid from 2024-11-01"
    assert extract_date_from_text(text) == date(2024, 11, 1)


def test_best_document_date_fallback():
    d = best_document_date(text="", headers={}, fallback=date(2025, 1, 1))
    assert d == date(2025, 1, 1)


def test_parse_html_table_prices():
    html = """
    <html><body><table>
    <tr><td>Общий анализ крови</td><td>2 500 ₸</td></tr>
    <tr><td>УЗИ брюшной полости</td><td>8500 тг</td></tr>
    </table></body></html>
    """
    items = parse_html_prices(html, "https://example.kz/price")
    names = {i.name for i in items}
    assert any("анализ" in n.lower() for n in names)


def test_extract_date_from_url():
    assert extract_date_from_url(
        "https://clinic.kz/wp-content/uploads/2025/06/price.pdf"
    ) == date(2025, 6, 1)

    from scrapers.document_discovery import _classify_url
    assert _classify_url("https://clinic.kz/files/price.pdf") == "pdf"
    assert _classify_url("https://clinic.kz/price.doc") == "doc"
    assert _classify_url("https://clinic.kz/price.docx") == "docx"
    assert _classify_url("https://clinic.kz/prays-uslug") == "html"
