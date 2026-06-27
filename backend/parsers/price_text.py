"""Извлечение пар (название, цена) из plain-text прайсов."""
from __future__ import annotations

import re
from typing import Any

from parsers.pdf_parser import _clean_name, _is_junk_name, _parse_price_cell


def parse_price_lines(text: str) -> list[dict[str, Any]]:
    """Строки вида «Название услуги 12 500» или «Название | 12500 тг»."""
    results: list[dict[str, Any]] = []
    seen: set[tuple[str, float]] = set()
    last_good_name = ""

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = re.sub(r"(\d)\s*[ССООcC]\b", r"\g<1>0", line)

        # Табличная строка через |
        if "|" in line:
            cells = [c.strip() for c in line.split("|") if c.strip()]
            if len(cells) >= 2:
                price = _parse_price_cell(cells[-1])
                if price is not None:
                    name = _clean_name(cells[-2])
                    if not _is_junk_name(name) and price >= 100:
                        key = (name, price)
                        if key not in seen:
                            seen.add(key)
                            results.append({"name": name, "price": price})
                    continue

        match = re.search(r"^(.*?)\s+((?:\d+\s*)+\d*)\s*(?:₸|тг\.?|KZT|тенге)?\s*$", line, re.I)
        if not match:
            match = re.search(r"^(.*?)\s+((?:\d+\s*)+\d*)$", line)
        if not match:
            continue

        name_part = _clean_name(match.group(1))
        price_part = match.group(2).replace(" ", "")
        if not re.match(r"^\d+$", price_part):
            continue
        price = float(price_part)

        if _is_junk_name(name_part):
            if last_good_name:
                name_part = last_good_name
            else:
                continue
        elif len(name_part) > 5:
            last_good_name = name_part

        if len(name_part) > 5 and price >= 100:
            key = (name_part, price)
            if key not in seen:
                seen.add(key)
                results.append({"name": name_part, "price": price})

    return results
