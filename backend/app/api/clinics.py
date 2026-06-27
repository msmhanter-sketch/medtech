"""
app/api/clinics.py — Роутер сравнения клиник по услуге.

Эндпоинты:
  GET /api/clinics/compare  — ядро продукта: сравнение клиник по услуге
  GET /api/clinics/         — список всех клиник
  GET /api/clinics/{id}     — карточка одной клиники
"""
import json
import logging
from datetime import date, timedelta
from decimal import Decimal
from enum import Enum
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis_client import get_redis, is_redis_available
from app.models.models import Clinic, ParsedPriceRow, PriceItem, Service
from app.schemas.clinic import ClinicInCompare, ClinicPriceItem, ClinicRead, CompareResponse, ServiceRead
from app.utils.sources import build_source_meta

log = logging.getLogger(__name__)

# Национальные сети: единый прайс, показываем во всех городах
NATIONAL_LAB_NAMES = ("INVITRO", "HELIX")

router = APIRouter(prefix="/api/clinics", tags=["clinics"])

# Кэш сравнения: 5 минут (цены обновляются редко)
COMPARE_CACHE_TTL = 300

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    if None in (lat1, lon1, lat2, lon2):
        return float('inf')
    R = 6371.0 # radius of earth in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c



class SortOrder(str, Enum):
    """Допустимые варианты сортировки для эндпоинта сравнения."""
    price_asc = "price_asc"
    price_desc = "price_desc"
    rating_desc = "rating_desc"
    name_asc = "name_asc"
    distance_asc = "distance_asc"
    date_desc = "date_desc"


# ─── GET /api/clinics/compare ──────────────────────────────────────────────────

@router.get(
    "/compare",
    response_model=CompareResponse,
    summary="Сравнение клиник по выбранной услуге",
    description=(
        "Ключевой эндпоинт продукта. Возвращает список клиник, "
        "которые предлагают данную услугу, с ценами и сортировкой. "
        "Обязательные параметры: `service_id` и `city`. "
        "Результат кэшируется в Redis на 5 минут."
    ),
)
async def compare_clinics(
    db: Annotated[AsyncSession, Depends(get_db)],
    service_id: int = Query(..., description="ID услуги из /api/services/"),
    city: str = Query(
        ...,
        min_length=2,
        max_length=100,
        description="Город: 'Астана' или 'Алматы'",
        examples=["Астана"],
    ),
    sort: SortOrder = Query(
        default=SortOrder.price_asc,
        description="Сортировка: price_asc | price_desc | rating_desc | name_asc",
    ),
    min_price: Optional[Decimal] = Query(None, ge=0, description="Минимальная цена в KZT"),
    max_price: Optional[Decimal] = Query(None, ge=0, description="Максимальная цена в KZT"),
    verified_only: bool = Query(False, description="Только верифицированные цены"),
    max_age_days: int = Query(30, ge=1, le=365, description="Максимальный возраст цены в днях"),
    user_lat: Optional[float] = Query(None, description="Широта пользователя"),
    user_lon: Optional[float] = Query(None, description="Долгота пользователя"),
) -> CompareResponse:
    """
    Алгоритм:
    1. Проверяем кэш Redis (ключ зависит от всех параметров)
    2. JOIN: Clinic ← PriceItem → Service с фильтрами
    3. Вычисляем is_cheapest (флаг минимальной цены)
    4. Пишем результат в кэш
    5. Возвращаем CompareResponse
    """
    # Формируем уникальный ключ кэша из всех параметров запроса
    cache_key = (
        f"compare:svc={service_id}:city={city}:sort={sort.value}"
        f":min={min_price}:max={max_price}:verified={verified_only}:age={max_age_days}"
        f":lat={user_lat}:lon={user_lon}"
    )

    # ── Попытка взять из кэша ──────────────────────────────────────────────
    if is_redis_available():
        try:
            redis = await get_redis()
            cached = await redis.get(cache_key)
            if cached:
                log.debug(f"compare: cache HIT [{cache_key}]")
                return CompareResponse(**json.loads(cached))
        except Exception as exc:
            log.warning(f"Redis get failed: {exc}")

    # ── Проверяем существование услуги ────────────────────────────────────
    svc_result = await db.execute(select(Service).where(Service.id == service_id))
    service = svc_result.scalar_one_or_none()
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Услуга с id={service_id} не найдена.",
        )

    # ── Строим основной JOIN-запрос ────────────────────────────────────────
    # Берём последний прайс для каждой клиники (MAX price_date)
    # через подзапрос, чтобы избежать дублей при исторических данных
    cutoff_date = date.today() - timedelta(days=max_age_days)

    latest_price_subq = (
        select(
            PriceItem.clinic_id,
            func.max(PriceItem.price_date).label("latest_date"),
        )
        .where(
            PriceItem.service_id == service_id,
            PriceItem.price_date >= cutoff_date,
        )
        .group_by(PriceItem.clinic_id)
        .subquery("latest_price")
    )

    source_url_subq = (
        select(ParsedPriceRow.source_file)
        .where(
            ParsedPriceRow.clinic_id == Clinic.id,
            ParsedPriceRow.matched_service_id == service_id,
        )
        .order_by(ParsedPriceRow.parsed_at.desc())
        .limit(1)
        .scalar_subquery()
    )

    stmt = (
        select(
            Clinic.id,
            Clinic.name,
            Clinic.city,
            Clinic.address,
            Clinic.latitude,
            Clinic.longitude,
            Clinic.rating,
            Clinic.phone,
            Clinic.working_hours,
            Clinic.website_url,
            Clinic.logo_url,
            PriceItem.price_kzt,
            PriceItem.price_date,
            PriceItem.is_verified,
            PriceItem.duration_days,
            PriceItem.currency,
            PriceItem.source_name,
            PriceItem.match_score,
            source_url_subq.label("source_url"),
        )
        .join(
            latest_price_subq,
            Clinic.id == latest_price_subq.c.clinic_id,
        )
        .join(
            PriceItem,
            (PriceItem.clinic_id == Clinic.id)
            & (PriceItem.service_id == service_id)
            & (PriceItem.price_date == latest_price_subq.c.latest_date),
        )
        .where(
            Clinic.is_active == True,  # noqa: E712
            or_(
                Clinic.city.ilike(f"%{city}%"),
                *[
                    Clinic.name.ilike(f"%{prefix}%")
                    for prefix in NATIONAL_LAB_NAMES
                ],
            ),
        )
    )

    # Опциональные фильтры по цене
    if min_price is not None:
        stmt = stmt.where(PriceItem.price_kzt >= min_price)
    if max_price is not None:
        stmt = stmt.where(PriceItem.price_kzt <= max_price)
    if verified_only:
        stmt = stmt.where(PriceItem.is_verified == True)  # noqa: E712

    # Применяем SQL-сортировку (если не по дистанции)
    if sort != SortOrder.distance_asc:
        sort_map = {
            SortOrder.price_asc:    asc(PriceItem.price_kzt),
            SortOrder.price_desc:   desc(PriceItem.price_kzt),
            SortOrder.rating_desc:  desc(Clinic.rating),
            SortOrder.name_asc:     asc(Clinic.name),
            SortOrder.date_desc:    desc(PriceItem.price_date),
        }
        stmt = stmt.order_by(sort_map[sort])

    try:
        result = await db.execute(stmt)
        rows = result.mappings().all()
    except Exception as exc:
        log.error(f"compare_clinics DB error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении данных. Попробуйте позже.",
        )

    if not rows:
        # Данные есть, но нет клиник в этом городе — не ошибка, пустой список
        return CompareResponse(
            service=ServiceRead.model_validate(service),
            city=city,
            sort_by=sort.value,
            total_clinics=0,
            min_price=None,
            max_price=None,
            clinics=[],
        )

    # ── Постобработка: вычисляем is_cheapest и distance ──────────────────────────────
    prices = [row["price_kzt"] for row in rows]
    min_p = min(prices)
    max_p = max(prices)

    clinics_out: list[ClinicInCompare] = []
    for row in rows:
        data = dict(row)
        data["is_cheapest"] = data["price_kzt"] == min_p
        meta = build_source_meta(data.get("source_url"), data.get("website_url"), data.get("source_name"))
        data["source_parser"] = meta.get("parser_id")
        data["source_parser_label"] = meta.get("parser_label")
        data["official_source_url"] = meta.get("official_url")
        
        # Вычисляем расстояние, если переданы координаты
        if user_lat is not None and user_lon is not None and data["latitude"] is not None and data["longitude"] is not None:
            dist = haversine(user_lat, user_lon, data["latitude"], data["longitude"])
            data["distance_km"] = round(dist, 2)
        else:
            data["distance_km"] = None
            
        clinics_out.append(ClinicInCompare(**data))

    # Если запрошена сортировка по расстоянию, сортируем в Python
    if sort == SortOrder.distance_asc:
        clinics_out.sort(key=lambda c: c.distance_km if c.distance_km is not None else float('inf'))

    response = CompareResponse(
        service=ServiceRead.model_validate(service),
        city=city,
        sort_by=sort.value,
        total_clinics=len(clinics_out),
        min_price=min_p,
        max_price=max_p,
        clinics=clinics_out,
    )

    # ── Записываем в кэш ──────────────────────────────────────────────────
    if is_redis_available():
        try:
            redis = await get_redis()
            await redis.setex(
                cache_key,
                COMPARE_CACHE_TTL,
                response.model_dump_json(),
            )
            log.debug(f"compare: cached [{cache_key}] TTL={COMPARE_CACHE_TTL}s")
        except Exception as exc:
            log.warning(f"Redis set failed: {exc}")

    return response


# ─── GET /api/clinics/ ─────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[ClinicRead],
    summary="Список клиник",
)
async def list_clinics(
    db: Annotated[AsyncSession, Depends(get_db)],
    city: Optional[str] = Query(None, description="Фильтр по городу"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[ClinicRead]:
    """Список всех активных клиник с опциональной фильтрацией по городу."""
    offset = (page - 1) * page_size
    stmt = (
        select(Clinic)
        .where(Clinic.is_active == True)  # noqa: E712
        .order_by(desc(Clinic.rating), Clinic.name)
        .offset(offset)
        .limit(page_size)
    )
    if city:
        stmt = stmt.where(Clinic.city.ilike(f"%{city}%"))

    result = await db.execute(stmt)
    clinics = result.scalars().all()
    return [ClinicRead.model_validate(c) for c in clinics]


# ─── GET /api/clinics/{clinic_id}/prices ───────────────────────────────────────

@router.get(
    "/{clinic_id}/prices",
    response_model=list[ClinicPriceItem],
    summary="Прайс-лист клиники",
)
async def get_clinic_prices(
    clinic_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=200, ge=1, le=500),
    max_age_days: int = Query(30, ge=1, le=365),
) -> list[ClinicPriceItem]:
    """Актуальные цены всех услуг клиники (последняя запись на услугу)."""
    from app.models.models import ServiceCategory, ParsedPriceRow

    clinic_res = await db.execute(
        select(Clinic).where(Clinic.id == clinic_id, Clinic.is_active == True)  # noqa: E712
    )
    if clinic_res.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиника не найдена")

    source_url_subq = (
        select(ParsedPriceRow.source_file)
        .where(
            ParsedPriceRow.clinic_id == clinic_id,
            ParsedPriceRow.matched_service_id == PriceItem.service_id,
        )
        .order_by(ParsedPriceRow.parsed_at.desc())
        .limit(1)
        .scalar_subquery()
    )

    cutoff_date = date.today() - timedelta(days=max_age_days)
    latest_subq = (
        select(
            PriceItem.service_id,
            func.max(PriceItem.price_date).label("latest_date"),
        )
        .where(PriceItem.clinic_id == clinic_id, PriceItem.price_date >= cutoff_date)
        .group_by(PriceItem.service_id)
        .subquery()
    )

    stmt = (
        select(PriceItem, Service, ServiceCategory.name, source_url_subq.label("source_url"))
        .join(Service, PriceItem.service_id == Service.id)
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .join(
            latest_subq,
            (PriceItem.service_id == latest_subq.c.service_id)
            & (PriceItem.price_date == latest_subq.c.latest_date),
        )
        .where(PriceItem.clinic_id == clinic_id)
        .order_by(PriceItem.price_kzt.asc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    out: list[ClinicPriceItem] = []
    for pi, svc, cat_name, source_url in rows:
        meta = build_source_meta(source_url, None, pi.source_name)
        out.append(
            ClinicPriceItem(
                service_id=pi.service_id,
                service_name=svc.name,
                category_name=cat_name,
                price_kzt=pi.price_kzt,
                price_date=pi.price_date,
                source_name=pi.source_name,
                source_url=source_url,
                is_verified=pi.is_verified,
                match_score=pi.match_score,
                source_parser=meta.get("parser_id"),
                source_parser_label=meta.get("parser_label"),
                official_source_url=meta.get("official_url"),
                duration_days=pi.duration_days,
                currency=pi.currency,
            )
        )
    return out


# ─── GET /api/clinics/{clinic_id} ─────────────────────────────────────────────

@router.get(
    "/{clinic_id}",
    response_model=ClinicRead,
    summary="Карточка клиники",
)
async def get_clinic(
    clinic_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ClinicRead:
    """Детальная информация об одной клинике по её ID."""
    result = await db.execute(
        select(Clinic).where(Clinic.id == clinic_id, Clinic.is_active == True)  # noqa: E712
    )
    clinic = result.scalar_one_or_none()

    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Клиника с id={clinic_id} не найдена.",
        )

    return ClinicRead.model_validate(clinic)
