"""Cron-friendly scraping entrypoint.

Windows Task Scheduler:
    python C:\\MedServicePrice.kz\\backend\\scripts\\run_scheduled_scrape.py

Linux cron:
    0 3 * * * cd /app/backend && python scripts/run_scheduled_scrape.py

Set SCRAPE_SOURCES as comma-separated source ids to run a subset.
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import AsyncSessionLocal
from app.services.maintenance import purge_old_raw_rows
from scrape_and_ingest import run_all


def _sources_from_env() -> list[str] | None:
    raw = os.getenv("SCRAPE_SOURCES", "").strip()
    if not raw:
        return None
    return [item.strip() for item in raw.split(",") if item.strip()]


async def _main() -> None:
    await run_all(_sources_from_env())
    async with AsyncSessionLocal() as db:
        await purge_old_raw_rows(db)


if __name__ == "__main__":
    asyncio.run(_main())
