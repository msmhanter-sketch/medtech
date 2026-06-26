"""
app/core/redis_client.py — Singleton Redis клиент для кэширования.
"""
import os
from typing import Optional

import redis.asyncio as redis_lib

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Глобальный пул соединений
_redis_pool: Optional[redis_lib.Redis] = None
_redis_available: bool = True


def is_redis_available() -> bool:
    """Возвращает True если Redis доступен."""
    global _redis_available
    return _redis_available


def set_redis_unavailable() -> None:
    """Помечает Redis как недоступный."""
    global _redis_available
    _redis_available = False


async def get_redis() -> redis_lib.Redis:
    """Возвращает singleton Redis клиент с пулом соединений."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis_lib.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
            socket_timeout=1.0,
            socket_connect_timeout=1.0,
        )
    return _redis_pool


async def close_redis() -> None:
    """Закрывает Redis соединение при завершении приложения."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None
