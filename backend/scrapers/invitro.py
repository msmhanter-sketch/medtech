"""Парсер прайса INVITRO Kazakhstan (invitro.kz)."""
import re

from scrapers.base import BaseScraper, ScrapedPrice, ScrapeResult
from scrapers.http_client import get_client, polite_get
from scrapers.validate import filter_scraped_items

CATALOG_URL = "https://invitro.kz/analizes/for-doctors/"


def _clean_title(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.replace("\xa0", " ")).strip()


def _extract_price(block: str) -> int | None:
    m = re.search(
        r'analyzes-item__total--sum">\s*([\d\s\u00a0]+)\s*₸',
        block,
        re.S,
    )
    if m:
        digits = re.sub(r"\D", "", m.group(1))
        if digits:
            return int(digits)
    m = re.search(r'data-product-price="(\d+)"', block)
    if m:
        return int(m.group(1))
    return None


def _extract_duration(block: str) -> int | None:
    m = re.search(r"(\d+)\s+календарн", block, re.I)
    return int(m.group(1)) if m else None


def parse_invitro_html(html: str, source_url: str) -> list[ScrapedPrice]:
    """Разбор карточек analyzes-item__container — полные названия и итоговая цена."""
    blocks = re.findall(
        r'class="analyzes-item__container">(.*?)(?=class="analyzes-item__container"|$)',
        html,
        flags=re.S,
    )

    items: list[ScrapedPrice] = []
    seen: set[tuple[str, int]] = set()

    for block in blocks:
        title_m = re.search(
            r'analyzes-item__title[^>]*>.*?<a[^>]*>\s*(.*?)\s*</a>',
            block,
            re.S,
        )
        if not title_m:
            continue
        name = _clean_title(title_m.group(1))
        price_val = _extract_price(block)
        article_m = re.search(r'data-product-article="([^"]+)"', block)
        article = article_m.group(1).strip() if article_m else None
        if not name or not price_val or price_val < 200:
            continue
        key = (article or name, price_val)
        if key in seen:
            continue
        seen.add(key)
        items.append(ScrapedPrice(
            name=name,
            price=price_val,
            source_url=source_url,
            duration_days=_extract_duration(block),
            extra={"article": article} if article else {},
        ))

    # Fallback: старый построчный разбор, если вёрстка изменилась
    if not items:
        items = _parse_invitro_plaintext(html, source_url)

    filtered, _ = filter_scraped_items(items)
    return filtered


def _parse_invitro_plaintext(html: str, source_url: str) -> list[ScrapedPrice]:
    plain = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.DOTALL | re.I)
    plain = re.sub(r"<[^>]+>", "\n", plain)
    plain = re.sub(r"\n+", "\n", plain)
    lines = [ln.strip() for ln in plain.split("\n") if ln.strip()]

    items: list[ScrapedPrice] = []
    seen: set[tuple[str, int]] = set()
    i = 0
    while i < len(lines):
        if re.match(r"^№\s*\d+", lines[i]) and i + 1 < len(lines):
            name_parts = [lines[i + 1].replace("\t", " ").strip()]
            j = i + 2
            while j < len(lines) and j < i + 6:
                nxt = lines[j]
                if nxt.startswith(("•", "·")) or re.match(r"^[\d\s\u00a0]+₸$", nxt):
                    break
                if re.match(r"^\d+\s+календарн", nxt, re.I):
                    break
                if re.match(r"^№", nxt):
                    break
                if len(nxt) > 5 and not nxt.startswith("Доступно"):
                    name_parts.append(nxt)
                    j += 1
                    continue
                break
            name = _clean_title(" ".join(name_parts))
            price_val: int | None = None
            duration: int | None = None
            for k in range(j, min(j + 15, len(lines))):
                if re.match(r"^(\d+)\s+календарн", lines[k], re.I):
                    m = re.match(r"^(\d+)", lines[k])
                    if m:
                        duration = int(m.group(1))
                if re.match(r"^[\d\s\u00a0]+₸$", lines[k]):
                    digits = re.sub(r"[^\d]", "", lines[k])
                    if digits and int(digits) > 200:
                        price_val = int(digits)
                        break
            if name and price_val and (name, price_val) not in seen:
                seen.add((name, price_val))
                items.append(ScrapedPrice(
                    name=name, price=price_val, source_url=source_url, duration_days=duration,
                ))
        i += 1
    return items


class InvitroScraper(BaseScraper):
    source_id = "invitro_kz"
    source_name = "INVITRO Kazakhstan"
    source_url = CATALOG_URL
    clinic_name = "INVITRO Казахстан"
    city = "Алматы"
    address = "Сеть лабораторий INVITRO по РК"
    phone = "+7 (727) 339-39-39"
    website_url = "https://invitro.kz"
    logo_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Invitro_logo.svg/320px-Invitro_logo.svg.png"
    latitude = 43.2551
    longitude = 76.9126
    rating = 4.7

    def scrape(self) -> ScrapeResult:
        result = self._result()
        try:
            with get_client(timeout=120) as client:
                resp = polite_get(client, CATALOG_URL, delay_sec=1.5)
                result.items = parse_invitro_html(resp.text, CATALOG_URL)
        except Exception as exc:
            result.errors.append(str(exc))
        return result
