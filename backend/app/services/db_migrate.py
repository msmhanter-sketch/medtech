"""Добавляет новые колонки в SQLite без Alembic."""
from sqlalchemy import text

from app.core.database import engine


async def ensure_clinic_columns() -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    alters = [
        "ALTER TABLE clinics ADD COLUMN source_id VARCHAR(64)",
        "ALTER TABLE clinics ADD COLUMN external_id VARCHAR(128)",
    ]
    async with engine.begin() as conn:
        for sql in alters:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass
