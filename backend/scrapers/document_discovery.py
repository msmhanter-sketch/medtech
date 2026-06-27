"""Обход сайта клиники: поиск PDF/DOCX/Excel и HTML-страниц с прайсами."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse, urldefrag

from scrapers.http_client import polite_get

DOC_EXTENSIONS = (".pdf", ".doc", ".docx", ".xlsx", ".xls")
PRICE_PATH_KEYWORDS = (
    "price", "pric", "prays", "прайс", "стоимост", "услуг", "uslug", "tarif", "tariff",
    "preis", "catalog", "каталог", "analiz", "анализ", "service",
)
PRICE_PAGE_KEYWORDS = (
    "прайс", "price", "стоимость", "услуг", "прейскурант", "tariff",
)


@dataclass
class DiscoveredAsset:
    url: str
    kind: str  # pdf | docx | xlsx | html
    link_text: str = ""


@dataclass
class DiscoveryResult:
    documents: list[DiscoveredAsset] = field(default_factory=list)
    html_pages: list[DiscoveredAsset] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _same_site(base: str, url: str) -> bool:
    b = urlparse(base)
    u = urlparse(url)
    if not u.netloc:
        return True
    if u.netloc == b.netloc:
        return True
    # поддомены одного домена (helix.ru / helix.kz — разные, не объединяем)
    return False


def _classify_url(url: str, link_text: str = "") -> str | None:
    low = url.lower().split("?")[0]
    for ext in DOC_EXTENSIONS:
        if low.endswith(ext):
            return ext.lstrip(".")
    combined = f"{url} {link_text}".lower()
    if any(k in combined for k in PRICE_PATH_KEYWORDS):
        return "html"
    return None


def discover_site_assets(
    base_url: str,
    client,
    *,
    max_pages: int = 25,
    max_documents: int = 40,
    delay_sec: float = 1.0,
) -> DiscoveryResult:
    result = DiscoveryResult()
    if not base_url or not base_url.startswith("http"):
        result.errors.append(f"Invalid base URL: {base_url}")
        return result

    visited: set[str] = set()
    queue: list[str] = [base_url]
    doc_urls: set[str] = set()
    html_urls: set[str] = set()

    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        url, _ = urldefrag(url)
        if url in visited:
            continue
        visited.add(url)

        try:
            resp = polite_get(client, url, delay_sec=delay_sec)
        except Exception as exc:
            result.errors.append(f"{url}: {exc}")
            continue

        html = resp.text or ""
        # Прямой документ по URL
        kind = _classify_url(url)
        if kind in ("pdf", "doc", "docx", "xlsx", "xls") and url not in doc_urls:
            doc_urls.add(url)
            result.documents.append(DiscoveredAsset(url=url, kind=kind))
            if len(result.documents) >= max_documents:
                break
            continue

        # Ссылки на странице
        for href, text in re.findall(r'href=["\']([^"\']+)["\'][^>]*>([^<]{0,120})', html, re.I):
            href = href.strip()
            if href.startswith(("mailto:", "tel:", "javascript:", "#")):
                continue
            abs_url = urljoin(url, href)
            abs_url, _ = urldefrag(abs_url)
            if not _same_site(base_url, abs_url):
                continue
            link_kind = _classify_url(abs_url, text)
            if link_kind in ("pdf", "doc", "docx", "xlsx", "xls"):
                if abs_url not in doc_urls and len(result.documents) < max_documents:
                    doc_urls.add(abs_url)
                    result.documents.append(
                        DiscoveredAsset(url=abs_url, kind=link_kind, link_text=text.strip())
                    )
            elif link_kind == "html" and abs_url not in html_urls:
                html_urls.add(abs_url)
                result.html_pages.append(
                    DiscoveredAsset(url=abs_url, kind="html", link_text=text.strip())
                )
                if abs_url not in visited and abs_url not in queue:
                    queue.append(abs_url)
            elif abs_url not in visited and abs_url not in queue and len(visited) + len(queue) < max_pages:
                low = abs_url.lower()
                if any(k in low for k in PRICE_PATH_KEYWORDS):
                    queue.append(abs_url)

        # Текущая страница — прайс HTML?
        page_low = html.lower()[:5000]
        if any(k in page_low for k in PRICE_PAGE_KEYWORDS) and url not in html_urls:
            html_urls.add(url)
            result.html_pages.append(DiscoveredAsset(url=url, kind="html"))

    return result
