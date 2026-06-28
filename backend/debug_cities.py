import asyncio, sys
sys.path.insert(0, '.')
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models.models import Clinic, ParserLog

async def main():
    async with AsyncSessionLocal() as db:
        # distinct cities
        result = await db.execute(select(Clinic.city, func.count()).group_by(Clinic.city))
        rows = result.all()
        print(f"Total distinct cities: {len(rows)}")
        for city, count in rows:
            print(f"City: {city!r} | Hex: {city.encode('utf-8').hex() if city else ''} | Count: {count}")
            
        # parser logs
        logs = await db.execute(select(ParserLog).order_by(ParserLog.created_at.desc()).limit(5))
        print("Latest parser logs:")
        for log in logs.scalars():
            print(f"Log: {log.parser_name} | Status: {log.status} | Recs: {log.records_processed} | Error: {log.error_message}")

asyncio.run(main())
