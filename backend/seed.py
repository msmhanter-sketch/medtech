"""
seed.py — Генерация реалистичных моковых данных для MVP.

Данные основаны на реальных ценах медицинских клиник Казахстана (2024).
Запуск: python seed.py

Требует рабочего соединения с PostgreSQL (см. .env).
"""
import asyncio
import json
import logging
import os
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

# Добавляем корень проекта в sys.path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(message)s")
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://medtech:medtech_secret@localhost:5432/medtech_db",
)


# ═══════════════════════════════════════════════════════════════════════════════
# FIXTURE DATA
# ═══════════════════════════════════════════════════════════════════════════════

CATEGORIES = [
    {"name": "Лабораторные анализы", "slug": "analizy",       "icon_name": "flask-conical",  "sort_order": 1},
    {"name": "МРТ",                   "slug": "mrt",           "icon_name": "scan",           "sort_order": 2},
    {"name": "УЗИ",                   "slug": "uzi",           "icon_name": "activity",       "sort_order": 3},
    {"name": "Приём врача",           "slug": "priyom-vracha", "icon_name": "stethoscope",    "sort_order": 4},
    {"name": "Стоматология",          "slug": "stomatologiya", "icon_name": "smile",          "sort_order": 5},
]

# Эталонные услуги с синонимами для нечёткого матчинга
SERVICES = [
    # Лабораторные анализы
    {
        "category_slug": "analizy",
        "name": "Общий анализ крови (ОАК)",
        "aliases": json.dumps(["ОАК", "Клинический анализ крови", "CBC", "Общий анализ", "Анализ крови общий"]),
        "description": "Определение клеточного состава крови: эритроциты, лейкоциты, тромбоциты, гемоглобин.",
    },
    {
        "category_slug": "analizy",
        "name": "Общий анализ мочи (ОАМ)",
        "aliases": json.dumps(["ОАМ", "Анализ мочи", "Урина общий", "UAM"]),
        "description": "Физико-химические свойства мочи и микроскопия осадка.",
    },
    {
        "category_slug": "analizy",
        "name": "Биохимический анализ крови (расширенный)",
        "aliases": json.dumps(["Биохимия крови", "Биохимия расширенная", "БАК", "Biochemistry"]),
        "description": "Глюкоза, АЛТ, АСТ, билирубин, мочевина, креатинин, холестерин, триглицериды.",
    },
    {
        "category_slug": "analizy",
        "name": "ТТГ (тиреотропный гормон)",
        "aliases": json.dumps(["ТТГ", "TSH", "Гормон щитовидной железы", "Тиреотропин"]),
        "description": "Скрининг функции щитовидной железы.",
    },
    {
        "category_slug": "analizy",
        "name": "Коагулограмма (МНО, ПВ, АЧТВ)",
        "aliases": json.dumps(["Коагулограмма", "Свертываемость крови", "МНО", "Гемостаз"]),
        "description": "Оценка системы гемостаза и свертывания крови.",
    },
    # МРТ
    {
        "category_slug": "mrt",
        "name": "МРТ головного мозга",
        "aliases": json.dumps(["МРТ мозга", "МРТ головы", "MRI brain", "МРТ ГМ"]),
        "description": "Диагностика сосудистых, опухолевых и воспалительных заболеваний мозга.",
    },
    {
        "category_slug": "mrt",
        "name": "МРТ позвоночника (поясничный отдел)",
        "aliases": json.dumps(["МРТ поясницы", "МРТ LS позвонков", "МРТ поясничный", "МРТ L-S"]),
        "description": "Диагностика грыж, протрузий и дегенеративных изменений.",
    },
    {
        "category_slug": "mrt",
        "name": "МРТ коленного сустава",
        "aliases": json.dumps(["МРТ колена", "МРТ коленного", "MRI knee", "МРТ сустава"]),
        "description": "Оценка менисков, связок и хрящевых поверхностей.",
    },
    # УЗИ
    {
        "category_slug": "uzi",
        "name": "УЗИ органов брюшной полости",
        "aliases": json.dumps(["УЗИ брюшной полости", "УЗИ ОБП", "УЗИ живота", "Abdominal ultrasound"]),
        "description": "Печень, желчный пузырь, поджелудочная железа, селезёнка, почки.",
    },
    {
        "category_slug": "uzi",
        "name": "УЗИ щитовидной железы",
        "aliases": json.dumps(["УЗИ щитовидки", "УЗИ ЩЖ", "Thyroid ultrasound"]),
        "description": "Структура, размеры, наличие узлов и новообразований.",
    },
    # Приём врача
    {
        "category_slug": "priyom-vracha",
        "name": "Приём терапевта (первичный)",
        "aliases": json.dumps(["Терапевт первичный", "Консультация терапевта", "Приём врача терапевта"]),
        "description": "Первичный осмотр, сбор анамнеза, назначение обследования.",
    },
    {
        "category_slug": "priyom-vracha",
        "name": "Приём кардиолога",
        "aliases": json.dumps(["Кардиолог консультация", "Консультация кардиолога", "Cardiologist"]),
        "description": "Диагностика и лечение заболеваний сердечно-сосудистой системы.",
    },
    {
        "category_slug": "priyom-vracha",
        "name": "Приём невролога",
        "aliases": json.dumps(["Невролог консультация", "Консультация невролога", "Невропатолог"]),
        "description": "Диагностика и лечение заболеваний нервной системы.",
    },
    # Стоматология
    {
        "category_slug": "stomatologiya",
        "name": "Лечение кариеса (1 поверхность)",
        "aliases": json.dumps(["Кариес лечение", "Пломба 1 поверхность", "Лечение зуба"]),
        "description": "Препарирование и пломбирование кариозной полости.",
    },
    {
        "category_slug": "stomatologiya",
        "name": "Профессиональная чистка зубов (Air Flow)",
        "aliases": json.dumps(["Чистка зубов", "Air Flow", "Airflow", "Профчистка", "Гигиена полости рта"]),
        "description": "Удаление зубного камня и налёта, полировка.",
    },
]

# 5 клиник: 3 в Астане, 2 в Алматы
CLINICS = [
    {
        "name": "INVIVO Лаборатория",
        "city": "Астана",
        "address": "пр. Туран, 24, Астана 010000",
        "latitude": 51.1605,
        "longitude": 71.4704,
        "rating": Decimal("4.7"),
        "phone": "+7 (7172) 55-00-10",
        "website_url": "https://invivo.kz",
        "logo_url": "https://ui-avatars.com/api/?name=INVIVO&background=2563EB&color=fff&size=128",
    },
    {
        "name": "ЦКБ УДП РК (Центральная клиническая больница)",
        "city": "Астана",
        "address": "ул. Сыганак, 2, Астана 010000",
        "latitude": 51.1694,
        "longitude": 71.4511,
        "rating": Decimal("4.5"),
        "phone": "+7 (7172) 57-81-81",
        "website_url": "https://ckb.kz",
        "logo_url": "https://ui-avatars.com/api/?name=ЦКБ&background=0F766E&color=fff&size=128",
    },
    {
        "name": "Olimp Клиника",
        "city": "Астана",
        "address": "пр. Кабанбай батыра, 58Б, Астана 010000",
        "latitude": 51.1500,
        "longitude": 71.4650,
        "rating": Decimal("4.3"),
        "phone": "+7 (7172) 79-77-77",
        "website_url": "https://olimp.kz",
        "logo_url": "https://ui-avatars.com/api/?name=Olimp&background=7C3AED&color=fff&size=128",
    },
    {
        "name": "MEDIC City (Медик Сити)",
        "city": "Алматы",
        "address": "ул. Тимирязева, 42, Алматы 050057",
        "latitude": 43.2220,
        "longitude": 76.8512,
        "rating": Decimal("4.8"),
        "phone": "+7 (727) 311-00-55",
        "website_url": "https://mediccity.kz",
        "logo_url": "https://ui-avatars.com/api/?name=MEDIC&background=DC2626&color=fff&size=128",
    },
    {
        "name": "Synevo Kazakhstan",
        "city": "Алматы",
        "address": "ул. Байтурсынова, 115, Алматы 050012",
        "latitude": 43.2551,
        "longitude": 76.9126,
        "rating": Decimal("4.6"),
        "phone": "+7 (727) 339-39-39",
        "website_url": "https://synevo.kz",
        "logo_url": "https://ui-avatars.com/api/?name=Synevo&background=EA580C&color=fff&size=128",
    },
]

# Матрица цен: clinic_index -> service_name -> (price, variation_percent)
# Цены реалистичны для КЗ рынка (2024, тенге)
PRICE_MATRIX = {
    "Общий анализ крови (ОАК)":             [1800,  2200,  1500,  2800,  2100],
    "Общий анализ мочи (ОАМ)":              [1500,  1800,  1200,  2200,  1700],
    "Биохимический анализ крови (расширенный)": [8500, 10200, 7800, 12500, 9800],
    "ТТГ (тиреотропный гормон)":            [4200,  5100,  3800,  6500,  4900],
    "Коагулограмма (МНО, ПВ, АЧТВ)":       [5500,  6200,  5000,  7800,  6100],
    "МРТ головного мозга":                  [32000, 28500, 35000, 42000, 38000],
    "МРТ позвоночника (поясничный отдел)":  [30000, 26000, 33000, 40000, 35000],
    "МРТ коленного сустава":                [28000, 25000, 30000, 38000, 32000],
    "УЗИ органов брюшной полости":          [8500,  7800,  9200,  11500, 9800],
    "УЗИ щитовидной железы":               [6500,  5900,  7100,  9000,  7500],
    "Приём терапевта (первичный)":          [7000,  9500,  6500,  12000, 8500],
    "Приём кардиолога":                     [12000, 15000, 10500, 18000, 14000],
    "Приём невролога":                      [11000, 14000, 9800,  16500, 13000],
    "Лечение кариеса (1 поверхность)":      [18000, 22000, 15000, 28000, None],
    "Профессиональная чистка зубов (Air Flow)": [15000, 18000, 13000, 22000, None],
}


# ═══════════════════════════════════════════════════════════════════════════════
# SEED LOGIC
# ═══════════════════════════════════════════════════════════════════════════════

async def seed(session: AsyncSession) -> None:
    from app.models.models import Clinic, PriceItem, Service, ServiceCategory

    log.info("🌱 Начинаем заполнение базы данных...")

    # 1. Категории
    log.info("  ↳ Создаём категории услуг...")
    category_map: dict[str, ServiceCategory] = {}
    for cat_data in CATEGORIES:
        cat = ServiceCategory(**cat_data)
        session.add(cat)
        category_map[cat_data["slug"]] = cat
    await session.flush()
    log.info(f"    ✓ {len(CATEGORIES)} категорий создано")

    # 2. Услуги
    log.info("  ↳ Создаём эталонные услуги...")
    service_map: dict[str, Service] = {}
    for svc_data in SERVICES:
        slug = svc_data.pop("category_slug")
        svc = Service(category_id=category_map[slug].id, **svc_data)
        session.add(svc)
        service_map[svc_data["name"]] = svc
    await session.flush()
    log.info(f"    ✓ {len(SERVICES)} услуг создано")

    # 3. Клиники
    log.info("  ↳ Создаём клиники...")
    clinic_objects: list[Clinic] = []
    for clinic_data in CLINICS:
        clinic = Clinic(**clinic_data)
        session.add(clinic)
        clinic_objects.append(clinic)
    await session.flush()
    log.info(f"    ✓ {len(CLINICS)} клиник создано")

    # 4. Прайсы
    log.info("  ↳ Генерируем прайс-листы...")
    today = date.today()
    price_count = 0

    for service_name, prices in PRICE_MATRIX.items():
        svc = service_map.get(service_name)
        if not svc:
            log.warning(f"    ⚠ Услуга не найдена: {service_name!r}")
            continue

        for clinic_idx, price_value in enumerate(prices):
            if price_value is None:
                # Не все клиники предлагают все услуги
                continue

            clinic = clinic_objects[clinic_idx]
            price_item = PriceItem(
                clinic_id=clinic.id,
                service_id=svc.id,
                price_kzt=Decimal(str(price_value)),
                price_date=today - timedelta(days=clinic_idx),  # немного разные даты
                source_name=service_name,  # имитируем исходное название
                match_score=100,           # seed-данные считаем верифицированными
                is_verified=True,
            )
            session.add(price_item)
            price_count += 1

    await session.flush()
    log.info(f"    ✓ {price_count} позиций прайса создано")

    await session.commit()
    log.info("✅ База данных успешно заполнена!")
    log.info(
        f"\n📊 Итого:\n"
        f"   • Категорий:  {len(CATEGORIES)}\n"
        f"   • Услуг:      {len(SERVICES)}\n"
        f"   • Клиник:     {len(CLINICS)}\n"
        f"   • Прайс-строк: {price_count}"
    )


async def create_tables_and_seed() -> None:
    """Создаёт все таблицы (если не существуют) и наполняет данными."""
    from app.models.base import Base
    # Импортируем модели, чтобы они попали в метаданные Base
    import app.models.models  # noqa: F401

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    try:
        log.info("🔧 Создаём таблицы (CREATE TABLE IF NOT EXISTS)...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        log.info("  ✓ Таблицы готовы")

        async with async_session() as session:
            await seed(session)

    except Exception as exc:
        log.error(f"❌ Ошибка: {exc}", exc_info=True)
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_tables_and_seed())
