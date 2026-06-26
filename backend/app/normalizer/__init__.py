"""
app/normalizer/__init__.py — Синглтон ServiceMatcher для всего приложения.

Матчер загружается один раз при старте FastAPI (через lifespan),
затем переиспользуется во всех запросах без повторных обращений к БД.
"""
from app.normalizer.matcher import NormalizationReport, ServiceMatcher

# Глобальный экземпляр — инициализируется в lifespan FastAPI
_matcher: ServiceMatcher | None = None


def get_matcher() -> ServiceMatcher:
    """FastAPI dependency / прямой доступ к синглтону."""
    global _matcher
    if _matcher is None:
        _matcher = ServiceMatcher()
    return _matcher


async def init_matcher(db) -> ServiceMatcher:
    """Вызывается при старте приложения. Загружает индекс из БД."""
    global _matcher
    _matcher = ServiceMatcher()
    await _matcher.load_index(db)
    return _matcher


__all__ = ["get_matcher", "init_matcher", "ServiceMatcher", "NormalizationReport"]
