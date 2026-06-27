"""Парсер старых Word-файлов (.doc, OLE)."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from parsers.docx_parser import parse_docx
from parsers.price_text import parse_price_lines


def _find_libreoffice() -> str | None:
    for name in ("soffice", "soffice.exe"):
        found = shutil.which(name)
        if found:
            return found
    for path in (
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ):
        if os.path.isfile(path):
            return path
    return None


def _convert_doc_to_docx(doc_path: str) -> tuple[str | None, str | None]:
    """LibreOffice: .doc → .docx. Возвращает (путь, метод)."""
    soffice = _find_libreoffice()
    if not soffice:
        return None, None
    outdir = tempfile.mkdtemp(prefix="medprice_doc_")
    try:
        proc = subprocess.run(
            [soffice, "--headless", "--convert-to", "docx", "--outdir", outdir, doc_path],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if proc.returncode != 0:
            return None, f"libreoffice:{proc.stderr[:200]}"
        docx_path = Path(outdir) / f"{Path(doc_path).stem}.docx"
        if docx_path.is_file():
            return str(docx_path), "libreoffice"
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, f"libreoffice:{exc}"
    return None, None


def _extract_with_antiword(doc_path: str) -> tuple[str | None, str | None]:
    for cmd in ("antiword", "catdoc"):
        exe = shutil.which(cmd)
        if not exe:
            continue
        try:
            proc = subprocess.run(
                [exe, doc_path],
                capture_output=True,
                timeout=60,
            )
            if proc.returncode == 0 and proc.stdout:
                text = proc.stdout.decode("utf-8", errors="replace")
                if text.strip():
                    return text, cmd
        except (OSError, subprocess.TimeoutExpired):
            continue
    return None, None


def _extract_ole_text(doc_path: str) -> str:
    """Грубое извлечение UTF-16/ASCII строк из бинарного .doc."""
    raw = Path(doc_path).read_bytes()
    chunks: list[str] = []

    for match in re.finditer(rb"(?:[\x20-\x7e]\x00){6,}", raw):
        try:
            chunks.append(match.group().decode("utf-16le"))
        except UnicodeDecodeError:
            pass

    for match in re.finditer(rb"[\x20-\x7e\xc0-\xff]{12,}", raw):
        try:
            text = match.group().decode("cp1251", errors="ignore")
            if re.search(r"[а-яА-Я]", text):
                chunks.append(text)
        except UnicodeDecodeError:
            pass

    return "\n".join(chunks)


def parse_doc(filepath: str) -> list[dict[str, Any]]:
    """
    .doc: LibreOffice → docx → таблицы; иначе antiword/catdoc; иначе OLE-текст.
    """
    errors: list[str] = []

    docx_path, method = _convert_doc_to_docx(filepath)
    if docx_path:
        rows = parse_docx(docx_path)
        if rows:
            return rows
        errors.append(f"{method}: docx empty")

    text, tool = _extract_with_antiword(filepath)
    if text:
        rows = parse_price_lines(text)
        if rows:
            return rows
        errors.append(f"{tool}: no price rows in text")

    ole_text = _extract_ole_text(filepath)
    if ole_text:
        rows = parse_price_lines(ole_text)
        if rows:
            return rows
        errors.append("ole: no price rows in extracted text")

    if errors:
        print(f"parse_doc({filepath}): {'; '.join(errors)}")
    return []
