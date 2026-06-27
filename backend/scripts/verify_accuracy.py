"""Сверка цен в БД с live-парсерами для ключевых услуг."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from scrapers.invitro import InvitroScraper
from scrapers.helix import HelixScraper
from scrapers.kdlolymp import make_kdlolymp_scraper

# (service_name_substr, invitro_needle, helix_needle, kdl_needle)
BENCHMARKS = [
    ("Общий анализ крови", "общий анализ крови", "общий анализ крови", "клинический анализ крови"),
    ("СОЭ", "соэ (c", "соэ", "оседания"),
    ("Глюкоза", "глюкоза", "глюкоза", "глюкоз"),
]


def _find(items: dict[str, int], needle: str) -> int | None:
    n = needle.lower()
    # 1. Точное совпадение
    for name, price in items.items():
        if name.lower() == n:
            return price
    # 2. Совпадение по началу/концу строки с ограничением длины
    for name, price in items.items():
        if name.lower().startswith(n) or name.lower().endswith(n):
            if len(name) < len(needle) + 15:
                return price
    # 3. Фолбэк на подстроку
    for name, price in items.items():
        if n in name.lower():
            return price
    return None


def _live_catalogs() -> dict[str, dict[str, int]]:
    inv = {i.name: int(i.price) for i in InvitroScraper().scrape().items}
    hel = {i.name: int(i.price) for i in HelixScraper().scrape().items}
    kdl = {i.name: int(i.price) for i in make_kdlolymp_scraper("almaty", "Алматы", 0, 0)().scrape().items}
    return {"INVITRO": inv, "HELIX": hel, "KDL Алматы": kdl}


async def _db_prices() -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("""
            SELECT c.name, s.name, pi.price_kzt
            FROM price_items pi
            JOIN clinics c ON c.id = pi.clinic_id
            JOIN services s ON s.id = pi.service_id
            WHERE (pi.clinic_id, pi.service_id, pi.price_date) IN (
                SELECT clinic_id, service_id, MAX(price_date)
                FROM price_items
                GROUP BY clinic_id, service_id
            )
            AND (c.name LIKE '%INVITRO%' OR c.name LIKE '%HELIX%' OR c.name LIKE 'KDL ОЛИМП — Алматы%')
        """))
        for clinic, svc, price in r:
            out.setdefault(clinic, {})[svc] = int(float(price))
    return out


async def main() -> None:
    print("Загрузка live-каталогов (может занять несколько минут)...")
    live = _live_catalogs()
    db = await _db_prices()

    lines = ["=== VERIFY ACCURACY ===\n"]
    ok = 0
    fail = 0
    for label, inv_n, hel_n, kdl_n in BENCHMARKS:
        lines.append(f"--- {label} ---")
        for source, needle in [("INVITRO", inv_n), ("HELIX", hel_n), ("KDL Алматы", kdl_n)]:
            live_p = _find(live.get(source, {}), needle)
            db_clinic = next((k for k in db if source.split()[0] in k), source)
            db_p = _find(db.get(db_clinic, {}), label.lower()) or _find(db.get(db_clinic, {}), needle)
            match = live_p is not None and db_p is not None and live_p == db_p
            if match:
                ok += 1
            else:
                fail += 1
            lines.append(
                f"  {source}: live={live_p} db={db_p} {'OK' if match else 'MISMATCH'}"
            )

    lines.append(f"\nИтого: {ok} OK, {fail} расхождений")
    out = Path(__file__).parent.parent / "verify_accuracy.txt"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(out.read_text(encoding="utf-8"))


if __name__ == "__main__":
    asyncio.run(main())
