"""Нормализация и геокодирование адресов клиник."""
from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx

log = logging.getLogger(__name__)

DGIS_API_KEY = os.getenv("DGIS_API_KEY", "491955a9-8c66-4efc-bd29-6a06cbe875df")
GEOCODE_URL = "https://catalog.api.2gis.com/3.0/items/geocode"

_GENERIC_PATTERNS = (
    r"агрегатор",
    r"онлайн",
    r"сеть\s+(лабораторий|клиник)",
    r"филиальная\s+сеть",
    r"по\s+рк$",
    r"^г\.\s*\w+,?\s*сеть\b",
)


def is_generic_address(address: str | None) -> bool:
    if not address or len(address.strip()) < 8:
        return True
    low = address.lower().strip()
    return any(re.search(p, low) for p in _GENERIC_PATTERNS)


def format_kz_address(city: str, raw: str) -> str:
    """Единый формат: «г. Город, улица, дом»."""
    if not raw:
        return f"г. {city}"
    text = re.sub(r"\s+", " ", raw.replace("\u200b", "").strip())
    low = text.lower()
    city_low = city.lower()
    if city_low in low and text.lower().startswith("г."):
        return text
    if city_low in low:
        return f"г. {text}" if not text.lower().startswith("г.") else text
    # DOQ часто отдаёт «ул. X, 258А» без города
    if re.match(r"^(ул\.|пр\.|мкр\.|микрорайон|проспект|бульвар)", low):
        return f"г. {city}, {text}"
    return f"г. {city}, {text}"


def geocode_address_sync(city: str, address: str) -> dict[str, Any] | None:
    """2GIS геокодинг (sync, для ingest)."""
    if not DGIS_API_KEY or is_generic_address(address):
        return None
    query = address if city.lower() in address.lower() else f"{city}, {address}"
    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.get(
                GEOCODE_URL,
                params={"q": query, "fields": "items.point,items.full_name", "key": DGIS_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        log.debug("geocode skip %s: %s", query, exc)
        return None

    items = (data.get("result") or {}).get("items") or []
    if not items:
        return None
    item = items[0]
    point = item.get("point") or {}
    lat, lon = point.get("lat"), point.get("lon")
    if lat is None or lon is None:
        return None
    return {
        "address": item.get("full_name") or address,
        "latitude": lat,
        "longitude": lon,
    }


def enrich_clinic_meta(meta: dict[str, Any]) -> dict[str, Any]:
    """Нормализует адрес; при необходимости уточняет координаты через 2GIS."""
    city = meta.get("city") or ""
    address = meta.get("address") or ""
    if address:
        meta["address"] = format_kz_address(city, address)

    has_coords = meta.get("latitude") is not None and meta.get("longitude") is not None
    if has_coords and not is_generic_address(meta["address"]):
        return meta

    if is_generic_address(meta["address"]):
        return meta

    geo = geocode_address_sync(city, meta["address"])
    if geo:
        meta["address"] = geo["address"]
        meta["latitude"] = geo["latitude"]
        meta["longitude"] = geo["longitude"]
    return meta
