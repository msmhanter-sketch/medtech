"""Cleanup for legacy fallback rows inserted by old scraper versions."""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Clinic, ParsedPriceRow, PriceItem

LEGACY_FALLBACK_NAMES = {
    "Общий анализ крови (ОАК) автоматизированный",
    "Общий анализ мочи (ОАМ)",
    "Коагулограмма (АЧТВ, ПВ, МНО, Фибриноген)",
    "ПЦР-тест на COVID-19",
    "Биохимический анализ крови, базовый",
    "Витамин D (25-OH Vitamin D)",
    "ТТГ (Тиреотропный гормон)",
    "Гликированный гемоглобин (HbA1c)",
    "Железо сывороточное",
    "Ферритин",
    "АЛТ (Аланинаминотрансфераза)",
    "АСТ (Аспартатаминотрансфераза)",
    "Холестерин общий",
    "Глюкоза в крови",
    "Тестостерон общий",
    "Прием врача-терапевта",
    "Прием врача-кардиолога",
    "Прием врача-гинеколога",
    "Прием врача-невролога",
    "Прием врача-офтальмолога",
    "Прием врача-отоларинголога (ЛОР)",
    "Прием врача-уролога",
    "Прием врача-эндокринолога",
    "Прием врача-дерматолога",
    "Прием врача-гастроэнтеролога",
    "УЗИ брюшной полости",
    "УЗИ малого таза",
    "ЭКГ с расшифровкой",
    "Прием терапевта",
    "Прием кардиолога",
    "УЗИ почек",
    "Общий анализ крови",
    "Общий анализ мочи",
    "Рентген грудной клетки",
    "Массаж воротниковой зоны",
    "ПЦР диагностика COVID-19",
    "МРТ головного мозга",
    "КТ грудного сегмента",
    "ЭЭГ (электроэнцефалография)",
}

LEGACY_SOURCE_HINTS = ("invivo", "idoctor", "sunkar")


def _looks_like_legacy_source(value: str | None) -> bool:
    if not value:
        return False
    low = value.lower()
    return any(hint in low for hint in LEGACY_SOURCE_HINTS)


async def purge_legacy_fallback_prices(db: AsyncSession) -> dict[str, int]:
    clinic_rows = await db.execute(select(Clinic.id, Clinic.name, Clinic.source_id, Clinic.website_url))
    clinic_ids = [
        cid
        for cid, name, source_id, website_url in clinic_rows.all()
        if _looks_like_legacy_source(name)
        or _looks_like_legacy_source(source_id)
        or _looks_like_legacy_source(website_url)
    ]
    if not clinic_ids:
        return {"clinics_matched": 0, "raw_deleted": 0, "prices_deleted": 0}

    raw_result = await db.execute(
        delete(ParsedPriceRow).where(
            ParsedPriceRow.clinic_id.in_(clinic_ids),
            ParsedPriceRow.raw_name.in_(LEGACY_FALLBACK_NAMES),
        )
    )
    price_result = await db.execute(
        delete(PriceItem).where(
            PriceItem.clinic_id.in_(clinic_ids),
            PriceItem.source_name.in_(LEGACY_FALLBACK_NAMES),
        )
    )
    await db.commit()
    return {
        "clinics_matched": len(clinic_ids),
        "raw_deleted": raw_result.rowcount or 0,
        "prices_deleted": price_result.rowcount or 0,
    }
