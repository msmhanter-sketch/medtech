"""Валидация названий услуг и цен после парсинга."""
import re
import unicodedata

# Короткие, но валидные мед. аббревиатуры
SHORT_OK = frozenset({
    "оак", "оам", "соя", "соэ", "мазок", "пцр", "узи", "мрт", "кт", "экг", "фгдс",
    "вич", "вгч", "пса", "ачтв", "мно", "ттг", "срб", "hb", "igg", "ige", "igm",
})

FOOTNOTE_MARKERS = (
    "предпочтительно", "рекомендуется", "примечание", "внимание", "обращаем ваше",
    "следует", "необходимо", "пациент", "образец", "контейнер",
)

JUNK_EXACT = frozenset({".", "-", "—", "№", "нет", "да", "и №"})

_JUNK_PREFIX = re.compile(
    r"^\d+\s+(консультаци|прием|приём|исследован|посещени|осмотр|визит|манипуляци)",
    re.I,
)

# Mojibake: UTF-8 прочитан как latin-1
_MOJIBAKE_RE = re.compile(r"[ÐÑÃ][\x80-\xbf]")


def normalize_name(raw: str) -> str:
    if not raw:
        return ""
    text = unicodedata.normalize("NFC", raw)
    text = text.replace("\t", " ").replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return fix_mojibake(text)


def fix_mojibake(text: str) -> str:
    """Пытается починить двойную кодировку (Ð°Ð²Ð° → ава)."""
    if not _MOJIBAKE_RE.search(text):
        return text
    for candidate in (text, text.replace("Ð ", "Ð")):
        try:
            fixed = candidate.encode("latin-1").decode("utf-8")
            if re.search(r"[а-яё]", fixed, re.I) and not _MOJIBAKE_RE.search(fixed):
                return fixed
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
    return text


def is_valid_service_name(name: str) -> bool:
    n = normalize_name(name)
    if not n or n.lower() in JUNK_EXACT:
        return False
    if n.startswith(("•", "·", "-", "—", "*")):
        return False
    if _MOJIBAKE_RE.search(n):
        return False
    lower = n.lower()
    if any(m in lower for m in FOOTNOTE_MARKERS):
        return False
    if _JUNK_PREFIX.match(lower):
        return False
    if re.match(r"^[\d\s\W]+$", n):
        return False
    letters = re.findall(r"[а-яёa-z]", lower, re.I)
    if len(n) < 5 and lower not in SHORT_OK:
        return False
    if len(letters) < 3:
        return False
    if len(n) > 350:
        return False
    return True


def is_valid_price(price: int | float) -> bool:
    try:
        p = int(price)
    except (TypeError, ValueError):
        return False
    return 300 <= p <= 3_000_000


def filter_scraped_items(items: list) -> tuple[list, int]:
    """Фильтрует ScrapedPrice list; возвращает (valid, skipped_count)."""
    out = []
    skipped = 0
    seen: set[tuple[str, int]] = set()
    for item in items:
        name = normalize_name(item.name)
        if not is_valid_service_name(name) or not is_valid_price(item.price):
            skipped += 1
            continue
        key = (name.lower(), int(item.price))
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        item.name = name
        out.append(item)
    return out, skipped
