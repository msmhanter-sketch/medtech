from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CollectedCategory(str, Enum):
    laboratory = "лаборатория"
    doctor_visit = "приём врача"
    diagnostics = "диагностика"
    procedure = "процедура"


class Currency(str, Enum):
    kzt = "KZT"
    usd = "USD"


class CollectedDataRow(BaseModel):
    clinic_id: UUID = Field(..., description="Уникальный идентификатор клиники")
    clinic_name: str = Field(..., description="Название клиники")
    city: str = Field(..., description="Город")
    address: str = Field(..., description="Адрес")
    phone: Optional[str] = Field(None, description="Телефон")
    working_hours: Optional[str] = Field(None, description="Режим работы")
    source_url: str = Field(..., description="URL источника данных")
    service_id: UUID = Field(..., description="Уникальный идентификатор услуги")
    service_name_raw: str = Field(..., description="Наименование услуги как на сайте")
    service_name_norm: str = Field(..., description="Нормализованное название")
    category: CollectedCategory = Field(..., description="Категория услуги")
    price_kzt: Decimal = Field(..., description="Цена в тенге")
    currency: Currency = Field(Currency.kzt, description="Валюта исходной цены")
    duration_days: Optional[int] = Field(None, description="Срок выполнения, дней")
    parsed_at: datetime = Field(..., description="Дата и время парсинга")
    is_active: bool = Field(..., description="Флаг актуальности записи")
