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
from app.api.normalize import router as normalize_router
from app.api.services import router as services_router
from app.core.database import AsyncSessionLocal
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

    # 1. Проверяем Redis
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

    yield  # ← приложение работает

    log.info("🛑 Завершение работы...")
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

app.include_router(services_router)
app.include_router(clinics_router)
app.include_router(normalize_router)


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
