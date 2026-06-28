import asyncio
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal
from app.models.models import Clinic, ParsedPriceRow, Service
from app.normalizer.matcher import ServiceMatcher
from sqlalchemy import select
from datetime import datetime, timezone

async def ingest_fast():
    parsed_dir = Path("c:/MedServicePrice.kz/data/parsed")
    
    async with AsyncSessionLocal() as db:
        matcher = ServiceMatcher()
        await matcher.load_index(db)
        
        for file in parsed_dir.glob("*.json"):
            with open(file, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except Exception as e:
                    continue
            
            for block in data:
                clinic_meta = block.get("clinic")
                if not clinic_meta: continue
                
                # get or create clinic
                res = await db.execute(
                    select(Clinic).where(Clinic.name == clinic_meta["name"], Clinic.city == clinic_meta["city"])
                )
                clinic = res.scalars().first()
                if not clinic:
                    clinic = Clinic(
                        name=clinic_meta["name"],
                        city=clinic_meta.get("city", "Неизвестно"),
                        address=clinic_meta.get("address", ""),
                        website_url=clinic_meta.get("website_url"),
                        phone=clinic_meta.get("phone"),
                        logo_url=clinic_meta.get("logo_url"),
                        latitude=clinic_meta.get("latitude"),
                        longitude=clinic_meta.get("longitude"),
                        rating=clinic_meta.get("rating"),
                        source_id=clinic_meta.get("source_id"),
                        external_id=clinic_meta.get("external_id"),
                        has_online_booking=bool(clinic_meta.get("has_online_booking", False)),
                    )
                    db.add(clinic)
                    await db.flush()
                else:
                    # Update fields if they were missing
                    if clinic.latitude is None and clinic_meta.get("latitude") is not None:
                        clinic.latitude = clinic_meta["latitude"]
                        clinic.longitude = clinic_meta["longitude"]
                    if not clinic.phone and clinic_meta.get("phone"):
                        clinic.phone = clinic_meta["phone"]
                    if clinic.rating is None and clinic_meta.get("rating") is not None:
                        clinic.rating = clinic_meta["rating"]
                    if not clinic.logo_url and clinic_meta.get("logo_url"):
                        clinic.logo_url = clinic_meta["logo_url"]
                    if not clinic.source_id and clinic_meta.get("source_id"):
                        clinic.source_id = clinic_meta["source_id"]
                    if not clinic.external_id and clinic_meta.get("external_id"):
                        clinic.external_id = clinic_meta["external_id"]
                    if not clinic.has_online_booking and clinic_meta.get("has_online_booking"):
                        clinic.has_online_booking = clinic_meta["has_online_booking"]
                
                services = block.get("services", [])
                for s in services:
                    price = s.get("price_kzt")
                    if not price or price <= 0: continue
                    raw_name = s.get("service_name_raw", "")
                    if not raw_name: continue
                    
                    match = matcher.match_single(raw_name)
                    
                    db.add(ParsedPriceRow(
                        clinic_id=clinic.id,
                        source_file=file.name,
                        raw_name=raw_name[:500],
                        raw_price=str(price),
                        parsed_price_kzt=price,
                        match_status=match.status,
                        matched_service_id=match.matched_service_id,
                        match_score=match.score,
                        parsed_at=datetime.now(timezone.utc),
                        duration_days=s.get("duration_days"),
                        currency="KZT",
                    ))
                
        await db.commit()

if __name__ == "__main__":
    asyncio.run(ingest_fast())
