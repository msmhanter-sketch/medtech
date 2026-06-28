from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Clinic, ParsedPriceRow, PriceItem, Service, ServiceCategory

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_clinics = await db.scalar(
        select(func.count()).select_from(Clinic).where(Clinic.is_active == True)  # noqa: E712
    )
    total_services = await db.scalar(
        select(func.count()).select_from(Service).where(Service.is_active == True)  # noqa: E712
    )
    total_prices = await db.scalar(select(func.count()).select_from(PriceItem))
    total_categories = await db.scalar(select(func.count()).select_from(ServiceCategory))

    cities = (
        await db.execute(
            select(Clinic.city, func.count())
            .where(Clinic.is_active == True)  # noqa: E712
            .group_by(Clinic.city)
        )
    ).all()

    cutoff = date.today() - timedelta(days=30)
    fresh_prices = await db.scalar(
        select(func.count()).select_from(PriceItem).where(PriceItem.price_date >= cutoff)
    )

    parsed_total = await db.scalar(select(func.count()).select_from(ParsedPriceRow)) or 0
    unmatched = await db.scalar(
        select(func.count())
        .select_from(ParsedPriceRow)
        .where(ParsedPriceRow.match_status == "not_found")
    ) or 0
    sources = await db.scalar(
        select(func.count(distinct(ParsedPriceRow.source_file))).select_from(ParsedPriceRow)
    ) or 0

    last_updated = await db.scalar(select(func.max(PriceItem.price_date)))

    # Подсчет логов парсеров (ошибки)
    from app.models.models import ParserLog
    error_logs = await db.scalar(
        select(func.count()).select_from(ParserLog).where(ParserLog.status == "error")
    ) or 0
    total_logs = await db.scalar(select(func.count()).select_from(ParserLog)) or 0

    match_rate = 0.0
    if parsed_total > 0:
        matched = parsed_total - unmatched
        match_rate = round(matched / parsed_total * 100, 1)

    return {
        "total_clinics": total_clinics or 0,
        "total_services": total_services or 0,
        "total_prices": total_prices or 0,
        "total_categories": total_categories or 0,
        "fresh_prices_30d": fresh_prices or 0,
        "total_cities": len(cities),
        "cities": [{"city": c, "clinics": n} for c, n in cities],
        "sources_loaded": sources,
        "parsed_rows": parsed_total,
        "unmatched_rows": unmatched,
        "match_rate_pct": match_rate,
        "error_logs": error_logs,
        "total_logs": total_logs,
        "last_updated": last_updated.isoformat() if last_updated else None,
    }
