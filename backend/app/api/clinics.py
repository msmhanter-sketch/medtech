"""
app/api/clinics.py — Роутер сравнения клиник по услуге.

Эндпоинты:
  GET /api/clinics/compare  — ядро продукта: сравнение клиник по услуге
  GET /api/clinics/         — список всех клиник
  GET /api/clinics/{id}     — карточка одной клиники
"""
import json
import logging
from decimal import Decimal
from enum import Enum
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis_client import get_redis, is_redis_available
from app.models.models import Clinic, PriceItem, Service
from app.schemas.clinic import ClinicInCompare, ClinicRead, CompareResponse, ServiceRead

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clinics", tags=["clinics"])

# Кэш сравнения: 5 минут (цены обновляются редко)
COMPARE_CACHE_TTL = 300


class SortOrder(str, Enum):
    """Допустимые варианты сортировки для эндпоинта сравнения."""
    price_asc = "price_asc"
    price_desc = "price_desc"
    rating_desc = "rating_desc"
    name_asc = "name_asc"


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
        example="Астана",
    ),
    sort: SortOrder = Query(
        default=SortOrder.price_asc,
        description="Сортировка: price_asc | price_desc | rating_desc | name_asc",
    ),
    min_price: Optional[Decimal] = Query(None, ge=0, description="Минимальная цена в KZT"),
    max_price: Optional[Decimal] = Query(None, ge=0, description="Максимальная цена в KZT"),
    verified_only: bool = Query(False, description="Только верифицированные цены"),
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
        f":min={min_price}:max={max_price}:verified={verified_only}"
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
    latest_price_subq = (
        select(
            PriceItem.clinic_id,
            func.max(PriceItem.price_date).label("latest_date"),
        )
        .where(PriceItem.service_id == service_id)
        .group_by(PriceItem.clinic_id)
        .subquery("latest_price")
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
            Clinic.website_url,
            Clinic.logo_url,
            PriceItem.price_kzt,
            PriceItem.price_date,
            PriceItem.is_verified,
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
            # ILIKE для нечувствительности к регистру и диакритике
            Clinic.city.ilike(f"%{city}%"),
        )
    )

    # Опциональные фильтры по цене
    if min_price is not None:
        stmt = stmt.where(PriceItem.price_kzt >= min_price)
    if max_price is not None:
        stmt = stmt.where(PriceItem.price_kzt <= max_price)
    if verified_only:
        stmt = stmt.where(PriceItem.is_verified == True)  # noqa: E712

    # Применяем сортировку
    sort_map = {
        SortOrder.price_asc:    asc(PriceItem.price_kzt),
        SortOrder.price_desc:   desc(PriceItem.price_kzt),
        SortOrder.rating_desc:  desc(Clinic.rating),
        SortOrder.name_asc:     asc(Clinic.name),
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

    # ── Постобработка: вычисляем is_cheapest ──────────────────────────────
    prices = [row["price_kzt"] for row in rows]
    min_p = min(prices)
    max_p = max(prices)

    clinics_out: list[ClinicInCompare] = []
    for row in rows:
        data = dict(row)
        data["is_cheapest"] = data["price_kzt"] == min_p
        clinics_out.append(ClinicInCompare(**data))

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
