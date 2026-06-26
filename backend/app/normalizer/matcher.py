"""
app/normalizer/matcher.py — Ядро алгоритма нормализации прайс-листов.

Алгоритм:
  1. Загружаем эталонные услуги из БД (с синонимами)
  2. Нормализуем каждое входное название (text_utils.normalize_text)
  3. Ищем лучший матч через rapidfuzz (WRatio — оптимален для медтекстов)
  4. По score распределяем по зонам:
       ≥ AUTO_ACCEPT_THRESHOLD  → автоматически принято
       ≥ REVIEW_THRESHOLD       → уходит в очередь ревью
       < REVIEW_THRESHOLD       → не найдено
  5. Возвращаем структурированный результат для каждой строки

Библиотека rapidfuzz выбрана вместо fuzzywuzzy:
  - Написана на C++ (в 10–100x быстрее fuzzywuzzy)
  - Полная совместимость API
  - Нет зависимости от python-Levenshtein
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

from rapidfuzz import fuzz, process
from rapidfuzz.utils import default_process

from app.normalizer.text_utils import build_search_corpus, normalize_text

log = logging.getLogger(__name__)

# ─── Пороги уверенности (настраиваются под специфику клиники) ─────────────────
AUTO_ACCEPT_THRESHOLD = 82  # score ≥ 82 → принимаем автоматически
REVIEW_THRESHOLD = 60       # score 60–81 → очередь ревью
# score < 60 → не найдено


@dataclass
class ServiceEntry:
    """Эталонная запись услуги для индекса матчинга."""
    service_id: int
    canonical_name: str           # Оригинальное название из БД
    normalized_variants: list[str]  # Нормализованные варианты (name + aliases)


@dataclass
class MatchResult:
    """Результат сопоставления одной строки прайса с эталонной базой."""
    raw_input: str                          # Оригинальное название из прайса
    normalized_input: str                   # После normalize_text()

    # Поля заполняются при успешном матче
    matched_service_id: Optional[int] = None
    matched_name: Optional[str] = None     # Каноническое название эталона
    matched_variant: Optional[str] = None  # Конкретный вариант, на который попал матч
    score: int = 0                         # 0–100

    # Статус
    status: str = "not_found"  # "auto_accepted" | "needs_review" | "not_found"

    # Для отладки: все топ-кандидаты
    top_candidates: list[dict] = field(default_factory=list)

    @property
    def is_accepted(self) -> bool:
        return self.status == "auto_accepted"

    @property
    def needs_review(self) -> bool:
        return self.status == "needs_review"


class ServiceMatcher:
    """
    Движок нечёткого сопоставления медицинских услуг.

    Загружает эталонный индекс один раз и многократно применяет
    его к входящим прайс-листам.

    Usage:
        matcher = ServiceMatcher()
        await matcher.load_index(db_session)  # один раз при старте

        results = matcher.match_price_list([
            "ОАК срочный",
            "МРТ головы без контраста",
            "Чистка зубов Air flow",
        ])
    """

    def __init__(
        self,
        auto_threshold: int = AUTO_ACCEPT_THRESHOLD,
        review_threshold: int = REVIEW_THRESHOLD,
    ) -> None:
        self._index: list[ServiceEntry] = []
        self._flat_corpus: list[str] = []      # Все нормализованные варианты
        self._corpus_to_entry: dict[str, ServiceEntry] = {}  # variant → entry
        self.auto_threshold = auto_threshold
        self.review_threshold = review_threshold
        self._loaded = False

    async def load_index(self, db) -> int:
        """
        Загружает все активные услуги из БД и строит поисковый индекс.

        Должен вызываться один раз при старте приложения или
        при обновлении каталога услуг.

        Returns:
            Количество загруженных вариантов (name + aliases).
        """
        from sqlalchemy import select
        from app.models.models import Service

        log.info("ServiceMatcher: загружаем индекс из БД...")

        stmt = select(Service).where(Service.is_active == True)  # noqa: E712
        result = await db.execute(stmt)
        services = result.scalars().all()

        self._index.clear()
        self._flat_corpus.clear()
        self._corpus_to_entry.clear()

        for svc in services:
            variants = build_search_corpus(svc.name, svc.aliases)
            entry = ServiceEntry(
                service_id=svc.id,
                canonical_name=svc.name,
                normalized_variants=variants,
            )
            self._index.append(entry)

            for variant in variants:
                if variant:
                    self._flat_corpus.append(variant)
                    self._corpus_to_entry[variant] = entry

        self._loaded = True
        log.info(
            f"ServiceMatcher: индекс построен — "
            f"{len(services)} услуг, {len(self._flat_corpus)} вариантов"
        )
        return len(self._flat_corpus)

    def load_index_from_list(self, services_data: list[dict]) -> int:
        """
        Альтернативный загрузчик из словарей (без БД, для тестов).

        Args:
            services_data: Список словарей с ключами:
                           id, name, aliases (JSON-строка или None)
        """
        self._index.clear()
        self._flat_corpus.clear()
        self._corpus_to_entry.clear()

        for svc in services_data:
            variants = build_search_corpus(svc["name"], svc.get("aliases"))
            entry = ServiceEntry(
                service_id=svc["id"],
                canonical_name=svc["name"],
                normalized_variants=variants,
            )
            self._index.append(entry)
            for variant in variants:
                if variant:
                    self._flat_corpus.append(variant)
                    self._corpus_to_entry[variant] = entry

        self._loaded = True
        return len(self._flat_corpus)

    def match_single(self, raw_name: str, top_n: int = 5) -> MatchResult:
        """
        Сопоставляет одно название услуги с эталонным индексом.

        Args:
            raw_name: Название из прайса клиники (любой формат).
            top_n: Сколько кандидатов сохранить в top_candidates (для отладки).

        Returns:
            MatchResult с заполненными полями.
        """
        if not self._loaded:
            raise RuntimeError(
                "Индекс не загружен. Вызовите load_index() или load_index_from_list()."
            )

        normalized = normalize_text(raw_name)
        result = MatchResult(raw_input=raw_name, normalized_input=normalized)

        if not normalized:
            log.debug(f"match_single: пустая строка после нормализации: {raw_name!r}")
            return result

        if not self._flat_corpus:
            log.warning("match_single: корпус пуст, нет услуг в индексе")
            return result

        # ── Fuzzy-поиск через rapidfuzz ───────────────────────────────────
        # WRatio = взвешенный hybrid scorer:
        #   - token_sort_ratio    (порядок слов не важен)
        #   - token_set_ratio     (обрабатывает вложения: "МРТ мозга" ⊂ "МРТ головного мозга")
        #   - partial_ratio       (если одна строка — подстрока другой)
        #   - ratio               (классическое редакционное расстояние)
        # Это оптимально для коротких медицинских фраз.
        candidates = process.extract(
            query=normalized,
            choices=self._flat_corpus,
            scorer=fuzz.WRatio,
            limit=top_n,
            processor=None,  # мы уже нормализовали вручную
        )

        if not candidates:
            return result

        # Сохраняем топ-кандидатов для отладки
        result.top_candidates = [
            {
                "variant": cand[0],
                "score": round(cand[1]),
                "service_id": self._corpus_to_entry[cand[0]].service_id,
                "service_name": self._corpus_to_entry[cand[0]].canonical_name,
            }
            for cand in candidates
            if cand[0] in self._corpus_to_entry
        ]

        best_variant, best_score, _ = candidates[0]
        best_score = round(best_score)
        best_entry = self._corpus_to_entry.get(best_variant)

        if best_entry is None:
            return result

        result.matched_service_id = best_entry.service_id
        result.matched_name = best_entry.canonical_name
        result.matched_variant = best_variant
        result.score = best_score

        # ── Распределение по зонам ────────────────────────────────────────
        if best_score >= self.auto_threshold:
            result.status = "auto_accepted"
        elif best_score >= self.review_threshold:
            result.status = "needs_review"
        else:
            result.status = "not_found"
            # Сбрасываем ID — не хотим записывать ненадёжный матч
            result.matched_service_id = None

        log.debug(
            f"match_single: {raw_name!r} → "
            f"{result.matched_name!r} [score={best_score}, status={result.status}]"
        )

        return result

    def match_price_list(
        self, raw_names: list[str]
    ) -> "NormalizationReport":
        """
        Пакетная обработка прайс-листа клиники.

        Args:
            raw_names: Список названий услуг из прайса (как есть).

        Returns:
            NormalizationReport со статистикой и разбивкой по категориям.
        """
        if not raw_names:
            return NormalizationReport(results=[], source_count=0)

        results: list[MatchResult] = []
        for name in raw_names:
            if isinstance(name, str) and name.strip():
                results.append(self.match_single(name))

        return NormalizationReport(results=results, source_count=len(raw_names))


# ─── NormalizationReport ──────────────────────────────────────────────────────

@dataclass
class NormalizationReport:
    """
    Сводный отчёт по нормализации прайс-листа.
    Содержит статистику и разбивку результатов по статусам.
    """
    results: list[MatchResult]
    source_count: int  # Исходное кол-во строк (включая пустые)

    @property
    def processed_count(self) -> int:
        return len(self.results)

    @property
    def auto_accepted(self) -> list[MatchResult]:
        return [r for r in self.results if r.status == "auto_accepted"]

    @property
    def needs_review(self) -> list[MatchResult]:
        return [r for r in self.results if r.status == "needs_review"]

    @property
    def not_found(self) -> list[MatchResult]:
        return [r for r in self.results if r.status == "not_found"]

    @property
    def auto_rate(self) -> float:
        """Процент автоматически принятых совпадений."""
        if not self.processed_count:
            return 0.0
        return round(len(self.auto_accepted) / self.processed_count * 100, 1)

    def summary(self) -> dict:
        return {
            "source_rows": self.source_count,
            "processed": self.processed_count,
            "auto_accepted": len(self.auto_accepted),
            "needs_review": len(self.needs_review),
            "not_found": len(self.not_found),
            "auto_rate_pct": self.auto_rate,
        }

    def to_dict(self) -> dict:
        """Полный отчёт для API-ответа."""
        return {
            "summary": self.summary(),
            "auto_accepted": [
                {
                    "raw": r.raw_input,
                    "matched_service_id": r.matched_service_id,
                    "matched_name": r.matched_name,
                    "score": r.score,
                }
                for r in self.auto_accepted
            ],
            "needs_review": [
                {
                    "raw": r.raw_input,
                    "normalized": r.normalized_input,
                    "best_match": r.matched_name,
                    "best_score": r.score,
                    "candidates": r.top_candidates,
                }
                for r in self.needs_review
            ],
            "not_found": [
                {
                    "raw": r.raw_input,
                    "normalized": r.normalized_input,
                    "best_score": r.score,
                    "candidates": r.top_candidates[:2],  # топ-2 для подсказки
                }
                for r in self.not_found
            ],
        }
