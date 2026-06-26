"""
SQLAlchemy v2 declarative base with async support.
All models inherit from this base.
"""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Universal base class for all ORM models."""

    # Автоматически добавляем временные метки во все таблицы (без таймзоны для совместимости с TIMESTAMP в PG)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )

    def to_dict(self) -> dict[str, Any]:
        """Serialize model instance to dictionary."""
        return {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
        }
