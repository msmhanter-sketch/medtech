"""2GIS API: геокодинг и ссылки на маршруты (development key from Platform Manager)."""
import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dgis", tags=["2gis"])

DGIS_API_KEY = os.getenv(
    "DGIS_API_KEY",
    "491955a9-8c66-4efc-bd29-6a06cbe875df",
)
GEOCODE_URL = "https://catalog.api.2gis.com/3.0/items/geocode"


def build_route_url(lon: float, lat: float, city_slug: str = "almaty", transport: str = "car") -> str:
    """Веб-ссылка на построение маршрута (lon,lat — порядок 2GIS)."""
    return f"https://2gis.kz/{city_slug}/directions/tab/{transport}/points/|{lon},{lat}"


def build_app_deeplink(lon: float, lat: float, transport: str = "car") -> str:
    return f"dgis://2gis.ru/routeSearch/rsType/{transport}/to/{lon},{lat}"


def city_to_slug(city: str) -> str:
    mapping = {
        "алматы": "almaty",
        "астана": "astana",
        "шымкент": "shymkent",
        "караганда": "karaganda",
        "актобе": "aktobe",
        "павлодар": "pavlodar",
        "усть-каменогорск": "ust-kamenogorsk",
        "атырау": "atyrau",
        "семей": "semey",
        "тараз": "taraz",
        "кызылорда": "kyzylorda",
        "актау": "aktau",
        "petropavlovsk": "petropavlovsk",
        "костанай": "kostanay",
        "kostanay": "kostanay",
        "уральск": "oral",
        "oral": "oral",
        "туркестан": "turkestan",
        "turkestan": "turkestan",
    }
    return mapping.get(city.strip().lower(), "almaty")


@router.get("/route-link", summary="Ссылка на маршрут в 2GIS")
async def route_link(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    city: str = Query("Алматы"),
):
    slug = city_to_slug(city)
    return {
        "web_url": build_route_url(lon, lat, slug),
        "app_deeplink": build_app_deeplink(lon, lat),
        "city_slug": slug,
    }


@router.get("/geocode", summary="Геокодинг адреса через 2GIS API")
async def geocode(
    q: str = Query(..., min_length=3, description="Адрес или «город, улица»"),
    city: str | None = Query(None, description="Город для уточнения запроса"),
):
    if not DGIS_API_KEY:
        raise HTTPException(status_code=503, detail="DGIS_API_KEY не настроен")

    query = f"{city}, {q}" if city and city.lower() not in q.lower() else q
    params = {
        "q": query,
        "fields": "items.point,items.full_name",
        "key": DGIS_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(GEOCODE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        log.warning("2GIS geocode failed: %s", exc)
        raise HTTPException(status_code=502, detail="2GIS API недоступен") from exc

    meta = data.get("meta") or {}
    if meta.get("error"):
        raise HTTPException(status_code=400, detail=meta["error"].get("message", "Ошибка 2GIS"))

    items: list[dict[str, Any]] = data.get("result", {}).get("items") or []
    if not items:
        return {"query": query, "results": []}

    results = []
    for item in items[:5]:
        point = item.get("point") or {}
        lon = point.get("lon")
        lat = point.get("lat")
        if lon is None or lat is None:
            continue
        results.append({
            "name": item.get("full_name") or item.get("name"),
            "lat": lat,
            "lon": lon,
            "route_url": build_route_url(lon, lat, city_to_slug(city or "Алматы")),
        })
    return {"query": query, "results": results}
