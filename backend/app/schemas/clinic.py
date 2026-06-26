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
    website_url: Optional[str] = None
    logo_url: Optional[str] = None

    # Поля цены — join из PriceItem
    price_kzt: Decimal = Field(..., description="Цена услуги в этой клинике")
    price_date: date = Field(..., description="Дата актуальности прайса")
    is_verified: bool = Field(..., description="Верифицирована ли цена вручную")
    is_cheapest: bool = Field(False, description="Флаг: самая низкая цена среди результатов")


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

class PaginatedResponse(BaseModel):
    """Универсальная обёртка для пагинированных ответов."""
    total: int
    page: int
    page_size: int
    items: list


class CompareResponse(BaseModel):
    """Ответ эндпоинта сравнения клиник."""
    service: ServiceRead
    city: str
    sort_by: str
    total_clinics: int
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    clinics: list[ClinicInCompare]
