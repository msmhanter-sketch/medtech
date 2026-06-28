import asyncio, sys
sys.path.insert(0, '.')
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models.models import ParsedPriceRow

async def main():
    async with AsyncSessionLocal() as db:
        total = await db.scalar(select(func.count()).select_from(ParsedPriceRow))
        auto = await db.scalar(select(func.count()).select_from(ParsedPriceRow).where(ParsedPriceRow.match_status == 'auto_accepted'))
        review = await db.scalar(select(func.count()).select_from(ParsedPriceRow).where(ParsedPriceRow.match_status == 'needs_review'))
        not_found = await db.scalar(select(func.count()).select_from(ParsedPriceRow).where(ParsedPriceRow.match_status == 'not_found'))
        
        print(f"Total parsed rows: {total}")
        print(f"Auto accepted: {auto} ({auto/total*100:.1f}%)" if total else "Auto accepted: 0")
        print(f"Needs review: {review} ({review/total*100:.1f}%)" if total else "Needs review: 0")
        print(f"Not found: {not_found} ({not_found/total*100:.1f}%)" if total else "Not found: 0")

asyncio.run(main())
