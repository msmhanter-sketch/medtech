"""
app/api/history.py — Архив изменений цен.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, is_sqlite
from app.models.models import Clinic, PriceItem, Service
from app.utils.sources import build_source_meta

router = APIRouter(prefix="/api/history", tags=["history"])


def city_equals(column, city: str):
    normalized = city.strip()
    if is_sqlite:
        return func.trim(column) == normalized
    return func.lower(func.trim(column)) == normalized.lower()


class PriceHistoryPoint(BaseModel):
    price_date: date
    price_kzt: Decimal
    is_verified: bool
    match_score: Optional[int] = None
    source_name: Optional[str] = None
    change_kzt: Optional[Decimal] = None
    change_pct: Optional[float] = None


class PriceChangeEvent(BaseModel):
    clinic_id: int
    clinic_name: str
    city: str
    service_id: int
    service_name: str
    old_price: Decimal
    new_price: Decimal
    old_date: date
    new_date: date
    change_kzt: Decimal
    change_pct: float
    source_name: Optional[str] = None


@router.get(
    "/clinic/{clinic_id}/service/{service_id}",
    response_model=list[PriceHistoryPoint],
    summary="История цены услуги в клинике",
)
async def get_price_history(
    clinic_id: int,
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
) -> list[PriceHistoryPoint]:
    stmt = (
        select(PriceItem)
        .where(PriceItem.clinic_id == clinic_id, PriceItem.service_id == service_id)
        .order_by(desc(PriceItem.price_date))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return []

    points: list[PriceHistoryPoint] = []
    for i, row in enumerate(rows):
        change_kzt = None
        change_pct = None
        if i + 1 < len(rows):
            prev = rows[i + 1]
            change_kzt = row.price_kzt - prev.price_kzt
            if prev.price_kzt and prev.price_kzt != 0:
                change_pct = round(float(change_kzt / prev.price_kzt * 100), 1)
        points.append(
            PriceHistoryPoint(
                price_date=row.price_date,
                price_kzt=row.price_kzt,
                is_verified=row.is_verified,
                match_score=row.match_score,
                source_name=row.source_name,
                change_kzt=change_kzt,
                change_pct=change_pct,
            )
        )
    return points


@router.get(
    "/changes",
    summary="Архив изменений цен (все клиники)",
)
async def list_price_changes(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    clinic_id: Optional[int] = Query(None),
    service_id: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
) -> dict:
    stmt = (
        select(PriceItem, Clinic.name, Clinic.city, Service.name)
        .join(Clinic, PriceItem.clinic_id == Clinic.id)
        .join(Service, PriceItem.service_id == Service.id)
        .order_by(PriceItem.clinic_id, PriceItem.service_id, desc(PriceItem.price_date))
    )
    if clinic_id:
        stmt = stmt.where(PriceItem.clinic_id == clinic_id)
    if service_id:
        stmt = stmt.where(PriceItem.service_id == service_id)
    if city:
        stmt = stmt.where(city_equals(Clinic.city, city))

    rows = (await db.execute(stmt)).all()

    events: list[PriceChangeEvent] = []
    grouped: dict[tuple[int, int], list] = {}
    for pi, cname, ccity, sname in rows:
        key = (pi.clinic_id, pi.service_id)
        grouped.setdefault(key, []).append((pi, cname, ccity, sname))

    for (cid, sid), items in grouped.items():
        items.sort(key=lambda x: x[0].price_date, reverse=True)
        for i in range(len(items) - 1):
            new_pi, cname, ccity, sname = items[i]
            old_pi = items[i + 1][0]
            if new_pi.price_kzt == old_pi.price_kzt:
                continue
            change = new_pi.price_kzt - old_pi.price_kzt
            pct = float(change / old_pi.price_kzt * 100) if old_pi.price_kzt else 0.0
            events.append(
                PriceChangeEvent(
                    clinic_id=cid,
                    clinic_name=cname,
                    city=ccity,
                    service_id=sid,
                    service_name=sname,
                    old_price=old_pi.price_kzt,
                    new_price=new_pi.price_kzt,
                    old_date=old_pi.price_date,
                    new_date=new_pi.price_date,
                    change_kzt=change,
                    change_pct=round(pct, 1),
                    source_name=new_pi.source_name,
                )
            )

    events.sort(key=lambda e: e.new_date, reverse=True)
    total = len(events)
    page = events[offset : offset + limit]
    return {"total": total, "offset": offset, "items": page}


@router.get(
    "/sources/{clinic_id}",
    summary="Официальные источники прайсов клиники",
)
async def clinic_sources(
    clinic_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    from app.models.models import ParsedPriceRow

    clinic = await db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиника не найдена")

    stmt = (
        select(
            ParsedPriceRow.source_file,
            ParsedPriceRow.match_status,
            ParsedPriceRow.parsed_at,
        )
        .where(ParsedPriceRow.clinic_id == clinic_id)
        .order_by(desc(ParsedPriceRow.parsed_at))
        .limit(500)
    )
    rows = (await db.execute(stmt)).all()

    seen: set[str] = set()
    sources = []
    for source_file, match_status, parsed_at in rows:
        if not source_file or source_file in seen:
            continue
        seen.add(source_file)
        meta = build_source_meta(source_file, clinic.website_url)
        sources.append({
            **meta,
            "last_parsed_at": parsed_at.isoformat() if parsed_at else None,
            "match_status": match_status,
        })

    if clinic.website_url:
        sources.insert(0, build_source_meta(None, clinic.website_url) | {
            "last_parsed_at": None,
            "match_status": "official",
        })

    return {
        "clinic_id": clinic_id,
        "clinic_name": clinic.name,
        "city": clinic.city,
        "sources": sources,
    }
