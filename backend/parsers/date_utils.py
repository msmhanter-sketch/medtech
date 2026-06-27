"""Извлечение даты актуальности прайса из текста, HTTP-заголовков и метаданных."""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Optional

# «действует с 01.03.2025», «от 15/06/2024», «актуален на 2025-06-01»
_DATE_PATTERNS = [
    re.compile(
        r"(?:действ(?:ует|ительн)|актуал(?:ен|ьн)|от|на|с|по)\s*(?:с\s*)?"
        r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})",
        re.I,
    ),
    re.compile(r"(\d{4}[./\-]\d{1,2}[./\-]\d{1,2})"),
    re.compile(r"(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})"),
]

_MONTH_RU = {
    "январ": 1, "феврал": 2, "март": 3, "апрел": 4, "мая": 5, "май": 5,
    "июн": 6, "июл": 7, "август": 8, "сентябр": 9, "октябр": 10,
    "ноябр": 11, "декабр": 12,
}


def _parse_dmy(s: str) -> Optional[date]:
    s = s.strip().replace("-", ".").replace("/", ".")
    parts = s.split(".")
    if len(parts) != 3:
        return None
    try:
        if len(parts[0]) == 4:  # YYYY-MM-DD
            y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        else:
            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
            if y < 100:
                y += 2000
        return date(y, m, d)
    except (ValueError, TypeError):
        return None


def extract_date_from_text(text: str, max_chars: int = 8000) -> Optional[date]:
    if not text:
        return None
    sample = text[:max_chars]
    for pat in _DATE_PATTERNS:
        m = pat.search(sample)
        if m:
            parsed = _parse_dmy(m.group(1))
            if parsed and parsed.year >= 2020:
                return parsed
    low = sample.lower()
    for prefix, month_num in _MONTH_RU.items():
        m = re.search(rf"{prefix}[а-я]*\s+20(\d{{2}})", low)
        if m:
            return date(2000 + int(m.group(1)), month_num, 1)
    return None


def extract_date_from_http_headers(headers: dict) -> Optional[date]:
    for key in ("last-modified", "date"):
        raw = headers.get(key) or headers.get(key.title())
        if not raw:
            continue
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo:
                dt = dt.astimezone(timezone.utc)
            return dt.date()
        except (TypeError, ValueError, IndexError):
            continue
    return None


def extract_date_from_pdf_metadata(meta: dict) -> Optional[date]:
    for key in ("ModDate", "CreationDate", "modDate", "creationDate"):
        raw = meta.get(key) if meta else None
        if not raw or not isinstance(raw, str):
            continue
        # D:20250615120000+05'00'
        m = re.search(r"(\d{4})(\d{2})(\d{2})", raw)
        if m:
            try:
                return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except ValueError:
                pass
    return None


def extract_date_from_url(url: str) -> Optional[date]:
    """Дата из пути/имени файла: /2025/06/..., 2025-06-01, на-2025-год."""
    if not url:
        return None
    low = url.lower()
    m = re.search(r"/(20\d{2})/(\d{1,2})/", low)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), 1)
        except ValueError:
            pass
    m = re.search(r"(20\d{2})[._\-](\d{1,2})[._\-](\d{1,2})", low)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    m = re.search(r"на[-_ ]?(20\d{2})[-_ ]?год", low)
    if m:
        return date(int(m.group(1)), 1, 1)
    return None


def best_document_date(
    *,
    text: str | None = None,
    headers: dict | None = None,
    pdf_meta: dict | None = None,
    url: str | None = None,
    fallback: date | None = None,
) -> date:
    """Приоритет: текст → URL → PDF meta → HTTP → fallback → сегодня."""
    for candidate in (
        extract_date_from_text(text or ""),
        extract_date_from_url(url or ""),
        extract_date_from_pdf_metadata(pdf_meta or {}),
        extract_date_from_http_headers(headers or {}),
        fallback,
    ):
        if candidate is not None:
            return candidate
    return datetime.now(timezone.utc).date()
