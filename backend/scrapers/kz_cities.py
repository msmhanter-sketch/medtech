"""Справочник городов Казахстана: slug, название, координаты центра."""
from __future__ import annotations

# slug → (русское название, широта, долгота)
KZ_CITY_COORDS: dict[str, tuple[str, float, float]] = {
    "almaty": ("Алматы", 43.2383, 76.9455),
    "astana": ("Астана", 51.1282, 71.4304),
    "shymkent": ("Шымкент", 42.3417, 69.5901),
    "karaganda": ("Караганда", 49.8078, 73.0885),
    "aktobe": ("Актобе", 50.2839, 57.1670),
    "pavlodar": ("Павлодар", 52.2873, 76.9674),
    "ust-kamenogorsk": ("Усть-Каменогорск", 49.9480, 82.6278),
    "semey": ("Семей", 50.4111, 80.2275),
    "taraz": ("Тараз", 42.9000, 71.3667),
    "kyzylorda": ("Кызылорда", 44.8488, 65.4823),
    "aktau": ("Актау", 43.6500, 51.1600),
    "kokshetau": ("Кокшетау", 53.2833, 69.3833),
    "atyrau": ("Атырау", 47.1167, 51.8833),
    "petropavlovsk": ("Петропавловск", 54.8751, 69.1620),
    "kostanay": ("Костанай", 53.2144, 63.6246),
    "oral": ("Уральск", 51.2278, 51.3865),
    "turkestan": ("Туркестан", 43.2973, 68.2517),
    "temirtau": ("Темиртау", 50.0547, 72.9646),
    "rudny": ("Рудный", 52.9716, 63.1160),
    "ekibastuz": ("Экибастуз", 51.7297, 75.3266),
}

NAME_TO_SLUG: dict[str, str] = {v[0].lower(): k for k, v in KZ_CITY_COORDS.items()}


def city_display_name(slug: str, fallback: str | None = None) -> str:
    entry = KZ_CITY_COORDS.get(slug)
    if entry:
        return entry[0]
    return fallback or slug.replace("-", " ").title()


def city_coords(slug: str) -> tuple[float, float] | None:
    entry = KZ_CITY_COORDS.get(slug)
    if entry:
        return entry[1], entry[2]
    return None


def all_city_tuples() -> list[tuple[str, str, float, float]]:
    return [(slug, name, lat, lng) for slug, (name, lat, lng) in KZ_CITY_COORDS.items()]
