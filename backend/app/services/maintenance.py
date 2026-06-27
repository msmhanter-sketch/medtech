"""Обслуживание БД: retention raw-слоя, очистка устаревших данных."""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ParsedPriceRow

log = logging.getLogger(__name__)

RAW_RETENTION_DAYS = 90


async def purge_old_raw_rows(db: AsyncSession, days: int = RAW_RETENTION_DAYS) -> int:
    """Удаляет raw-строки старше N дней (нормализованный слой PriceItem сохраняется)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    count_before = await db.scalar(
        select(func.count()).select_from(ParsedPriceRow).where(ParsedPriceRow.parsed_at < cutoff)
    )
    if not count_before:
        return 0
    await db.execute(delete(ParsedPriceRow).where(ParsedPriceRow.parsed_at < cutoff))
    await db.commit()
    log.info("purge_old_raw_rows: удалено %s строк старше %s дней", count_before, days)
    return count_before or 0
