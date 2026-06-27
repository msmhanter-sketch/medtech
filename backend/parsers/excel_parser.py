import re
from typing import Any

import pandas as pd


def _parse_number(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    raw = str(value).strip().lower()
    raw = raw.replace("\xa0", " ").replace("₸", "").replace("тг", "").replace("kzt", "")
    raw = raw.replace(" ", "").replace(",", ".")
    if not re.match(r"^\d+(\.\d+)?$", raw):
        return None
    num = float(raw)
    if num < 50 or num > 5_000_000:
        return None
    return num


def _is_header_row(row_values: list) -> bool:
    joined = " ".join(str(v).lower() for v in row_values if pd.notna(v))
    return "наименование" in joined or "название услуги" in joined


def _name_column_index(row_values: list) -> int:
    for idx, val in enumerate(row_values):
        if pd.isna(val):
            continue
        low = str(val).lower()
        if "наименование" in low or low in ("название", "название услуги"):
            return idx
    return 1


def _is_section_header(name: str) -> bool:
    if re.match(r"^\d+\.\s+[А-Яа-яA-Za-z\s\-]{2,40}$", name.strip()):
        return True
    if name.strip().lower() in {"итого", "всего", "раздел", "примечание"}:
        return True
    return False


def parse_excel(filepath: str) -> list[dict[str, Any]]:
    """Извлекает пары (название, цена) из Excel-прайсов клиник."""
    results: list[dict[str, Any]] = []
    seen: set[tuple[str, float]] = set()

    try:
        sheets = pd.read_excel(filepath, sheet_name=None, header=None)
    except Exception as exc:
        print(f"Error parsing excel {filepath}: {exc}")
        return results

    for _sheet_name, df in sheets.items():
        header_idx: int | None = None
        name_col = 1

        for i in range(min(30, len(df))):
            row_vals = list(df.iloc[i].values)
            if _is_header_row(row_vals):
                header_idx = i
                name_col = _name_column_index(row_vals)
                break

        start_row = (header_idx + 2) if header_idx is not None else 0

        for i in range(start_row, len(df)):
            row = df.iloc[i]
            row_vals = list(row.values)

            if name_col >= len(row_vals) or pd.isna(row_vals[name_col]):
                continue

            name = str(row_vals[name_col]).strip().replace("\n", " ")
            if len(name) < 4 or _is_section_header(name):
                continue

            prices: list[float] = []
            for cell in row_vals:
                parsed = _parse_number(cell)
                if parsed is not None:
                    prices.append(parsed)

            if not prices:
                continue

            price = min(prices)
            key = (name, price)
            if key in seen:
                continue
            seen.add(key)
            results.append({"name": name, "price": price})

    return results
