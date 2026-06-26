"""
app/normalizer/ingestion.py — Сервис записи нормализованных прайсов в БД.

После того как matcher вернул MatchResult со status="auto_accepted",
этот сервис создаёт или обновляет записи PriceItem.

Логика upsert:
  - Если запись (clinic_id, service_id, price_date) уже есть → обновляем цену.
  - Если нет → создаём новую.
  - Записи с status="needs_review" пишем с is_verified=False (флаг для ревью).
"""
import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import PriceItem
from app.normalizer.matcher import MatchResult

log = logging.getLogger(__name__)


@dataclass
class RawPriceRow:
    """
    Одна строка из исходного прайс-листа клиники.

    Пример входных данных (как они приходят с сайта клиники):
        RawPriceRow(name="ОАК срочный", price_str="2 500 тенге")
    """
    name: str
    price_str: str                       # Сырая строка цены (может быть "2 500", "от 1800")
    price_date: Optional[date] = None    # None → используем сегодня


def parse_price(price_str: str) -> Optional[Decimal]:
    """
    Парсит сырую строку цены в Decimal.

    Обрабатывает форматы:
      "2 500"        → 2500
      "2,500"        → 2500
      "от 1800"      → 1800   (берём нижнюю границу)
      "1800 тенге"   → 1800
      "1,800.50"     → 1800.50
      ""             → None

    Args:
        price_str: Строка цены из прайса.

    Returns:
        Decimal или None если не удалось распарсить.
    """
    if not price_str:
        return None

    raw = price_str.strip().lower()

    # Убираем слова-мусор
    for noise in ["тенге", "тг", "kzt", "₸", "руб", "от", "до", "~", "≈"]:
        raw = raw.replace(noise, "")

    # Убираем пробелы (разделители тысяч)
    raw = raw.replace(" ", "").replace("\xa0", "")

    # Нормализуем запятую как десятичный разделитель
    # "2,500" — это 2500 или 2.5? В казахстанском контексте — 2500
    # Если после запятой ровно 3 цифры — это разделитель тысяч
    import re
    # Находим все числа в строке (на случай диапазона "1800-2500")
    numbers = re.findall(r"-?[\d.,]+", raw)
    if not numbers:
        return None

    # Берём первое число (нижняя граница для диапазонов)
    number_str = numbers[0]

    # Определяем десятичный разделитель
    if "," in number_str and "." in number_str:
        # "1,800.50" → 1800.50
        number_str = number_str.replace(",", "")
    elif "," in number_str:
        parts = number_str.split(",")
        if len(parts) == 2 and len(parts[1]) == 3:
            # "2,500" → разделитель тысяч
            number_str = number_str.replace(",", "")
        else:
            # "2,50" → десятичный разделитель
            number_str = number_str.replace(",", ".")

    try:
        value = Decimal(number_str)
        if value <= 0:
            return None
        return value
    except InvalidOperation:
        log.debug(f"parse_price: не удалось распарсить {price_str!r}")
        return None


@dataclass
class IngestionResult:
    """Итог загрузки прайс-листа одной клиники в БД."""
    clinic_id: int
    total_rows: int
    inserted: int = 0
    updated: int = 0
    skipped_no_match: int = 0
    skipped_parse_error: int = 0
    errors: list[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []

    def to_dict(self) -> dict:
        return {
            "clinic_id": self.clinic_id,
            "total_rows": self.total_rows,
            "inserted": self.inserted,
            "updated": self.updated,
            "skipped_no_match": self.skipped_no_match,
            "skipped_parse_error": self.skipped_parse_error,
            "errors": self.errors,
        }


async def ingest_price_list(
    db: AsyncSession,
    clinic_id: int,
    raw_rows: list[RawPriceRow],
    match_results: list[MatchResult],
    price_date: Optional[date] = None,
    accept_review: bool = False,  # Если True — принимаем и needs_review
) -> IngestionResult:
    """
    Записывает нормализованные прайс-строки в таблицу PriceItem.

    Использует PostgreSQL INSERT ... ON CONFLICT DO UPDATE (upsert),
    чтобы повторный запуск парсера не создавал дубли.

    Args:
        db: Асинхронная сессия SQLAlchemy.
        clinic_id: ID клиники, для которой загружаем прайс.
        raw_rows: Список исходных строк прайса.
        match_results: Результаты нормализации (от ServiceMatcher).
        price_date: Дата актуальности. По умолчанию — сегодня.
        accept_review: Если True, записываем и "needs_review" (с is_verified=False).

    Returns:
        IngestionResult со статистикой.
    """
    from datetime import date as date_type

    effective_date = price_date or date_type.today()
    report = IngestionResult(clinic_id=clinic_id, total_rows=len(raw_rows))

    if len(raw_rows) != len(match_results):
        raise ValueError(
            f"Длина raw_rows ({len(raw_rows)}) != match_results ({len(match_results)})"
        )

    for raw_row, match in zip(raw_rows, match_results):
        # ── Проверяем статус матча ────────────────────────────────────────
        should_write = (
            match.status == "auto_accepted"
            or (accept_review and match.status == "needs_review")
        )

        if not should_write or match.matched_service_id is None:
            report.skipped_no_match += 1
            continue

        # ── Парсим цену ───────────────────────────────────────────────────
        price = parse_price(raw_row.price_str)
        if price is None:
            log.warning(
                f"ingest: не удалось распарсить цену {raw_row.price_str!r} "
                f"для {raw_row.name!r}"
            )
            report.skipped_parse_error += 1
            report.errors.append(
                f"Ошибка парсинга цены: {raw_row.name!r} → {raw_row.price_str!r}"
            )
            continue

        is_verified = match.status == "auto_accepted" and match.score >= 90

        # ── Database-Agnostic UPSERT ──────────────────────────────────────
        try:
            # 1. Проверяем существование записи
            target_date = raw_row.price_date or effective_date
            stmt = select(PriceItem).where(
                (PriceItem.clinic_id == clinic_id)
                & (PriceItem.service_id == match.matched_service_id)
                & (PriceItem.price_date == target_date)
            )
            result = await db.execute(stmt)
            existing_price = result.scalar_one_or_none()

            if existing_price:
                # Обновляем существующую запись
                existing_price.price_kzt = price
                existing_price.source_name = raw_row.name
                existing_price.match_score = match.score
                existing_price.is_verified = is_verified
                report.updated += 1
            else:
                # Вставляем новую запись
                new_price = PriceItem(
                    clinic_id=clinic_id,
                    service_id=match.matched_service_id,
                    price_kzt=price,
                    price_date=target_date,
                    source_name=raw_row.name,
                    match_score=match.score,
                    is_verified=is_verified,
                )
                db.add(new_price)
                report.inserted += 1

        except Exception as exc:
            log.error(
                f"ingest: ошибка записи {raw_row.name!r}: {exc}", exc_info=True
            )
            report.errors.append(f"DB error for {raw_row.name!r}: {str(exc)[:200]}")

    await db.commit()

    log.info(
        f"ingest clinic_id={clinic_id}: "
        f"inserted={report.inserted}, updated={report.updated}, "
        f"skipped_match={report.skipped_no_match}, "
        f"skipped_price={report.skipped_parse_error}"
    )

    return report
