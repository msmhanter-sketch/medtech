"""
Генерация отчёта для ручной сверки парсеров.

Запуск:
  cd backend
  python scripts/generate_parser_verification_report.py

Результат:
  backend/logs/parser_verification_report.md  — сводка + первые N строк каждого парсера
  backend/logs/parser_verification_samples/   — скачанные/синтетические файлы для проверки
"""
from __future__ import annotations

import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from parsers import get_parser
from parsers.date_utils import best_document_date, extract_date_from_url
from scrapers.aksay import AksayScraper, _latest_pricelist_pdf_url
from scrapers.html_prices import parse_html_prices
from scrapers.http_client import get_client, polite_get
from scrapers.medelica import MedelicaScraper

BACKEND = Path(__file__).parent.parent
LOGS = BACKEND / "logs"
SAMPLES = LOGS / "parser_verification_samples"
REPORT = LOGS / "parser_verification_report.md"
MAX_ROWS = 40

PARSER_SOURCES = {
    "pdf": BACKEND / "parsers" / "pdf_parser.py",
    "doc": BACKEND / "parsers" / "doc_parser.py",
    "docx": BACKEND / "parsers" / "docx_parser.py",
    "excel": BACKEND / "parsers" / "excel_parser.py",
    "html": BACKEND / "scrapers" / "html_prices.py",
    "price_text": BACKEND / "parsers" / "price_text.py",
}


def _read_excerpt(path: Path, lines: int = 45) -> str:
    if not path.is_file():
        return f"(файл не найден: {path})"
    text = path.read_text(encoding="utf-8", errors="replace")
    chunk = "\n".join(text.splitlines()[:lines])
    return chunk


def _rows_table(rows: list[dict], limit: int = MAX_ROWS) -> str:
    if not rows:
        return "_Нет строк_\n"
    lines = ["| # | Услуга | Цена (₸) |", "|---:|---|---:|"]
    for i, row in enumerate(rows[:limit], 1):
        name = str(row.get("name", "")).replace("|", "/")[:120]
        price = row.get("price", "")
        lines.append(f"| {i} | {name} | {price} |")
    if len(rows) > limit:
        lines.append(f"\n_… и ещё {len(rows) - limit} строк_")
    return "\n".join(lines) + "\n"


def _write_sample(name: str, data: bytes) -> Path:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    path = SAMPLES / name
    path.write_bytes(data)
    return path


def _create_synthetic_docx() -> Path:
    import docx

    doc = docx.Document()
    table = doc.add_table(rows=4, cols=2)
    rows_data = [
        ("Наименование", "Цена"),
        ("Общий анализ крови (CBC)", "2500"),
        ("СОЭ", "1200"),
        ("УЗИ брюшной полости", "8500"),
    ]
    for i, (a, b) in enumerate(rows_data):
        table.rows[i].cells[0].text = a
        table.rows[i].cells[1].text = b
    path = SAMPLES / "synthetic_test.docx"
    SAMPLES.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))
    return path


def _create_synthetic_xlsx() -> Path:
    import pandas as pd

    path = SAMPLES / "synthetic_test.xlsx"
    SAMPLES.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(
        [
            ["Наименование", "Стоимость"],
            ["Глюкоза в крови", 1800],
            ["Креатинин", 950],
            ["Билирубин общий", 1100],
        ]
    )
    df.to_excel(path, index=False, header=False)
    return path


def _create_synthetic_doc_from_docx(docx_path: Path) -> Path | None:
    from parsers.doc_parser import _convert_doc_to_docx, _find_libreoffice

    if not _find_libreoffice():
        return None
    # docx уже есть — конвертируем docx → doc через LibreOffice
    soffice = _find_libreoffice()
    import subprocess

    outdir = tempfile.mkdtemp(prefix="medprice_docgen_")
    try:
        proc = subprocess.run(
            [soffice, "--headless", "--convert-to", "doc", "--outdir", outdir, str(docx_path)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if proc.returncode != 0:
            return None
        doc_path = Path(outdir) / f"{docx_path.stem}.doc"
        if not doc_path.is_file():
            return None
        dest = SAMPLES / "synthetic_test.doc"
        dest.write_bytes(doc_path.read_bytes())
        return dest
    except (OSError, subprocess.TimeoutExpired):
        return None


def _section(title: str, body: str) -> str:
    return f"\n## {title}\n\n{body}\n"


def run_report() -> Path:
    LOGS.mkdir(parents=True, exist_ok=True)
    SAMPLES.mkdir(parents=True, exist_ok=True)
    sections: list[str] = []
    meta: dict = {"generated_at": datetime.now(timezone.utc).isoformat(), "cases": []}

    sections.append(
        "# Отчёт проверки парсеров MedServicePrice.kz\n\n"
        f"Сгенерировано: `{meta['generated_at']}`\n\n"
        "Сверьте таблицы ниже с оригиналами в `backend/logs/parser_verification_samples/`.\n"
        "Исходники парсеров — фрагменты в каждом разделе.\n"
    )

    # --- PDF (живой Аксай) ---
    pdf_case: dict = {"format": "pdf", "source": None, "rows": 0, "errors": []}
    try:
        with get_client(timeout=90) as client:
            pdf_url = _latest_pricelist_pdf_url(client)
            if pdf_url:
                resp = polite_get(client, pdf_url, delay_sec=0.5)
                pdf_path = _write_sample("aksay_live.pdf", resp.content)
                pdf_case["source"] = pdf_url
                pdf_case["file"] = str(pdf_path)
                pdf_case["date_url"] = str(extract_date_from_url(pdf_url))
                parser = get_parser(str(pdf_path), fast=True)
                rows = parser(str(pdf_path))
                pdf_case["rows"] = len(rows)
                body = (
                    f"**Модуль:** `parsers/pdf_parser.py` (pdfplumber)\n\n"
                    f"**URL:** {pdf_url}\n\n"
                    f"**Файл:** `{pdf_path}` ({len(resp.content)} байт)\n\n"
                    f"**Дата из URL:** {pdf_case['date_url']}\n\n"
                    f"**Строк распознано:** {len(rows)}\n\n"
                    f"### Исходник (фрагмент)\n\n```python\n{_read_excerpt(PARSER_SOURCES['pdf'])}\n```\n\n"
                    f"### Результат (первые {MAX_ROWS})\n\n{_rows_table(rows)}"
                )
            else:
                body = "PDF Аксай не найден через media API."
                pdf_case["errors"].append("pdf not found")
    except Exception as exc:
        body = f"Ошибка PDF: `{exc}`"
        pdf_case["errors"].append(str(exc))
    sections.append(_section("1. PDF — живой прейскурант Аксай", body))
    meta["cases"].append(pdf_case)

    # --- DOCX synthetic ---
    docx_case: dict = {"format": "docx", "rows": 0}
    try:
        docx_path = _create_synthetic_docx()
        docx_case["file"] = str(docx_path)
        rows = get_parser(str(docx_path))(str(docx_path))
        docx_case["rows"] = len(rows)
        body = (
            f"**Модуль:** `parsers/docx_parser.py`\n\n"
            f"**Файл:** `{docx_path}` (синтетический, 3 услуги)\n\n"
            f"**Строк:** {len(rows)}\n\n"
            f"### Исходник (фрагмент)\n\n```python\n{_read_excerpt(PARSER_SOURCES['docx'])}\n```\n\n"
            f"### Результат\n\n{_rows_table(rows)}"
        )
    except Exception as exc:
        body = f"Ошибка DOCX: `{exc}`"
        docx_case["errors"] = [str(exc)]
    sections.append(_section("2. DOCX — синтетический прайс", body))
    meta["cases"].append(docx_case)

    # --- DOC ---
    doc_case: dict = {"format": "doc", "rows": 0}
    try:
        docx_path = SAMPLES / "synthetic_test.docx"
        doc_path = _create_synthetic_doc_from_docx(docx_path)
        if doc_path and doc_path.is_file():
            doc_case["file"] = str(doc_path)
            doc_case["method"] = "libreoffice roundtrip"
            rows = get_parser(str(doc_path))(str(doc_path))
            doc_case["rows"] = len(rows)
            body = (
                f"**Модуль:** `parsers/doc_parser.py` (LibreOffice → docx / antiword / OLE)\n\n"
                f"**Файл:** `{doc_path}`\n\n"
                f"**Строк:** {len(rows)}\n\n"
                f"### Исходник (фрагмент)\n\n```python\n{_read_excerpt(PARSER_SOURCES['doc'])}\n```\n\n"
                f"### Результат\n\n{_rows_table(rows)}"
            )
        else:
            # Fallback: OLE-текстовый тест без LibreOffice
            from parsers.doc_parser import parse_doc as parse_doc_fn
            from parsers.price_text import parse_price_lines

            sample_text = (
                "Прейскурант действует с 01.06.2025\n"
                "Общий анализ крови 2500\n"
                "СОЭ 1200\n"
                "УЗИ брюшной полости 8500 тг\n"
            )
            rows = parse_price_lines(sample_text)
            doc_case["method"] = "price_text sample parse (LibreOffice не найден)"
            doc_case["rows"] = len(rows)
            body = (
                f"**Модуль:** `parsers/doc_parser.py`\n\n"
                f"LibreOffice не установлен — `.doc` файл не создан.\n"
                f"Проверен запасной путь `price_text` (как после antiword/OLE):\n\n"
                f"**Строк:** {len(rows)}\n\n"
                f"### Исходник doc_parser (фрагмент)\n\n```python\n{_read_excerpt(PARSER_SOURCES['doc'])}\n```\n\n"
                f"### Исходник price_text (фрагмент)\n\n```python\n{_read_excerpt(PARSER_SOURCES['price_text'])}\n```\n\n"
                f"### Результат\n\n{_rows_table(rows)}\n\n"
                f"_Для полной проверки .doc положите файл в `{SAMPLES}/manual.doc` и перезапустите скрипт._"
            )
            manual = SAMPLES / "manual.doc"
            if manual.is_file():
                rows = parse_doc_fn(str(manual))
                doc_case["file"] = str(manual)
                doc_case["rows"] = len(rows)
                body += f"\n\n### Ручной файл `manual.doc`\n\n{_rows_table(rows)}"
    except Exception as exc:
        body = f"Ошибка DOC: `{exc}`"
        doc_case["errors"] = [str(exc)]
    sections.append(_section("3. DOC — старый Word", body))
    meta["cases"].append(doc_case)

    # --- Excel ---
    xlsx_case: dict = {"format": "xlsx", "rows": 0}
    try:
        xlsx_path = _create_synthetic_xlsx()
        xlsx_case["file"] = str(xlsx_path)
        rows = get_parser(str(xlsx_path))(str(xlsx_path))
        xlsx_case["rows"] = len(rows)
        body = (
            f"**Модуль:** `parsers/excel_parser.py`\n\n"
            f"**Файл:** `{xlsx_path}`\n\n"
            f"**Строк:** {len(rows)}\n\n"
            f"### Исходник (фрагмент)\n\n```python\n{_read_excerpt(PARSER_SOURCES['excel'])}\n```\n\n"
            f"### Результат\n\n{_rows_table(rows)}"
        )
    except Exception as exc:
        body = f"Ошибка Excel: `{exc}`"
        xlsx_case["errors"] = [str(exc)]
    sections.append(_section("4. Excel (XLSX)", body))
    meta["cases"].append(xlsx_case)

    # --- HTML ---
    html_case: dict = {"format": "html", "rows": 0}
    html_sample = """
    <html><body><table>
    <tr><td>Общий анализ крови</td><td>2 500 ₸</td></tr>
    <tr><td>Глюкоза</td><td>1800 тг</td></tr>
    <tr><td>Креатинин</td><td>950 ₸</td></tr>
    </table></body></html>
    """
    html_path = SAMPLES / "synthetic_sample.html"
    html_path.write_text(html_sample, encoding="utf-8")
    items = parse_html_prices(html_sample, "https://example.kz/price")
    rows = [{"name": i.name, "price": i.price} for i in items]
    html_case["rows"] = len(rows)
    html_case["file"] = str(html_path)
    sections.append(_section(
        "5. HTML — таблицы на сайте",
        f"**Модуль:** `scrapers/html_prices.py`\n\n"
        f"**Файл:** `{html_path}`\n\n"
        f"**Строк:** {len(rows)}\n\n"
        f"### Исходник (фрагмент)\n\n```python\n{_read_excerpt(PARSER_SOURCES['html'])}\n```\n\n"
        f"### Результат\n\n{_rows_table(rows)}",
    ))
    meta["cases"].append(html_case)

    # --- Live scrapers summary ---
    live_lines = ["| Скрапер | Позиций | Ошибки | Примеры |", "|---|---:|---|---|"]
    for ScraperCls in (MedelicaScraper, AksayScraper):
        s = ScraperCls()
        try:
            r = s.scrape()
            samples = "; ".join(f"{i.name[:40]}={i.price}" for i in r.items[:3])
            errs = "; ".join(r.errors[:2]) if r.errors else "—"
            live_lines.append(f"| {s.source_id} | {len(r.items)} | {errs} | {samples} |")
        except Exception as exc:
            live_lines.append(f"| {s.source_id} | — | `{exc}` | — |")

    sections.append(_section(
        "6. Живые скраперы (HTML/API)",
        "\n".join(live_lines) + "\n",
    ))

    # --- get_parser routing ---
    sections.append(_section(
        "7. Маршрутизация форматов (`parsers/__init__.py`)",
        f"```python\n{_read_excerpt(BACKEND / 'parsers' / '__init__.py', 35)}\n```",
    ))

    report_text = "\n".join(sections)
    REPORT.write_text(report_text, encoding="utf-8")
    (LOGS / "parser_verification_report.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return REPORT


if __name__ == "__main__":
    out = run_report()
    print(f"Отчёт: {out}")
    print(f"Файлы: {SAMPLES}")
