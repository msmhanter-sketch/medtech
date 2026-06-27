from datetime import date, timedelta
from typing import Annotated, Optional
from uuid import UUID, uuid5

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Clinic, ParsedPriceRow, PriceItem, Service, ServiceCategory
from app.schemas.collected import CollectedCategory, CollectedDataRow, Currency

router = APIRouter(prefix="/api/data", tags=["data-contract"])

_CONTRACT_UUID_NAMESPACE = UUID("8b47a565-99a2-4f16-8423-f759f0d46244")

_CATEGORY_SLUGS: dict[CollectedCategory, set[str]] = {
    CollectedCategory.laboratory: {"analizy"},
    CollectedCategory.doctor_visit: {"priyom-vracha"},
    CollectedCategory.diagnostics: {"mrt", "uzi", "diagnostika"},
    CollectedCategory.procedure: {"stomatologiya", "pricelist"},
}


def _contract_uuid(kind: str, internal_id: int) -> UUID:
    return uuid5(_CONTRACT_UUID_NAMESPACE, f"{kind}:{internal_id}")


def _contract_category(slug: str) -> CollectedCategory:
    for category, slugs in _CATEGORY_SLUGS.items():
        if slug in slugs:
            return category
    return CollectedCategory.procedure


@router.get(
    "/collected",
    response_model=list[CollectedDataRow],
    summary="Собранные данные в структуре ТЗ 2.2",
    description=(
        "Возвращает нормализованные строки цен в канонической структуре из раздела 2.2 ТЗ: "
        "клиника, источник, raw-название услуги, нормализованная услуга, категория, цена и дата парсинга."
    ),
)
async def list_collected_data(
    db: Annotated[AsyncSession, Depends(get_db)],
    city: Optional[str] = Query(None, min_length=2, max_length=100),
    category: Optional[CollectedCategory] = Query(None),
    active_only: bool = Query(True, description="Только актуальные записи"),
    max_age_days: int = Query(30, ge=1, le=365, description="Возраст актуальной цены, дней"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[CollectedDataRow]:
    cutoff_date = date.today() - timedelta(days=max_age_days)

    raw_match = (
        ParsedPriceRow.clinic_id == PriceItem.clinic_id,
        ParsedPriceRow.matched_service_id == PriceItem.service_id,
        func.date(ParsedPriceRow.parsed_at) == PriceItem.price_date,
    )

    strict_source_url = (
        select(ParsedPriceRow.source_file)
        .where(*raw_match, ParsedPriceRow.raw_name == PriceItem.source_name)
        .order_by(ParsedPriceRow.match_score.desc(), ParsedPriceRow.id.asc())
        .limit(1)
        .correlate(PriceItem)
        .scalar_subquery()
    )
    loose_source_url = (
        select(ParsedPriceRow.source_file)
        .where(*raw_match)
        .order_by(ParsedPriceRow.match_score.desc(), ParsedPriceRow.id.asc())
        .limit(1)
        .correlate(PriceItem)
        .scalar_subquery()
    )
    loose_raw_name = (
        select(ParsedPriceRow.raw_name)
        .where(*raw_match)
        .order_by(ParsedPriceRow.match_score.desc(), ParsedPriceRow.id.asc())
        .limit(1)
        .correlate(PriceItem)
        .scalar_subquery()
    )
    strict_parsed_at = (
        select(ParsedPriceRow.parsed_at)
        .where(*raw_match, ParsedPriceRow.raw_name == PriceItem.source_name)
        .order_by(ParsedPriceRow.match_score.desc(), ParsedPriceRow.id.asc())
        .limit(1)
        .correlate(PriceItem)
        .scalar_subquery()
    )
    loose_parsed_at = (
        select(ParsedPriceRow.parsed_at)
        .where(*raw_match)
        .order_by(ParsedPriceRow.match_score.desc(), ParsedPriceRow.id.asc())
        .limit(1)
        .correlate(PriceItem)
        .scalar_subquery()
    )

    stmt = (
        select(
            Clinic.id.label("clinic_internal_id"),
            Clinic.name.label("clinic_name"),
            Clinic.city,
            Clinic.address,
            Clinic.phone,
            Clinic.working_hours,
            Clinic.website_url,
            Clinic.is_active.label("clinic_is_active"),
            Service.id.label("service_internal_id"),
            Service.name.label("service_name_norm"),
            Service.is_active.label("service_is_active"),
            ServiceCategory.slug.label("category_slug"),
            func.coalesce(PriceItem.source_name, loose_raw_name, Service.name).label("service_name_raw"),
            func.coalesce(strict_source_url, loose_source_url, Clinic.website_url, "").label("source_url"),
            PriceItem.price_kzt,
            PriceItem.currency,
            PriceItem.duration_days,
            PriceItem.price_date,
            func.coalesce(strict_parsed_at, loose_parsed_at, PriceItem.updated_at).label("parsed_at"),
        )
        .join(Clinic, PriceItem.clinic_id == Clinic.id)
        .join(Service, PriceItem.service_id == Service.id)
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .order_by(PriceItem.price_date.desc(), Clinic.name.asc(), Service.name.asc())
        .offset(offset)
        .limit(limit)
    )

    if city:
        stmt = stmt.where(Clinic.city.ilike(f"%{city}%"))
    if category:
        stmt = stmt.where(ServiceCategory.slug.in_(_CATEGORY_SLUGS[category]))
    if active_only:
        stmt = stmt.where(
            Clinic.is_active == True,  # noqa: E712
            Service.is_active == True,  # noqa: E712
            PriceItem.price_date >= cutoff_date,
        )

    rows = (await db.execute(stmt)).mappings().all()
    output: list[CollectedDataRow] = []
    for row in rows:
        row_is_active = (
            bool(row["clinic_is_active"])
            and bool(row["service_is_active"])
            and row["price_date"] >= cutoff_date
        )
        output.append(
            CollectedDataRow(
                clinic_id=_contract_uuid("clinic", row["clinic_internal_id"]),
                clinic_name=row["clinic_name"],
                city=row["city"],
                address=row["address"],
                phone=row["phone"],
                working_hours=row["working_hours"],
                source_url=row["source_url"] or "",
                service_id=_contract_uuid("service", row["service_internal_id"]),
                service_name_raw=row["service_name_raw"],
                service_name_norm=row["service_name_norm"],
                category=_contract_category(row["category_slug"]),
                price_kzt=row["price_kzt"],
                currency=Currency(row["currency"] or "KZT"),
                duration_days=row["duration_days"],
                parsed_at=row["parsed_at"],
                is_active=row_is_active,
            )
        )

    return output
