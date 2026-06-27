"""Универсальный извлекатель цен из HTML-страниц (таблицы и строки)."""
from __future__ import annotations

import re
from html import unescape

from scrapers.base import ScrapedPrice
from scrapers.validate import filter_scraped_items

_PRICE_RE = re.compile(
    r"([\d\s\u00a0]{2,12})\s*(?:₸|тг\.?|KZT|тенге)",
    re.I,
)
_ROW_RE = re.compile(
    r"^(.*?)\s+([\d\s\u00a0]{2,10})\s*(?:₸|тг\.?|KZT|тенге)\s*$",
    re.I | re.M,
)
_JUNK = re.compile(
    r"^(итого|всего|наименование|№|код|цена|стоимость|раздел|phone|tel:|http)",
    re.I,
)


def _strip_html(html: str) -> str:
    text = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</tr>", "\n", text, flags=re.I)
    text = re.sub(r"</t[dh]>", " | ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    lines = []
    for line in text.split("\n"):
        lines.append(re.sub(r"[ \t]+", " ", line).strip())
    return "\n".join(line for line in lines if line)


def _parse_price_num(raw: str) -> int | None:
    digits = re.sub(r"\D", "", raw.replace("\xa0", " "))
    if not digits:
        return None
    val = int(digits)
    if val < 100 or val > 5_000_000:
        return None
    return val


def parse_html_prices(html: str, source_url: str) -> list[ScrapedPrice]:
    items: list[ScrapedPrice] = []
    seen: set[tuple[str, int]] = set()

    # Таблицы: ячейки через |
    for row in _strip_html(html).split("\n"):
        row = row.strip()
        if not row or "|" not in row:
            continue
        cells = [c.strip() for c in row.split("|") if c.strip()]
        if len(cells) < 2:
            continue
        price_val = _parse_price_num(cells[-1])
        if price_val is None:
            for cell in reversed(cells):
                price_val = _parse_price_num(cell)
                if price_val:
                    break
        if price_val is None:
            continue
        name = cells[-2] if len(cells) >= 2 else cells[0]
        name = re.sub(r"\s+", " ", name).strip()
        if len(name) < 4 or _JUNK.match(name):
            continue
        key = (name, price_val)
        if key in seen:
            continue
        seen.add(key)
        items.append(ScrapedPrice(name=name, price=price_val, source_url=source_url))

    # Строки «Название .... 12 500 ₸»
    plain = re.sub(r"<[^>]+>", "\n", html)
    for line in plain.split("\n"):
        line = re.sub(r"\s+", " ", unescape(line)).strip()
        m = _ROW_RE.match(line)
        if not m:
            continue
        name = m.group(1).strip()
        price_val = _parse_price_num(m.group(2))
        if not name or not price_val or len(name) < 4 or _JUNK.match(name):
            continue
        key = (name, price_val)
        if key in seen:
            continue
        seen.add(key)
        items.append(ScrapedPrice(name=name, price=price_val, source_url=source_url))

    # JSON-LD / data-price в разметке
    for name, price_str in re.findall(
        r'"title"\s*:\s*"([^"]{4,200})"[^}]{0,400}?"price"\s*:\s*(\d+)',
        html,
    ):
        price_val = int(price_str)
        if price_val < 100:
            continue
        key = (name, price_val)
        if key in seen:
            continue
        seen.add(key)
        items.append(ScrapedPrice(name=name, price=price_val, source_url=source_url))

    filtered, _ = filter_scraped_items(items)
    return filtered
