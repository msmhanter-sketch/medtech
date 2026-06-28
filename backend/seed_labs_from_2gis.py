"""
seed_labs_from_2gis.py — Создаёт/обновляет клиники-лаборатории на основе данных 2GIS.

Для каждой сети (Invitro, Helix, Invivo, KDL Olymp, KDL Lab, Olimp) и каждого
города Казахстана запрашивает 2GIS, находит реальные филиалы и создаёт клинику в БД.

Запускать: python seed_labs_from_2gis.py
"""
import asyncio
import sys
import time
import httpx
import logging

sys.path.insert(0, ".")
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import Clinic

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

DGIS_KEY = "491955a9-8c66-4efc-bd29-6a06cbe875df"
DGIS_SEARCH = "https://catalog.api.2gis.com/3.0/items"

# Города для поиска
KZ_CITIES = [
    "Алматы", "Астана", "Шымкент", "Караганда", "Актобе",
    "Павлодар", "Усть-Каменогорск", "Тараз", "Семей", "Актау",
    "Атырау", "Кокшетау", "Кызылорда", "Петропавловск", "Костанай",
    "Уральск", "Туркестан"
]

# Лабораторные сети: (2GIS search query, scraper source_id prefix, display name, logo_url, phone, website, rating)
LAB_NETWORKS = [
    {
        "query": "Invitro",
        "source_prefix": "invitro",
        "display_name": "INVITRO",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Invitro_logo.svg/320px-Invitro_logo.svg.png",
        "website_url": "https://invitro.kz",
        "phone": "+7 (727) 339-39-39",
        "rating": 4.7,
        "is_lab": True,
    },
    {
        "query": "Helix лаборатория",
        "source_prefix": "helix",
        "display_name": "Helix",
        "logo_url": "https://helix.ru/img/logo.png",
        "website_url": "https://helix.kz",
        "phone": "+7 (727) 311-93-13",
        "rating": 4.6,
        "is_lab": True,
    },
    {
        "query": "KDL ОЛИМП лаборатория",
        "source_prefix": "kdlolymp",
        "display_name": "KDL ОЛИМП",
        "logo_url": "https://kdlolymp.kz/icons/logo__desktop.svg",
        "website_url": "https://www.kdlolymp.kz",
        "phone": "+7 (727) 300-11-11",
        "rating": 4.5,
        "is_lab": True,
    },
    {
        "query": "Invivo лаборатория",
        "source_prefix": "invivo",
        "display_name": "Invivo",
        "logo_url": "",
        "website_url": "https://invivo.kz",
        "phone": "8 727 333 33 33",
        "rating": 4.3,
        "is_lab": True,
    },
    {
        "query": "Олимп лаборатория медицинская",
        "source_prefix": "olymp",
        "display_name": "Олимп",
        "logo_url": "",
        "website_url": "",
        "phone": "",
        "rating": 4.2,
        "is_lab": True,
    },
    {
        "query": "Медел лаборатория",
        "source_prefix": "medel",
        "display_name": "Medelica",
        "logo_url": "",
        "website_url": "https://medelica.kz",
        "phone": "",
        "rating": 4.3,
        "is_lab": True,
    },
]

CITY_SLUG_MAP = {
    "Алматы": "almaty",
    "Астана": "astana",
    "Шымкент": "shymkent",
    "Караганда": "karaganda",
    "Актобе": "aktobe",
    "Павлодар": "pavlodar",
    "Усть-Каменогорск": "ust-kamenogorsk",
    "Тараз": "taraz",
    "Семей": "semey",
    "Актау": "aktau",
    "Атырау": "atyrau",
    "Кокшетау": "kokshetau",
    "Кызылорда": "kyzylorda",
    "Петропавловск": "petropavlovsk",
    "Костанай": "kostanay",
    "Уральск": "oral",
    "Туркестан": "turkestan",
}


def search_2gis(query: str, city: str, page_size: int = 3) -> list[dict]:
    """Ищет организации в 2GIS по запросу и городу. Возвращает до page_size результатов."""
    full_query = f"{query} {city}"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                DGIS_SEARCH,
                params={
                    "q": full_query,
                    "type": "branch",
                    "fields": "items.point,items.name,items.address,items.address_name,items.contact_groups",
                    "key": DGIS_KEY,
                    "page_size": page_size,
                    "locale": "ru_KZ",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        log.warning("2GIS search failed for %r in %s: %s", query, city, exc)
        return []

    items = (data.get("result") or {}).get("items") or []
    results = []
    for item in items:
        point = item.get("point") or {}
        lat = point.get("lat")
        lon = point.get("lon")
        if lat is None or lon is None:
            continue
        # Extract phone from contact_groups if available
        phone = ""
        for cg in (item.get("contact_groups") or []):
            for contact in (cg.get("contacts") or []):
                if contact.get("type") == "phone" and contact.get("value"):
                    phone = contact["value"]
                    break
            if phone:
                break

        results.append({
            "name": item.get("name", ""),
            "address": item.get("address_name", ""),
            "latitude": lat,
            "longitude": lon,
            "phone": phone,
        })
    return results


async def upsert_clinic(db, *, source_id: str, name: str, city: str, address: str,
                        latitude: float, longitude: float, phone: str,
                        website_url: str, logo_url: str, rating: float) -> bool:
    """Creates or updates a clinic. Returns True if created, False if updated."""
    existing = await db.scalar(
        select(Clinic).where(Clinic.source_id == source_id)
    )
    if existing:
        existing.name = name
        existing.city = city
        existing.address = address
        existing.latitude = latitude
        existing.longitude = longitude
        if phone:
            existing.phone = phone
        if website_url:
            existing.website_url = website_url
        if logo_url:
            existing.logo_url = logo_url
        existing.rating = rating
        existing.is_active = True
        return False
    else:
        db.add(Clinic(
            source_id=source_id,
            name=name,
            city=city,
            address=address,
            latitude=latitude,
            longitude=longitude,
            phone=phone,
            website_url=website_url,
            logo_url=logo_url,
            rating=rating,
            is_active=True,
        ))
        return True


async def main():
    created_total = 0
    updated_total = 0

    async with AsyncSessionLocal() as db:
        for network in LAB_NETWORKS:
            log.info("=== Сеть: %s ===", network["display_name"])
            for city in KZ_CITIES:
                city_slug = CITY_SLUG_MAP.get(city, city.lower())
                source_id = f"{network['source_prefix']}_{city_slug}"

                # Search 2GIS
                branches = search_2gis(network["query"], city, page_size=1)
                time.sleep(0.3)  # be polite to 2GIS API

                if not branches:
                    log.info("  %s — %s: не найдено в 2GIS, пропускаем", network["display_name"], city)
                    continue

                branch = branches[0]
                clinic_name = f"{network['display_name']} — {city}"

                created = await upsert_clinic(
                    db,
                    source_id=source_id,
                    name=clinic_name,
                    city=city,
                    address=f"г. {city}, {branch['address']}",
                    latitude=branch["latitude"],
                    longitude=branch["longitude"],
                    phone=branch.get("phone") or network["phone"],
                    website_url=network["website_url"],
                    logo_url=network["logo_url"],
                    rating=network["rating"],
                )

                if created:
                    created_total += 1
                    log.info("  ✅ Создана: %s (%s) — %s", clinic_name, city, branch["address"])
                else:
                    updated_total += 1
                    log.info("  🔄 Обновлена: %s (%s)", clinic_name, city)

        await db.commit()

    log.info("\n=== Итого: создано %d, обновлено %d клиник ===", created_total, updated_total)


if __name__ == "__main__":
    asyncio.run(main())
