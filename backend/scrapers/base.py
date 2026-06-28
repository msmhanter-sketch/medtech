"""Базовый класс скрапера."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ScrapedPrice:
  name: str
  price: float | int
  source_url: str
  duration_days: int | None = None
  extra: dict[str, Any] = field(default_factory=dict)  # source_type, document_date, content_hash


@dataclass
class BranchScrape:
  """Отдельная клиника/филиал внутри одного источника (например DOQ)."""
  clinic_meta: dict[str, Any]
  items: list[ScrapedPrice] = field(default_factory=list)


@dataclass
class ScrapeResult:
  source_id: str
  source_name: str
  source_url: str
  clinic_name: str
  city: str
  items: list[ScrapedPrice] = field(default_factory=list)
  errors: list[str] = field(default_factory=list)
  branches: list[BranchScrape] = field(default_factory=list)  # приоритет над items

  @property
  def ok(self) -> bool:
    return bool(self.items)


class BaseScraper(ABC):
  source_id: str
  source_name: str
  source_url: str
  clinic_name: str
  city: str
  address: str
  phone: str | None = None
  website_url: str | None = None
  logo_url: str | None = None
  latitude: float | None = None
  longitude: float | None = None
  rating: float | None = None
  working_hours: str | None = "09:00–18:00 (Пн-Пт)"

  @abstractmethod
  def scrape(self) -> ScrapeResult:
    ...

  def clinic_meta(self) -> dict[str, Any]:
    return {
      "name": self.clinic_name,
      "city": self.city,
      "address": self.address,
      "phone": self.phone,
      "working_hours": self.working_hours,
      "website_url": self.website_url or self.source_url,
      "logo_url": self.logo_url,
      "latitude": self.latitude,
      "longitude": self.longitude,
      "rating": self.rating,
      "has_online_booking": getattr(self, "has_online_booking", False),
    }

  def _result(self) -> ScrapeResult:
    return ScrapeResult(
      source_id=self.source_id,
      source_name=self.source_name,
      source_url=self.source_url,
      clinic_name=self.clinic_name,
      city=self.city,
    )
