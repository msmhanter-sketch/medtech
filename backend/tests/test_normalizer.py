"""
tests/test_normalizer.py — Unit-тесты алгоритма нормализации.

Не требуют БД — используем load_index_from_list().
Запуск: pytest tests/test_normalizer.py -v
"""
import pytest
from decimal import Decimal

from app.normalizer.matcher import ServiceMatcher
from app.normalizer.text_utils import normalize_text, build_search_corpus
from app.normalizer.ingestion import parse_price


# ─── Фикстуры ──────────────────────────────────────────────────────────────────

SAMPLE_SERVICES = [
    {
        "id": 1,
        "name": "Общий анализ крови (ОАК)",
        "aliases": '["ОАК", "Клинический анализ крови", "CBC", "Общий анализ", "Анализ крови общий"]',
    },
    {
        "id": 2,
        "name": "Общий анализ мочи (ОАМ)",
        "aliases": '["ОАМ", "Анализ мочи", "Урина общий", "UAM"]',
    },
    {
        "id": 3,
        "name": "МРТ головного мозга",
        "aliases": '["МРТ мозга", "МРТ головы", "MRI brain", "МРТ ГМ"]',
    },
    {
        "id": 4,
        "name": "МРТ позвоночника (поясничный отдел)",
        "aliases": '["МРТ поясницы", "МРТ LS позвонков", "МРТ поясничный"]',
    },
    {
        "id": 5,
        "name": "УЗИ органов брюшной полости",
        "aliases": '["УЗИ брюшной полости", "УЗИ ОБП", "УЗИ живота"]',
    },
    {
        "id": 6,
        "name": "Профессиональная чистка зубов (Air Flow)",
        "aliases": '["Чистка зубов", "Air Flow", "Airflow", "Профчистка"]',
    },
    {
        "id": 7,
        "name": "Приём терапевта (первичный)",
        "aliases": '["Терапевт первичный", "Консультация терапевта"]',
    },
]


@pytest.fixture
def matcher() -> ServiceMatcher:
    """ServiceMatcher с тестовым индексом (без БД)."""
    m = ServiceMatcher()
    m.load_index_from_list(SAMPLE_SERVICES)
    return m


# ─── Тесты нормализации текста ─────────────────────────────────────────────────

class TestNormalizeText:

    def test_abbreviation_oak_expanded(self):
        # "ОАК" раскрывается в "общий анализ крови", но "анализ" — шумовое слово и удаляется
        res = normalize_text("ОАК")
        assert "общий" in res
        assert "крови" in res

    def test_abbreviation_mrt_expanded(self):
        assert "магнитно-резонансная томография" in normalize_text("МРТ головы")

    def test_noise_words_removed(self):
        result = normalize_text("Консультация терапевта (первичный)")
        assert "консультация" not in result
        assert "первичный" not in result

    def test_lowercase(self):
        result = normalize_text("ОБЩИЙ АНАЛИЗ КРОВИ")
        assert result == result.lower()

    def test_special_chars_removed(self):
        result = normalize_text("ОАК (срочно!!) №1")
        assert "!" not in result
        assert "№" not in result
        assert "(" not in result

    def test_empty_string(self):
        assert normalize_text("") == ""
        assert normalize_text("   ") == ""

    def test_html_tags_removed(self):
        result = normalize_text("<b>ОАК</b>")
        assert "<" not in result
        assert ">" not in result

    def test_kazakh_letters_preserved(self):
        # Буквы әіңғүұқөһ не должны удаляться регулярным выражением нормализатора
        result = normalize_text("Қан талдауы (ОАК) әдісі")
        assert "қан" in result
        assert "талдауы" in result
        assert "әдісі" in result


class TestBuildSearchCorpus:

    def test_includes_name(self):
        corpus = build_search_corpus("Общий анализ крови", None)
        assert len(corpus) >= 1
        assert corpus[0]  # не пустая строка

    def test_includes_aliases(self):
        corpus = build_search_corpus(
            "Общий анализ крови",
            '["Клинический анализ крови", "CBC"]'
        )
        assert len(corpus) >= 2

    def test_deduplication(self):
        # Если alias нормализуется в то же, что и name — не дублируется
        corpus = build_search_corpus("Общий анализ крови", '["Общий анализ крови"]')
        assert len(corpus) == len(set(corpus))

    def test_invalid_json_graceful(self):
        # Битый JSON не должен бросать исключение
        corpus = build_search_corpus("Test", "not_valid_json")
        assert len(corpus) == 1  # Только name


# ─── Тесты парсинга цен ────────────────────────────────────────────────────────

class TestParsePrice:

    def test_plain_number(self):
        assert parse_price("2500") == Decimal("2500")

    def test_space_thousands_separator(self):
        assert parse_price("2 500") == Decimal("2500")

    def test_nbsp_thousands_separator(self):
        assert parse_price("2\xa0500") == Decimal("2500")

    def test_tenge_suffix(self):
        assert parse_price("1800 тенге") == Decimal("1800")

    def test_tg_suffix(self):
        assert parse_price("3 200 тг") == Decimal("3200")

    def test_kzt_suffix(self):
        assert parse_price("5000 KZT") == Decimal("5000")

    def test_from_prefix(self):
        # "от 1800" → берём нижнюю границу
        result = parse_price("от 1800")
        assert result == Decimal("1800")

    def test_range_takes_first(self):
        result = parse_price("1800-2500")
        assert result == Decimal("1800")

    def test_decimal_comma(self):
        result = parse_price("1800,50")
        assert result == Decimal("1800.50")

    def test_comma_thousands(self):
        result = parse_price("2,500")
        assert result == Decimal("2500")

    def test_empty_returns_none(self):
        assert parse_price("") is None
        assert parse_price("   ") is None

    def test_text_only_returns_none(self):
        assert parse_price("по запросу") is None

    def test_negative_returns_none(self):
        # Отрицательная цена — невалидна
        assert parse_price("-500") is None


# ─── Тесты матчера ─────────────────────────────────────────────────────────────

class TestServiceMatcher:

    def test_exact_abbreviation_match(self, matcher: ServiceMatcher):
        """ОАК → Общий анализ крови."""
        result = matcher.match_single("ОАК")
        assert result.matched_service_id == 1
        assert result.status == "auto_accepted"
        assert result.score >= 82

    def test_synonym_match(self, matcher: ServiceMatcher):
        """Клинический анализ крови → Общий анализ крови."""
        result = matcher.match_single("Клинический анализ крови")
        assert result.matched_service_id == 1
        assert result.status == "auto_accepted"

    def test_noise_words_ignored(self, matcher: ServiceMatcher):
        """Консультация терапевта (первичная) → Приём терапевта."""
        result = matcher.match_single("Консультация терапевта первичная")
        assert result.matched_service_id == 7
        assert result.is_accepted or result.needs_review

    def test_mrt_head(self, matcher: ServiceMatcher):
        """МРТ головы без контраста → МРТ головного мозга."""
        result = matcher.match_single("МРТ головы без контраста")
        assert result.matched_service_id == 3

    def test_airflow_dental(self, matcher: ServiceMatcher):
        """Air Flow → Профессиональная чистка зубов."""
        result = matcher.match_single("Air Flow")
        assert result.matched_service_id == 6
        assert result.is_accepted

    def test_uzi_abdomen(self, matcher: ServiceMatcher):
        """УЗИ ОБП → УЗИ органов брюшной полости."""
        result = matcher.match_single("УЗИ ОБП")
        assert result.matched_service_id == 5

    def test_not_found(self, matcher: ServiceMatcher):
        """Полностью нерелевантная строка → not_found."""
        result = matcher.match_single("Ксерокопия паспорта")
        assert result.status == "not_found"
        assert result.matched_service_id is None

    def test_top_candidates_populated(self, matcher: ServiceMatcher):
        """top_candidates должен быть заполнен."""
        result = matcher.match_single("МРТ")
        assert len(result.top_candidates) > 0
        assert "service_id" in result.top_candidates[0]
        assert "score" in result.top_candidates[0]

    def test_price_list_batch(self, matcher: ServiceMatcher):
        """Пакетная обработка."""
        names = ["ОАК", "МРТ головы", "Ксерокопия паспорта"]
        report = matcher.match_price_list(names)
        assert report.processed_count == 3
        assert len(report.auto_accepted) >= 1
        assert len(report.not_found) >= 1
        assert report.auto_rate > 0

    def test_matcher_not_loaded_raises(self):
        """Матчер без индекса должен бросать RuntimeError."""
        m = ServiceMatcher()
        with pytest.raises(RuntimeError, match="Индекс не загружен"):
            m.match_single("ОАК")

    def test_cbc_english_alias(self, matcher: ServiceMatcher):
        """CBC (английская аббревиатура) → ОАК."""
        result = matcher.match_single("CBC blood test")
        assert result.matched_service_id == 1


class TestScrapeValidation:
    def test_rejects_garbage(self):
        from scrapers.validate import is_valid_service_name, is_valid_price

        assert not is_valid_service_name(".")
        assert not is_valid_service_name("1 консультация")
        assert not is_valid_service_name("•\tПри проведении аллергологического")
        assert is_valid_service_name("Общий анализ крови (ОАК)")
        assert is_valid_service_name("СОЭ")
        assert is_valid_price(1500)
        assert not is_valid_price(50)
        assert not is_valid_price(9_000_000)
