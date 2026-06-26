"""
app/core/database.py — Async database engine и session factory.
Используем SQLAlchemy 2.x с asyncpg драйвером.
"""
import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./medtech.db",
)

is_sqlite = DATABASE_URL.startswith("sqlite")

# Пул соединений и аргументы подключения
if is_sqlite:
    engine = create_async_engine(
        DATABASE_URL,
        echo=os.getenv("APP_ENV") == "development",
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=os.getenv("APP_ENV") == "development",
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # проверяет живость соединения перед использованием
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

if is_sqlite:
    from sqlalchemy import event

    @event.listens_for(engine.sync_engine, "connect")
    def register_sqlite_functions(dbapi_connection, connection_record):
        def strpos(string, substring):
            if string is None or substring is None:
                return 0
            idx = string.find(substring)
            return idx + 1 if idx != -1 else 0

        dbapi_connection.create_function("strpos", 2, strpos)



async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency для получения сессии БД."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
