"""Remove legacy fallback price rows inserted by old scraper versions.

Run from backend/:
    python scripts/purge_legacy_fallback_prices.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.database import AsyncSessionLocal
from app.services.legacy_fallback_cleanup import purge_legacy_fallback_prices


async def main() -> dict[str, int]:
    async with AsyncSessionLocal() as db:
        return await purge_legacy_fallback_prices(db)


if __name__ == "__main__":
    print(asyncio.run(main()))
