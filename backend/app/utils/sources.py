"""Метаданные официальных источников прайсов (парсер / сайт клиники)."""
from __future__ import annotations

from typing import Optional

# Реестр парсеров хакатона — id → официальный сайт
OFFICIAL_SOURCES: dict[str, dict[str, str]] = {
    "invitro": {"label": "INVITRO", "url": "https://invitro.kz", "type": "parser"},
    "helix": {"label": "Helix", "url": "https://helix.kz", "type": "parser"},
    "kdl": {"label": "KDL", "url": "https://kdl.kz", "type": "parser"},
    "kdlolymp": {"label": "KDL Olymp", "url": "https://kdlolymp.kz", "type": "parser"},
    "olymp": {"label": "Olymp", "url": "https://olymp.kz", "type": "parser"},
    "doq": {"label": "DOQ", "url": "https://doq.kz", "type": "parser"},
    "medelica": {"label": "Medelica", "url": "https://medelica.kz", "type": "parser"},
    "aksay": {"label": "Aksay", "url": "https://aksay.kaznmu.edu.kz", "type": "parser"},
    "mck": {"label": "MCK", "url": "https://mck.kz", "type": "parser"},
    "invivo": {"label": "Invivo", "url": "https://invivo.kz", "type": "parser"},
    "idoctor": {"label": "iDoctor", "url": "https://idoctor.kz", "type": "parser"},
    "sunkar": {"label": "Sunkar", "url": "https://sunkar.kz", "type": "parser"},
}


def detect_parser_source(source_file: Optional[str]) -> Optional[str]:
    if not source_file:
        return None
    low = source_file.lower()
    for key in OFFICIAL_SOURCES:
        if key in low:
            return key
    return None


def build_source_meta(
    source_file: Optional[str],
    website_url: Optional[str],
    source_name: Optional[str] = None,
) -> dict:
    """Собирает нормативные поля источника для UI."""
    parser_id = detect_parser_source(source_file)
    if parser_id and parser_id in OFFICIAL_SOURCES:
        meta = OFFICIAL_SOURCES[parser_id]
        return {
            "parser_id": parser_id,
            "parser_label": meta["label"],
            "official_url": meta["url"],
            "source_type": "official_parser",
            "raw_source_file": source_file,
            "raw_name_on_site": source_name,
        }
    if website_url:
        return {
            "parser_id": None,
            "parser_label": None,
            "official_url": website_url,
            "source_type": "clinic_website",
            "raw_source_file": source_file,
            "raw_name_on_site": source_name,
        }
    return {
        "parser_id": parser_id,
        "parser_label": parser_id,
        "official_url": source_file if source_file and source_file.startswith("http") else None,
        "source_type": "file" if source_file else "unknown",
        "raw_source_file": source_file,
        "raw_name_on_site": source_name,
    }
