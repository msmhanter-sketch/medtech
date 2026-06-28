"""
app/main.py — Точка входа FastAPI приложения.

Подключает роутеры, настраивает CORS, lifespan и глобальные middleware.
"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.clinics import router as clinics_router
from app.api.history import router as history_router
from app.api.collected_data import router as collected_data_router
from app.api.normalize import router as normalize_router
from app.api.scrape import router as scrape_router
from app.api.services import router as services_router
from app.api.stats import router as stats_router
from app.api.insights import router as insights_router
from app.api.dgis import router as dgis_router
from app.api.subscriptions import router as subscriptions_router
from app.core.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.core.redis_client import close_redis, get_redis, set_redis_unavailable, is_redis_available
from app.normalizer import init_matcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом: startup / shutdown."""
    log.info("🚀 MedPrice KZ API запускается...")

    # 1. Создаём недостающие таблицы (MVP, без Alembic)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        log.warning(f"⚠️  create_all: {exc}")

    from app.services.db_migrate import ensure_clinic_columns
    try:
        await ensure_clinic_columns()
    except Exception as exc:
        log.warning(f"⚠️  clinic columns migrate: {exc}")

    try:
        from app.services.legacy_fallback_cleanup import purge_legacy_fallback_prices
        async with AsyncSessionLocal() as session:
            cleanup = await purge_legacy_fallback_prices(session)
        if cleanup.get("raw_deleted") or cleanup.get("prices_deleted"):
            log.info(
                "✅ Legacy fallback prices removed: raw=%s, prices=%s",
                cleanup.get("raw_deleted", 0),
                cleanup.get("prices_deleted", 0),
            )
    except Exception as exc:
        log.warning(f"⚠️  legacy fallback cleanup: {exc}")

    # 2. Проверяем Redis
    try:
        redis = await get_redis()
        await redis.ping()
        log.info("✅ Redis: подключён")
    except Exception as exc:
        log.warning(f"⚠️  Redis недоступен: {exc}. Работаем без кэша.")
        set_redis_unavailable()

    # 2. Загружаем индекс нормализации из БД
    try:
        async with AsyncSessionLocal() as session:
            matcher = await init_matcher(session)
        log.info(f"✅ Индекс нормализации: {len(matcher._flat_corpus)} вариантов")
    except Exception as exc:
        log.warning(f"⚠️  Не удалось загрузить индекс нормализации: {exc}")

    # 3. Инициализируем и запускаем планировщик парсинга
    stop_scheduler = None
    try:
        from app.services.scheduler import init_schedules, start_scheduler, stop_scheduler as shutdown_scheduler

        await init_schedules()
        start_scheduler()
        stop_scheduler = shutdown_scheduler
        log.info("✅ Планировщик парсеров запущен")
    except Exception as exc:
        log.warning(f"⚠️  Не удалось запустить планировщик: {exc}")

    yield  # ← приложение работает

    log.info("🛑 Завершение работы...")
    try:
        if stop_scheduler:
            stop_scheduler()
            log.info("✅ Планировщик остановлен")
    except Exception as exc:
        log.warning(f"⚠️  Не удалось остановить планировщик: {exc}")
    await close_redis()
    log.info("✅ Redis: соединение закрыто")


app = FastAPI(
    title="MedPrice KZ API",
    description=(
        "**Агрегатор и система сравнения цен на медицинские услуги в Казахстане.**\n\n"
        "Позволяет искать услуги, сравнивать цены клиник, "
        "фильтровать по городу и сортировать по цене/рейтингу."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev
        "http://frontend:3000",  # Docker network
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    """Логирует время выполнения каждого запроса."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    log.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} [{duration_ms:.1f}ms]"
    )
    return response


# ─── Роутеры ──────────────────────────────────────────────────────────────────

app.include_router(scrape_router)
app.include_router(collected_data_router)
app.include_router(services_router)
app.include_router(clinics_router)
app.include_router(history_router)
app.include_router(normalize_router)
app.include_router(stats_router)
app.include_router(insights_router)
app.include_router(subscriptions_router)
app.include_router(dgis_router)


# ─── Служебные эндпоинты ──────────────────────────────────────────────────────

@app.get("/health", tags=["system"], summary="Проверка работоспособности")
async def health_check():
    """Используется Docker healthcheck и мониторингом."""
    redis_ok = False
    if is_redis_available():
        try:
            redis = await get_redis()
            await redis.ping()
            redis_ok = True
        except Exception:
            pass

    return {
        "status": "ok",
        "service": "medprice-kz-api",
        "version": "0.1.0",
        "redis": "connected" if redis_ok else "unavailable",
    }


@app.get("/", tags=["system"], include_in_schema=False)
async def root():
    return {"message": "MedPrice KZ API. Документация: /docs"}
