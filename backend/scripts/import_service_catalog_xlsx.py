"""Import the official service reference workbook into the local catalog.

Usage:
    python scripts/import_service_catalog_xlsx.py "C:\\Users\\...\\Справочник услуг (3).xlsx"
"""
import argparse
import asyncio
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.models import Service, ServiceCategory

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

CATEGORY_META = {
    "analizy": {
        "name": "Лабораторные анализы",
        "icon_name": "flask-conical",
        "sort_order": 1,
    },
    "mrt": {"name": "МРТ", "icon_name": "scan", "sort_order": 2},
    "uzi": {"name": "УЗИ", "icon_name": "activity", "sort_order": 3},
    "diagnostika": {
        "name": "Диагностика",
        "icon_name": "heart-pulse",
        "sort_order": 4,
    },
    "priyom-vracha": {
        "name": "Приём врача",
        "icon_name": "stethoscope",
        "sort_order": 5,
    },
    "pricelist": {
        "name": "Услуги из прайсов",
        "icon_name": "file-text",
        "sort_order": 7,
    },
}


def _cell_index(cell_ref: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_ref.upper())
    result = 0
    for char in letters:
        result = result * 26 + (ord(char) - ord("A") + 1)
    return result - 1


def _read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    strings: list[str] = []
    for item in root.findall("main:si", NS):
        parts = [node.text or "" for node in item.findall(".//main:t", NS)]
        strings.append("".join(parts))
    return strings


def _first_sheet_path(zf: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    first_sheet = workbook.find("main:sheets/main:sheet", NS)
    if first_sheet is None:
        raise ValueError("Workbook does not contain sheets")

    rel_id = first_sheet.attrib[f"{{{NS['rel']}}}id"]
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    for rel in rels.findall("pkgrel:Relationship", NS):
        if rel.attrib["Id"] == rel_id:
            target = rel.attrib["Target"].lstrip("/")
            return f"xl/{target}" if not target.startswith("xl/") else target
    raise ValueError("Could not resolve first worksheet path")


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", NS)).strip()

    value = cell.find("main:v", NS)
    if value is None or value.text is None:
        return ""

    raw = value.text.strip()
    if cell_type == "s":
        return shared_strings[int(raw)].strip()
    return raw


def read_xlsx_rows(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as zf:
        shared_strings = _read_shared_strings(zf)
        sheet_path = _first_sheet_path(zf)
        root = ET.fromstring(zf.read(sheet_path))

    rows: list[list[str]] = []
    for row in root.findall(".//main:sheetData/main:row", NS):
        values: list[str] = []
        for cell in row.findall("main:c", NS):
            idx = _cell_index(cell.attrib.get("r", "A1"))
            while len(values) <= idx:
                values.append("")
            values[idx] = _cell_value(cell, shared_strings)
        rows.append(values)

    if not rows:
        return []

    headers = [header.strip() for header in rows[0]]
    result: list[dict[str, str]] = []
    for row in rows[1:]:
        item = {headers[i]: row[i].strip() if i < len(row) else "" for i in range(len(headers))}
        if item.get("Name_ru"):
            result.append(item)
    return result


def infer_category_slug(name: str, specialty: str) -> str:
    text = f"{name} {specialty}".lower()
    if "мрт" in text:
        return "mrt"
    if "узи" in text or "ультразв" in text:
        return "uzi"
    if any(token in text for token in ["прием", "приём", "консультац"]):
        return "priyom-vracha"
    if any(token in text for token in ["анализ", "кров", "моч", "мазок", "посев", "пцр"]):
        return "analizy"
    if any(token in text for token in ["кт", "рентген", "экг", "эхо", "фгдс", "эндоскоп"]):
        return "diagnostika"
    return "pricelist"


async def ensure_categories(db) -> dict[str, ServiceCategory]:
    result = await db.execute(select(ServiceCategory))
    categories = {cat.slug: cat for cat in result.scalars().all()}
    for slug, meta in CATEGORY_META.items():
        if slug not in categories:
            category = ServiceCategory(slug=slug, **meta)
            db.add(category)
            await db.flush()
            categories[slug] = category
    return categories


async def import_catalog(path: Path, dry_run: bool = False) -> dict[str, int]:
    rows = read_xlsx_rows(path)
    stats = {"rows": len(rows), "inserted": 0, "updated": 0, "skipped": 0}

    async with AsyncSessionLocal() as db:
        categories = await ensure_categories(db)
        for row in rows:
            name = row.get("Name_ru", "").strip()
            specialty = row.get("Специальность", "").strip()
            code = row.get("Code", "").strip()
            tarificator_code = row.get("TarificatrCode", "").strip()

            if not name:
                stats["skipped"] += 1
                continue

            slug = infer_category_slug(name, specialty)
            category = categories[slug]
            aliases = [value for value in [specialty, code, tarificator_code] if value]
            description = (
                f"Справочник услуг: {specialty or 'без специальности'}; "
                f"Code: {code or '-'}; TarificatrCode: {tarificator_code or '-'}"
            )

            result = await db.execute(
                select(Service).where(Service.category_id == category.id, Service.name == name)
            )
            service = result.scalar_one_or_none()
            if service:
                service.description = description
                service.aliases = json.dumps(aliases, ensure_ascii=False)
                service.is_active = True
                stats["updated"] += 1
            else:
                db.add(
                    Service(
                        category_id=category.id,
                        name=name,
                        aliases=json.dumps(aliases, ensure_ascii=False),
                        description=description,
                        is_active=True,
                    )
                )
                stats["inserted"] += 1

        if dry_run:
            await db.rollback()
        else:
            await db.commit()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Import service reference .xlsx into services")
    parser.add_argument("path", type=Path, help="Path to Справочник услуг .xlsx")
    parser.add_argument("--dry-run", action="store_true", help="Read and validate without DB commit")
    args = parser.parse_args()

    stats = asyncio.run(import_catalog(args.path, args.dry_run))
    mode = "dry-run" if args.dry_run else "committed"
    print(f"{mode}: {stats}")


if __name__ == "__main__":
    main()
