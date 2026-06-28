# MedServicePrice.kz

**Агрегатор и сравнение цен на медицинские услуги в Казахстане**

> Найди самую выгодную цену на анализ крови, МРТ или приём терапевта — не обходя двадцать сайтов клиник вручную.

---

## Что нужно установить

| Программа | Версия | Ссылка |
|-----------|--------|--------|
| Python | 3.11+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |

> При установке Python поставь галочку **Add Python to PATH**.

---

## Запуск (2 терминала)

Открой **два окна терминала** (CMD или PowerShell) в папке проекта.

### Терминал 1 — бэкенд

```bash
cd backend
python -m venv venv
venv\Scripts\activate
python -m pip install -r requirements.txt
python -m pip install pandas openpyxl
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Терминал 2 — фронтенд

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

### Готово

Открой в браузере:

| Сервис | URL |
|--------|-----|
| Сайт | http://localhost:3000 |
| Swagger API | http://localhost:8000/docs |
| Админка | http://localhost:3000/admin |

> База данных (`medtech.db`) уже заполнена реальными данными — ничего дополнительно делать не нужно. Redis не обязателен, всё работает и без него (просто без кэша).

---

## Если что-то не работает

### `python` не найден
Python не установлен или не добавлен в PATH. Переустанови с галочкой **Add Python to PATH**. Либо попробуй `python3` или `py` вместо `python`.

### `pip install` падает с ошибками
Обнови pip: `python -m pip install --upgrade pip`, потом повтори установку.

### `npm` не найден
Node.js не установлен. Скачай с https://nodejs.org, установи, перезапусти терминал.

### Бэкенд запустился, фронтенд — ошибка подключения
Убедись, что бэкенд работает (в терминале 1 видно `Application startup complete`). Фронтенд может показывать ошибку пару секунд при первом запуске — это нормально, он попытается снова.

### `uvicorn` не найден
Значит venv не активирован. Убедись, что перед запуском uvicorn ты выполнил `venv\Scripts\activate`.

---

## Статистика MVP

| Метрика | Значение |
|--------|----------|
| Городов Казахстана | 17 |
| Клиник в базе | 554 (551 с GPS) |
| Услуг в справочнике | 1 329 |
| Актуальных цен | 11 363 |
| Источников парсинга | 10+ |
| Точность авто-матчинга | 88.60% |

---

## Архитектура

```
medtech/
├── backend/                    # Python + FastAPI
│   ├── app/
│   │   ├── api/                # REST-эндпоинты
│   │   ├── models/             # SQLAlchemy ORM
│   │   ├── normalizer/         # Fuzzy-матчинг услуг (rapidfuzz)
│   │   ├── schemas/            # Pydantic v2
│   │   └── main.py             # Точка входа
│   ├── scrapers/               # 10+ парсеров клиник
│   └── medtech.db              # SQLite база (уже с данными)
│
└── frontend/                   # Next.js 14 + TypeScript
    ├── app/
    │   ├── page.tsx            # Главная + поиск
    │   ├── admin/page.tsx      # Админ-панель
    │   └── clinics/[id]/       # Страница клиники
    ├── components/             # UI-компоненты
    └── lib/api.ts              # HTTP-клиент к бэкенду
```

---

## Ключевые возможности

- Умный поиск по 1 329 услугам с автодополнением и устойчивостью к опечаткам
- Сравнение цен: список, интерактивная карта (Leaflet), карточки клиник
- История цен и аналитика (медиана, разброс, тренды)
- Маршруты до клиники через 2GIS / Google Maps
- Email-подписка на снижение цены
- Админ-панель: нормализация услуг, управление парсерами, аномалии

---

## Переменные окружения (опционально)

### backend/.env

```env
DGIS_API_KEY=your_2gis_api_key
DATABASE_URL=sqlite+aiosqlite:///./medtech.db
REDIS_URL=redis://localhost:6379
```

### frontend/.env.local

```env
BACKEND_URL=http://127.0.0.1:8000
```

> Без `.env` файлов всё работает из коробки — это только для кастомизации.

---

## REST API

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/services/search?q=...` | Поиск услуг |
| GET | `/api/clinics/compare` | Сравнение цен |
| GET | `/api/clinics/{id}` | Страница клиники |
| GET | `/api/insights/` | Аналитика |
| GET | `/api/history/changes` | Лента изменений цен |
| POST | `/api/subscriptions/` | Подписка на цену |
| POST | `/api/scrape/run` | Запуск парсера |

Полная документация: http://localhost:8000/docs

---

## Стек

**Бэкенд:** FastAPI, SQLAlchemy 2 (async), SQLite, rapidfuzz, BeautifulSoup4, pdfplumber

**Фронтенд:** Next.js 14, TypeScript, Tailwind CSS, Leaflet, Recharts, Framer Motion

---

<div align="center">

**MedServicePrice.kz — делаем медицину прозрачной**

</div>
