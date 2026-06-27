import pdfplumber
import re
from typing import List, Dict, Any

# Строки-заголовки колонок PDF (Аксай и др.)
_JUNK_NAME_RE = re.compile(
    r"^\d+\s+(консультаци|прием|приём|исследован|посещени|осмотр|визит|манипуляци)",
    re.I,
)
_HEADER_RE = re.compile(
    r"^(итого|всего|наименование|№|код|цена|стоимость|раздел|примеч)",
    re.I,
)


def _clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", raw.replace("\n", " ")).strip()
    name = re.sub(r"^\d+[\.\)]\s*", "", name)
    return name


def _is_junk_name(name: str) -> bool:
    if not name or len(name) < 6:
        return True
    if _JUNK_NAME_RE.match(name):
        return True
    if _HEADER_RE.match(name):
        return True
    return False


def _parse_price_cell(cell: str) -> float | None:
    price_str = (
        cell.replace(" ", "")
        .replace(",", "")
        .replace("₸", "")
        .replace("тг", "")
        .replace("ТГ", "")
    )
    if re.match(r"^\d+(\.\d+)?$", price_str):
        return float(price_str)
    return None


def parse_pdf(filepath: str) -> List[Dict[str, Any]]:
    results: list[dict[str, Any]] = []
    last_good_name = ""

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row:
                        continue
                    row = [str(cell).strip() if cell else "" for cell in row]
                    price_str = row[-1]
                    price = _parse_price_cell(price_str)
                    if price is None:
                        continue
                    name_candidates = [_clean_name(c) for c in row[:-1] if c and len(c.strip()) > 2]
                    if not name_candidates:
                        continue
                    name = name_candidates[-1]
                    if _is_junk_name(name):
                        if last_good_name:
                            name = last_good_name
                        else:
                            continue
                    else:
                        last_good_name = name
                    if not _is_junk_name(name) and price >= 100:
                        results.append({"name": name, "price": price})

            text = page.extract_text()
            if not text:
                continue
            for line in text.split("\n"):
                line = line.strip()
                line = re.sub(r"(\d)\s*[ССООcC]\b", r"\g<1>0", line)
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
                    results.append({"name": name_part, "price": price})

    unique_results: list[dict[str, Any]] = []
    seen: set[tuple[str, float]] = set()
    for r in results:
        key = (r["name"], r["price"])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)

    return unique_results
