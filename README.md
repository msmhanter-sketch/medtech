# MedServicePrice.kz — Агрегатор цен на медицинские услуги

MVP хакатона: сбор прайсов с **открытых сайтов** клиник Казахстана, нормализация и сравнение цен (как Aviasales для медицины).

📋 **Путеводитель для демо жюри:** [DEMO.md](./DEMO.md)

---

## Быстрый старт (уже есть БД)

Нужны **два терминала**. Python 3.11+ и Node.js 18+.

```bash
# Терминал 1 — API
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Терминал 2 — UI
cd frontend
npm install
npm run dev
```

→ **http://localhost:3000**  
→ API docs: **http://127.0.0.1:8000/docs**

Файл `backend/medtech.db` уже содержит спарсенные данные. Полный перескрапинг не обязателен для демо.

---

## Переменные окружения

Скопируйте `backend/.env.example` → `backend/.env`:

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./medtech.db` | SQLite БД |
| `REDIS_URL` | `redis://localhost:6379/0` | Кэш (опционально) |

---

## Источники данных

| Источник | URL | Метод |
|----------|-----|-------|
| INVITRO | invitro.kz | HTML (Алматы + Астана) |
| HELIX | helix.kz | HTML + JSON |
| KDL / KDL ОЛИМП | kdl.kz, kdlolymp.kz | Nuxt payload, 8 городов |
| DOQ | api.doq.kz | REST API, 12 городов |
| Олимп | olymp.kz → kdlolymp.kz | Nuxt |
| МЕДЭЛ | medelica.kz | Tilda HTML |
| Аксай | aksay.kaznmu.edu.kz | PDF (WP API) |
| МЦК | mck.kz | недоступен (логируется) |

Скраперы: `backend/scrapers/`. Пауза 0.6–1.5 с между запросами.

---

## Скрапинг

```bash
cd backend

# Быстрый поднабор (2–5 мин)
python scrape_and_ingest.py --source invitro_kz --source helix_kz --source doq_almaty

# Полный цикл: seed + все источники + очистка (30–60 мин)
python reset_and_load.py

# Через API
curl -X POST "http://127.0.0.1:8000/api/scrape/run"
curl http://127.0.0.1:8000/api/scrape/sources
```

---

## Архитектура

```
scrapers/ (28 источников)
    → scrape_and_ingest.py
    → ServiceMatcher (нормализация)
    → price_items (сравнение) + parsed_price_rows (raw-слой)
FastAPI (:8000) ← proxy ← Next.js (:3000)
```

---

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/services/search?q=` | Поиск услуг |
| GET | `/api/clinics/compare` | Сравнение цен |
| GET | `/api/clinics/{id}` | Карточка клиники |
| GET | `/api/clinics/{id}/prices` | Прайс клиники |
| GET | `/api/stats` | Метрики |
| POST | `/api/scrape/run` | Запуск скрапинга |
| GET | `/api/normalize/unmatched` | Очередь разметки |

---

## Соответствие ТЗ

| Критерий | Реализация |
|----------|------------|
| ≥3 источника, ≥100 цен | ✅ |
| Справочник ≥50 услуг | ✅ `service_catalog.py` |
| Поиск, фильтры, сортировка | ✅ |
| Таблица / карта / карточка клиники | ✅ |
| Raw-слой, дата актуальности | ✅ |
| Скрапинг по API, отказоустойчивость | ✅ |
| 12 городов в UI | ✅ |

---

## Тесты

```bash
cd backend && python -m pytest
```
