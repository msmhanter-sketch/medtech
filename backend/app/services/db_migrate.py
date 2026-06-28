"""Добавляет новые колонки в SQLite без Alembic."""
from sqlalchemy import text

from app.core.database import engine


async def ensure_clinic_columns() -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    alters = [
        "ALTER TABLE clinics ADD COLUMN source_id VARCHAR(64)",
        "ALTER TABLE clinics ADD COLUMN external_id VARCHAR(128)",
        "ALTER TABLE clinics ADD COLUMN has_online_booking BOOLEAN NOT NULL DEFAULT 0",
    ]
    create_schedules_table = """
    CREATE TABLE IF NOT EXISTS parser_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parser_name VARCHAR(100) UNIQUE NOT NULL,
        interval VARCHAR(50) NOT NULL DEFAULT 'manual',
        next_run DATETIME,
        last_run DATETIME,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """
    async with engine.begin() as conn:
        for sql in alters:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass
        
        try:
            # Check if parser_schedules exists and has created_at column
            res = await conn.execute(text("SELECT count(*) FROM pragma_table_info('parser_schedules') WHERE name='created_at'"))
            has_created_at = res.scalar()
            # If the table exists but doesn't have created_at, drop it to recreate it
            # We first check if the table exists at all by running a quick select on sqlite_master
            check_table = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='parser_schedules'"))
            table_exists = check_table.scalar()
            if table_exists and not has_created_at:
                await conn.execute(text("DROP TABLE parser_schedules"))
        except Exception:
            pass

        try:
            await conn.execute(text(create_schedules_table))
        except Exception:
            pass

        try:
            await conn.execute(text(
                "UPDATE clinics SET has_online_booking = 1 WHERE source_id = 'doq'"
            ))
        except Exception:
            pass
