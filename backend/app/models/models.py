"""
Core domain models: Clinic, ServiceCategory, Service, PriceItem.

Используем SQLAlchemy v2 с полной типизацией через Mapped[].
Все внешние ключи с каскадным поведением для целостности данных.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


# ─── Clinic ────────────────────────────────────────────────────────────────────

class Clinic(Base):
    """
    Медицинская клиника/лаборатория.
    Хранит геолокацию для сортировки по расстоянию от пользователя.
    """
    __tablename__ = "clinics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, comment="Полное название клиники"
    )
    city: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
        comment="Город: Астана, Алматы, Шымкент..."
    )
    address: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="Полный почтовый адрес"
    )

    # Координаты для geo-сортировки (Haversine в будущем)
    latitude: Mapped[Optional[float]] = mapped_column(
        nullable=True, comment="Широта (WGS-84)"
    )
    longitude: Mapped[Optional[float]] = mapped_column(
        nullable=True, comment="Долгота (WGS-84)"
    )

    # Рейтинг в диапазоне 0.0 — 5.0
    rating: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True, comment="Средний рейтинг (0.00–5.00)"
    )

    phone: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="Контактный телефон"
    )
    website_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="URL официального сайта"
    )
    logo_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="URL логотипа"
    )
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, comment="Флаг активности (не удалённые)"
    )

    # Relationships
    price_items: Mapped[list["PriceItem"]] = relationship(
        back_populates="clinic",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_clinics_city_rating", "city", "rating"),
    )

    def __repr__(self) -> str:
        return f"<Clinic id={self.id} name={self.name!r} city={self.city!r}>"


# ─── ServiceCategory ───────────────────────────────────────────────────────────

class ServiceCategory(Base):
    """
    Высокоуровневые категории услуг: МРТ, Анализы, Приём врача, УЗИ...
    Нужны для навигации и фильтрации на фронте.
    """
    __tablename__ = "service_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(200), nullable=False, unique=True,
        comment="Название категории (уникальное)"
    )
    slug: Mapped[str] = mapped_column(
        String(200), nullable=False, unique=True, index=True,
        comment="URL-slug для фронтенда (например, mrt, analizy)"
    )
    icon_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Иконка из lucide-react или emoji"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Краткое описание категории"
    )
    sort_order: Mapped[int] = mapped_column(
        default=0, nullable=False, comment="Порядок отображения в каталоге"
    )

    # Relationships
    services: Mapped[list["Service"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ServiceCategory id={self.id} name={self.name!r}>"


# ─── Service ───────────────────────────────────────────────────────────────────

class Service(Base):
    """
    Эталонная (нормализованная) запись услуги.
    Пример: id=42, name='Общий анализ крови (ОАК)'.
    Именно к этой записи мы привязываем прайсы клиник.

    Алиасы хранятся в поле aliases (JSONB-список строк) —
    помогают алгоритму нечёткого поиска сопоставлять сырые названия.
    """
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    category_id: Mapped[int] = mapped_column(
        ForeignKey("service_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(300), nullable=False, index=True,
        comment="Эталонное название услуги"
    )
    # Список синонимов для нечёткого матчинга: ['ОАК', 'Клинический анализ крови']
    aliases: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="JSON-массив синонимов/сокращений через запятую"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Что включает услуга"
    )
    unit: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="Единица измерения (мл, мин, пункт...)"
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    category: Mapped["ServiceCategory"] = relationship(back_populates="services")
    price_items: Mapped[list["PriceItem"]] = relationship(
        back_populates="service",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("category_id", "name", name="uq_service_category_name"),
    )

    def __repr__(self) -> str:
        return f"<Service id={self.id} name={self.name!r}>"


# ─── PriceItem ─────────────────────────────────────────────────────────────────

class PriceItem(Base):
    """
    Конкретная цена услуги в конкретной клинике.
    Это основная таблица сравнения — аналог строки прайс-листа.

    source_name — сырое название, как написано у клиники на сайте,
    до нормализации. Нужно для отладки алгоритма матчинга.
    """
    __tablename__ = "price_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    clinic_id: Mapped[int] = mapped_column(
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    price_kzt: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False,
        comment="Цена в тенге (KZT)"
    )
    price_date: Mapped[date] = mapped_column(
        Date, nullable=False,
        default=lambda: datetime.now(timezone.utc).date(),
        comment="Дата актуальности прайса"
    )

    # Сырое название от клиники до нормализации
    source_name: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        comment="Оригинальное название из прайса клиники"
    )
    # Достоверность матчинга (0–100), заполняется алгоритмом нормализации
    match_score: Mapped[Optional[int]] = mapped_column(
        nullable=True, comment="Score нечёткого сопоставления (0–100)"
    )
    is_verified: Mapped[bool] = mapped_column(
        default=False, nullable=False,
        comment="True если цена верифицирована вручную"
    )

    # Relationships
    clinic: Mapped["Clinic"] = relationship(back_populates="price_items")
    service: Mapped["Service"] = relationship(back_populates="price_items")

    __table_args__ = (
        # Уникальная пара: одна запись цены за дату для клиники/услуги
        UniqueConstraint(
            "clinic_id", "service_id", "price_date",
            name="uq_price_clinic_service_date"
        ),
        Index("ix_price_items_service_price", "service_id", "price_kzt"),
        Index("ix_price_items_clinic_service", "clinic_id", "service_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<PriceItem clinic_id={self.clinic_id} "
            f"service_id={self.service_id} price={self.price_kzt}>"
        )
