"""
reset_and_load.py — Подготовка БД для демо (ТЗ хакатона).

  python reset_and_load.py
"""
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).parent


def run(cmd: list[str]) -> None:
    print(f"\n>>> {' '.join(cmd)}")
    subprocess.check_call(cmd, cwd=BACKEND)


def main() -> None:
    run([sys.executable, "seed.py", "--fresh"])
    run([sys.executable, "scrape_and_ingest.py"])
    run([sys.executable, "polish_db.py"])
    print("\n[OK] Готово. uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    main()
