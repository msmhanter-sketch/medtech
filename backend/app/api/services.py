"""
app/api/services.py — Роутер для поиска и каталога услуг.

Эндпоинты:
  GET /api/services/search   — живой автокомплит по названию
  GET /api/services/         — полный список с пагинацией
  GET /api/categories/       — список категорий (Redis-cached)
"""
import json
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.redis_client import get_redis, is_redis_available
from app.models.models import Service, ServiceCategory
from app.schemas.clinic import ServiceCatalogItem, ServiceCategoryRead, ServiceRead, ServiceSearchResult

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["services"])

# TTL кэша для категорий — обновляются редко, кэшируем на 1 час
CATEGORIES_CACHE_KEY = "categories:all"


def _parse_aliases(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        aliases = json.loads(raw)
    except json.JSONDecodeError:
        aliases = [part.strip() for part in raw.split(",")]
    return [str(alias).strip() for alias in aliases if str(alias).strip()]
CATEGORIES_CACHE_TTL = 3600  # секунды


# ─── GET /api/categories/ ──────────────────────────────────────────────────────

@router.get(
    "/categories/",
    response_model=list[ServiceCategoryRead],
    summary="Список всех категорий услуг",
    description="Возвращает категории, отсортированные по sort_order. Результат кэшируется в Redis на 1 час.",
)
async def get_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ServiceCategoryRead]:
    """
    Возвращает все категории услуг.
    Первый запрос идёт в PostgreSQL, последующие — из Redis.
    """
    # Пробуем взять из кэша, только если Redis доступен
    if is_redis_available():
        try:
            redis = await get_redis()
            cached = await redis.get(CATEGORIES_CACHE_KEY)
            if cached:
                log.debug("categories: cache HIT")
                raw = json.loads(cached)
                return [ServiceCategoryRead(**item) for item in raw]
        except Exception as exc:
            # Redis недоступен — деградируем gracefully, идём в БД
            log.warning(f"Redis get failed: {exc}. Falling back to DB.")

    log.debug("categories: cache MISS — querying DB")
    stmt = select(ServiceCategory).order_by(ServiceCategory.sort_order)
    result = await db.execute(stmt)
    categories = result.scalars().all()

    if not categories:
        return []

    response = [ServiceCategoryRead.model_validate(cat) for cat in categories]

    # Сохраняем в Redis, только если он доступен
    if is_redis_available():
        try:
            redis = await get_redis()
            payload = json.dumps([cat.model_dump(mode="json") for cat in response])
            await redis.setex(CATEGORIES_CACHE_KEY, CATEGORIES_CACHE_TTL, payload)
            log.debug("categories: written to cache")
        except Exception as exc:
            log.warning(f"Redis set failed: {exc}")

    return response


# ─── GET /api/services/search ──────────────────────────────────────────────────

@router.get(
    "/services/search",
    response_model=list[ServiceSearchResult],
    summary="Живой поиск услуг (автокомплит)",
    description=(
        "Ищет услуги по вхождению строки `q` в название (case-insensitive). "
        "Возвращает до `limit` результатов. "
        "Идеально для строки поиска с debounce 300ms на фронте."
    ),
)
async def search_services(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(
        default="",
        max_length=150,
        description="Поисковый запрос (минимум 2 символа для поиска)",
        examples=["МРТ"],
    ),
    limit: int = Query(default=10, ge=1, le=50, description="Максимум результатов"),
    category_id: Optional[int] = Query(None, description="Фильтр по категории"),
) -> list[ServiceSearchResult]:
    """
    Полнотекстовый поиск по названию услуги.
    Если запрос пустой или слишком короткий, но передан category_id,
    возвращает список услуг в этой категории.
    """
    # Если запрос слишком короткий и нет категории, выбрасываем ошибку валидации 422
    if len(q.strip()) < 2 and category_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Поисковый запрос должен содержать не менее 2 символов.",
        )

    # Строим запрос с JOIN на категорию (нужно для category_name в ответе)
    stmt = (
        select(
            Service.id,
            Service.name,
            Service.category_id,
            Service.description,
            ServiceCategory.name.label("category_name"),
        )
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .where(Service.is_active == True)  # noqa: E712
    )

    if len(q.strip()) >= 2:
        q_clean = q.lower().strip().replace("ё", "е")
        for noise in ["анализ крови на ", "анализ на ", "прием ", "приём ", "узи ", "мрт ", "кт ", "исследование на "]:
            if q_clean.startswith(noise):
                q_clean = q_clean[len(noise):].strip()
        if not q_clean:
            q_clean = q.lower().strip().replace("ё", "е")

        stmt = stmt.where(
            or_(
                func.replace(func.lower(Service.name), "ё", "е").ilike(f"%{q_clean}%"),
                func.replace(func.lower(Service.aliases), "ё", "е").ilike(f"%{q_clean}%")
            )
        ).order_by(
            func.strpos(func.replace(func.lower(Service.name), "ё", "е"), q_clean),
            Service.name,
        )
    else:
        # Для пустого поиска по категории сортируем просто по имени
        stmt = stmt.order_by(Service.name)

    # Добавляем фильтр по категории, если передан
    if category_id is not None:
        stmt = stmt.where(Service.category_id == category_id)

    stmt = stmt.limit(limit)

    try:
        result = await db.execute(stmt)
        rows = result.mappings().all()
    except Exception as exc:
        log.error(f"search_services DB error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при поиске услуг. Попробуйте позже.",
        )

    return [ServiceSearchResult(**dict(row)) for row in rows]


# ─── GET /api/services/ ────────────────────────────────────────────────────────

@router.get(
    "/services/",
    response_model=list[ServiceRead],
    summary="Каталог всех услуг",
)
async def list_services(
    db: Annotated[AsyncSession, Depends(get_db)],
    category_id: Optional[int] = Query(None, description="Фильтр по категории"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[ServiceRead]:
    """Возвращает список всех активных услуг с пагинацией."""
    offset = (page - 1) * page_size
    stmt = (
        select(Service)
        .where(Service.is_active == True)  # noqa: E712
        .order_by(Service.category_id, Service.name)
        .offset(offset)
        .limit(page_size)
    )
    if category_id is not None:
        stmt = stmt.where(Service.category_id == category_id)

    result = await db.execute(stmt)
    services = result.scalars().all()
    return [ServiceRead.model_validate(svc) for svc in services]
