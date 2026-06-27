"""
  python seed.py — Только справочник. Данные — scrape_and_ingest.py (веб).

  python seed.py --fresh
"""
import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from service_catalog import CATEGORIES, SERVICES

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./medtech.db")


async def seed(session, skip_if_populated: bool = False) -> None:
    from app.models.models import Service, ServiceCategory

    existing = await session.scalar(select(func.count()).select_from(Service))
    if skip_if_populated and existing and existing > 0:
        log.info("Справочник уже есть (%s услуг), пропуск.", existing)
        return

    category_map: dict[str, ServiceCategory] = {}
    for cat_data in CATEGORIES:
        cat = ServiceCategory(**cat_data)
        session.add(cat)
        category_map[cat_data["slug"]] = cat
    await session.flush()

    for svc_data in SERVICES:
        slug = svc_data["category_slug"]
        session.add(Service(
            category_id=category_map[slug].id,
            name=svc_data["name"],
            aliases=svc_data.get("aliases"),
            description=svc_data.get("description"),
        ))
    await session.commit()
    log.info("Справочник: %s категорий, %s базовых услуг.", len(CATEGORIES), len(SERVICES))


async def main(fresh: bool = False) -> None:
    from app.models.base import Base
    import app.models.models  # noqa: F401

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        if fresh:
            log.info("Пересоздаём БД...")
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await seed(session, skip_if_populated=not fresh)

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fresh", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(fresh=args.fresh))
