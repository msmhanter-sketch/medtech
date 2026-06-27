"""Диагностика парсеров — python scripts/diag_parsers.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            text(
                "SELECT s.name, c.name, pi.price_kzt FROM services s "
                "JOIN price_items pi ON pi.service_id=s.id "
                "JOIN clinics c ON c.id=pi.clinic_id "
                "WHERE s.name GLOB '1 *' OR s.name = '1 консультация' "
                "OR s.name = '1 прием' LIMIT 30"
            )
        )
        print("=== junk 1 * in DB ===")
        for row in r:
            print(float(row[2]), row[1], repr(row[0][:80]))

        r = await db.execute(
            text(
                "SELECT s.name, COUNT(*) FROM services s "
                "WHERE LENGTH(s.name) > 180 GROUP BY s.name ORDER BY COUNT(*) DESC LIMIT 10"
            )
        )
        print("\n=== long/truncated names ===")
        for row in r:
            print(row[1], repr(row[0][:150]))


if __name__ == "__main__":
    asyncio.run(main())
