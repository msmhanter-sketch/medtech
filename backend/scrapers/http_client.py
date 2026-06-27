"""HTTP-клиент для скраперов с задержкой между запросами."""
import time
from typing import Optional

import httpx

DEFAULT_HEADERS = {
    "User-Agent": (
        "MedServicePriceBot/1.0 (+https://medserviceprice.kz; hackathon research)"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9",
}

_last_request_at = 0.0


def get_client(timeout: float = 60.0) -> httpx.Client:
    return httpx.Client(
        follow_redirects=True,
        timeout=timeout,
        headers=DEFAULT_HEADERS,
        verify=False,
    )


def polite_get(
    client: httpx.Client,
    url: str,
    *,
    delay_sec: float = 1.0,
    **kwargs,
) -> httpx.Response:
    """GET с паузой между запросами (уважение к источникам)."""
    global _last_request_at
    elapsed = time.monotonic() - _last_request_at
    if elapsed < delay_sec:
        time.sleep(delay_sec - elapsed)
    resp = client.get(url, **kwargs)
    _last_request_at = time.monotonic()
    resp.raise_for_status()
    return resp
