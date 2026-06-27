"""
app/schemas/clinic.py — Pydantic v2 схемы для клиник и прайсов.
Используем model_config с from_attributes=True для ORM-режима.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


# ─── Clinic Schemas ────────────────────────────────────────────────────────────

class ClinicBase(BaseModel):
    name: str = Field(..., max_length=255, description="Название клиники")
    city: str = Field(..., max_length=100, description="Город")
    address: str = Field(..., max_length=500, description="Адрес")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    rating: Optional[Decimal] = Field(None, ge=0, le=5)
    phone: Optional[str] = Field(None, max_length=50)
    working_hours: Optional[str] = Field(None, max_length=200, description="Режим работы")
    website_url: Optional[str] = Field(None, max_length=500)
    logo_url: Optional[str] = Field(None, max_length=500)


class ClinicRead(ClinicBase):
    """Полная карточка клиники (возвращается в API)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ClinicInCompare(BaseModel):
    """Клиника в результатах сравнения — включает цену выбранной услуги."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[Decimal] = None
    phone: Optional[str] = None
    working_hours: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None

    # Поля цены — join из PriceItem
    price_kzt: Decimal = Field(..., description="Цена услуги в этой клинике")
    price_date: date = Field(..., description="Дата актуальности прайса")
    is_verified: bool = Field(..., description="Верифицирована ли цена вручную")
    is_cheapest: bool = Field(False, description="Флаг: самая низкая цена среди результатов")
    duration_days: Optional[int] = Field(None, description="Срок выполнения в днях (для анализов)")
    currency: str = Field("KZT", description="Валюта")
    source_name: Optional[str] = Field(None, description="Название услуги как на сайте клиники")
    source_url: Optional[str] = Field(None, description="URL источника прайса")
    match_score: Optional[int] = Field(None, description="Точность нормализации 0–100")
    source_parser: Optional[str] = Field(None, description="ID парсера (invitro, helix, …)")
    source_parser_label: Optional[str] = Field(None, description="Человекочитаемое имя источника")
    official_source_url: Optional[str] = Field(None, description="Официальный URL прайса")
    
    # Поле расстояния (вычисляется динамически)
    distance_km: Optional[float] = Field(None, description="Расстояние от пользователя в км")



# ─── Service & Category Schemas ────────────────────────────────────────────────

class ServiceCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    icon_name: Optional[str] = None
    description: Optional[str] = None
    sort_order: int


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int
    description: Optional[str] = None
    unit: Optional[str] = None


class ServiceSearchResult(BaseModel):
    """Результат автокомплита поиска услуги."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int
    category_name: str    # join из ServiceCategory
    description: Optional[str] = None


# ─── Response Wrappers ─────────────────────────────────────────────────────────

class ServiceCatalogItem(BaseModel):
    """Canonical service catalog item used by the normalizer."""

    id: int
    name: str
    aliases: list[str] = Field(default_factory=list)
    category_id: int
    category_name: str
    category_slug: str


class PaginatedResponse(BaseModel):
    """Универсальная обёртка для пагинированных ответов."""
    total: int
    page: int
    page_size: int
    items: list


class ClinicPriceItem(BaseModel):
    """Цена услуги в клинике для карточки клиники."""
    service_id: int
    service_name: str
    category_name: str
    price_kzt: Decimal
    price_date: date
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    is_verified: bool = False
    match_score: Optional[int] = None
    source_parser: Optional[str] = None
    source_parser_label: Optional[str] = None
    official_source_url: Optional[str] = None
    duration_days: Optional[int] = Field(None, description="Срок выполнения в днях")
    currency: str = Field("KZT", description="Валюта")


class CompareResponse(BaseModel):
    """Ответ эндпоинта сравнения клиник."""
    service: ServiceRead
    city: str
    sort_by: str
    total_clinics: int
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    clinics: list[ClinicInCompare]
