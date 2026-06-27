"""
polish_db.py — Оптимизация SQLite (VACUUM/ANALYZE) и вывод сводной статистики БД.
Используется как завершающий шаг инициализации БД.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.models import Clinic, Service, PriceItem, ParsedPriceRow

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./medtech.db")


async def polish() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    log.info("Оптимизация базы данных SQLite...")
    
    # Запускаем ANALYZE для обновления статистики планировщика запросов
    async with engine.begin() as conn:
        await conn.execute(text("ANALYZE;"))
        log.info("✅ Команда ANALYZE выполнена успешно.")

    # Вывод красивой статистики о наполнении БД
    async with async_session() as session:
        clinics_cnt = await session.scalar(select(func.count()).select_from(Clinic).where(Clinic.is_active == True))
        services_cnt = await session.scalar(select(func.count()).select_from(Service).where(Service.is_active == True))
        prices_cnt = await session.scalar(select(func.count()).select_from(PriceItem))
        raw_rows_cnt = await session.scalar(select(func.count()).select_from(ParsedPriceRow))
        
        # Кол-во аномалий (выявленных расхождений цен от медианы)
        anomalies_cnt = await session.scalar(
            select(func.count()).select_from(ParsedPriceRow).where(ParsedPriceRow.match_status == "needs_review")
        )
        
        # Нераспознанные строки прайсов
        unmatched_cnt = await session.scalar(
            select(func.count()).select_from(ParsedPriceRow).where(ParsedPriceRow.match_status == "not_found")
        )

        log.info("\n=== СТАТИСТИКА БАЗЫ ДАННЫХ ===")
        log.info(f"🏥 Активных клиник:   {clinics_cnt}")
        log.info(f"📋 Активных услуг:   {services_cnt}")
        log.info(f"💵 Актуальных цен:   {prices_cnt}")
        log.info(f"📥 Спарсено raw-строк: {raw_rows_cnt}")
        log.info(f"⚠️ Аномалий цен:      {anomalies_cnt}")
        log.info(f"🔍 Не сопоставлено:   {unmatched_cnt}")
        
        if raw_rows_cnt > 0:
            matched_rate = ((raw_rows_cnt - unmatched_cnt) / raw_rows_cnt) * 100
            log.info(f"📈 Точность матчинга: {matched_rate:.2f}%")
        log.info("==============================\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(polish())
