"""Тесты парсера .doc."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from parsers.doc_parser import parse_doc, _find_libreoffice
from parsers.price_text import parse_price_lines


def test_price_text_lines():
    text = (
        "Прейскурант действует с 01.06.2025\n"
        "Общий анализ крови 2500\n"
        "СОЭ 1200\n"
        "УЗИ брюшной полости 8500 тг\n"
    )
    rows = parse_price_lines(text)
    assert len(rows) >= 3
    names = {r["name"].lower() for r in rows}
    assert any("анализ" in n for n in names)


@pytest.mark.skipif(not _find_libreoffice(), reason="LibreOffice не установлен")
def test_doc_via_libreoffice_roundtrip(tmp_path):
    import docx

    docx_path = tmp_path / "test.docx"
    doc = docx.Document()
    table = doc.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "Глюкоза"
    table.rows[0].cells[1].text = "1800"
    table.rows[1].cells[0].text = "СОЭ"
    table.rows[1].cells[1].text = "1200"
    doc.save(str(docx_path))

    import subprocess

    soffice = _find_libreoffice()
    outdir = tmp_path / "out"
    outdir.mkdir()
    subprocess.run(
        [soffice, "--headless", "--convert-to", "doc", "--outdir", str(outdir), str(docx_path)],
        check=True,
        timeout=120,
    )
    doc_path = outdir / "test.doc"
    assert doc_path.is_file()

    rows = parse_doc(str(doc_path))
    assert len(rows) >= 2
