"""app/models/__init__.py — реэкспорт всех моделей."""
from app.models.base import Base
from app.models.models import Clinic, PriceItem, Service, ServiceCategory

__all__ = ["Base", "Clinic", "ServiceCategory", "Service", "PriceItem"]
