# 🏥 MedServicePrice.kz

> **Агрегатор цен на медицинские услуги в Казахстане** — аналог Aviasales, но для здоровья.
>
> Автоматически собирает актуальные прайсы с сайтов клиник, нормализует и сравнивает их, предоставляя пользователю удобный интерфейс для поиска лучшей цены.

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)](https://fastapi.tiangolo.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![SQLite](https://img.shields.io/badge/DB-SQLite-orange)](https://sqlite.org)

---

## 📊 Статистика проекта (MVP)

| Метрика | Значение |
|---------|----------|
| 🏙️ Городов Казахстана | **12** |
| 🏥 Клиник в базе | **400+** |
| 💊 Записей о ценах | **17 000+** |
| 🤖 Авто-матчинг | **64%** |
| 🔍 Источников парсинга | **5+** |

---

## 🚀 Быстрый старт

### Требования
- Python 3.11+
- Node.js 18+
- npm

### 1. Клонирование

```bash
git clone https://github.com/your-org/MedServicePrice.kz
cd MedServicePrice.kz
```

### 2. Бэкенд (FastAPI)

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv

# Активировать (Windows)
venv\Scripts\activate

# (macOS/Linux)
source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt

# Запустить сервер
uvicorn app.main:app --port 8000 --reload
```

Бэкенд будет доступен на: http://localhost:8000
Swagger UI: http://localhost:8000/docs

### 3. Фронтенд (Next.js)

```bash
cd frontend

# Установить зависимости
npm install

# Запустить dev-сервер
npm run dev
```

Фронтенд будет доступен на: http://localhost:3000

---

## 🏗️ Архитектура

```
MedServicePrice.kz/
├── backend/                    # FastAPI + SQLite
│   ├── app/
│   │   ├── api/                # Endpoints
│   │   │   ├── clinics.py      # Сравнение цен по услугам
│   │   │   ├── services.py     # Поиск услуг
│   │   │   ├── insights.py     # AI-аналитика цен
│   │   │   ├── history.py      # История изменений цен
│   │   │   ├── subscriptions.py# Email-подписки
│   │   │   ├── scrape.py       # Управление парсерами
│   │   │   └── stats.py        # Статистика платформы
│   │   ├── models/             # SQLAlchemy ORM модели
│   │   ├── normalizer/         # Нечёткий матчинг услуг (rapidfuzz)
│   │   ├── services/
│   │   │   ├── scheduler.py    # Планировщик парсеров (asyncio)
│   │   │   └── db_migrate.py   # Миграции SQLite
│   │   └── main.py             # FastAPI app + lifespan
│   ├── scrapers/               # Парсеры источников
│   │   ├── doq.py              # DOQ.kz (10+ городов, API-based)
│   │   ├── invitro.py          # Invitro KZ
│   │   ├── helix.py            # Helix KZ
│   │   ├── kdlolymp.py         # KDL/Olymp по городам
│   │   ├── medelica.py         # Medelica
│   │   ├── aksay.py            # Aksay clinic / документы
│   │   ├── invivo.py           # Invivo
│   │   ├── idoctor.py          # iDoctor
│   │   └── sunkar.py           # Sunkar
│   └── scrape_and_ingest.py    # Оркестратор парсинга
│
└── frontend/                   # Next.js 14 + TypeScript
    ├── app/
    │   ├── page.tsx             # SSR главная + поиск
    │   ├── admin/               # Панель администратора
    │   └── clinics/[id]/        # Страница клиники
    ├── components/
    │   ├── HeroSection.tsx      # Главный экран с поиском
    │   ├── CompareResults.tsx   # Результаты + Фильтры drawer
    │   ├── CompareTable.tsx     # Таблица сравнения
    │   ├── ClinicCard.tsx       # Карточка клиники
    │   ├── ClinicMap.tsx        # Leaflet-карта (OpenStreetMap)
    │   ├── AIPriceInsights.tsx  # Графики + история цен
    │   ├── CompareSidebar.tsx   # Сайдбар + мониторинг цен
    │   ├── BookingModal.tsx     # Модаль записи
    │   └── ResultsHeader.tsx    # Шапка + Share-кнопка
    └── lib/
        ├── api.ts               # HTTP-клиент
        └── maps.ts              # 2GIS / Google Maps утилиты
```

---

## ✨ Ключевые возможности

### Для пользователей
| Функция | Описание |
|---------|----------|
| 🔍 **Поиск** | Умный fuzzy-поиск по 1 230+ услугам с автодополнением |
| 📊 **Сравнение** | Таблица с ценами, рейтингом, адресом, источником |
| 🗺️ **Карта** | Интерактивная карта клиник с маршрутами (2GIS / Google Maps) |
| 📈 **История цен** | График распределения цен и история по месяцам |
| 🔔 **Мониторинг** | Email-подписка на изменение цены (backend + outbox) |
| 🎯 **Фильтры** | По цене, рейтингу, верификации и режиму работы |
| 📤 **Шаринг** | Web Share API / копирование ссылки на результат |

### Для администраторов (`/admin`)
| Функция | Описание |
|---------|----------|
| 📋 **Дашборд** | Статистика, логи парсеров, история изменений цен |
| ⏱️ **Планировщик** | Расписание парсеров (каждый час / 12ч / 24ч / раз в неделю) |
| ✅ **Нормализация** | Очередь ручного матчинга услуг |
| 🗃️ **Сырые данные** | Просмотр необработанных прайсов |

---

## 🤖 Алгоритм нормализации (матчинг услуг)

1. **Парсинг** → сырое название услуги из прайса клиники
2. **Нормализация** → `normalize_text()`: нижний регистр, удаление стоп-слов, морф. нормализация
3. **Fuzzy-поиск** → `rapidfuzz.WRatio` по базе из 1 230 эталонных услуг с синонимами
4. **Зоны матчинга**:
   - `score ≥ 88` → автоматически принято (**64%** записей)
   - `score 72–87` → очередь ревью (30%)
   - `score < 72` → не найдено (6%)

---

## 🕷️ Источники данных

| Парсер | Источник | Метод | Города |
|--------|----------|-------|--------|
| `doq.py` | DOQ.kz | REST API | 12 городов |
| `kdlolymp.py` | KDL/Olymp | HTML + rendered fallback | города из KDL/Olymp |
| `invitro.py` | Invitro KZ | HTML-парсинг | Алматы, Астана |
| `helix.py` | Helix KZ | HTML-парсинг | Алматы |
| `medelica.py` | Medelica | HTML-парсинг | Астана |
| `aksay.py` | Aksay clinic | PDF / документы | Алматы |
| `mck.py` | MCK | HTML / документы | Алматы |
| `invivo.py` | Invivo | HTML-парсинг | Алматы |
| `idoctor.py` | iDoctor | HTML-парсинг | Алматы |
| `sunkar.py` | Sunkar | HTML-парсинг | Алматы |

### Запуск парсинга вручную

```bash
cd backend

# Быстрый набор для проверки
python scrape_and_ingest.py --source invitro_kz --source helix_kz --source doq_almaty --no-deep

# Конкретный источник
python scrape_and_ingest.py --source invitro_kz

# Полный цикл по всем зарегистрированным источникам
python scrape_and_ingest.py
```

---

## 🌍 Поддерживаемые города

Алматы, Астана, Шымкент, Актобе, Караганда, Тараз, Усть-Каменогорск, Семей, Актау, Кокшетау, Кызылорда, Павлодар

---

## 🔧 Технологический стек

### Бэкенд
- **FastAPI** — async REST API
- **SQLAlchemy 2** (async) — ORM
- **SQLite** + aiosqlite — база данных
- **rapidfuzz** — нечёткий матчинг
- **BeautifulSoup4** + httpx — парсинг HTML
- **asyncio** — планировщик и конкурентный парсинг

### Фронтенд
- **Next.js 14** — React фреймворк (SSR)
- **TypeScript** — типизация
- **Leaflet** — интерактивные карты
- **Recharts** — графики цен
- **Framer Motion** — анимации
- **Lucide React** — иконки

---

## 📝 Переменные окружения

### Бэкенд (`backend/.env`, опционально)
```env
# 2GIS API для геокодирования адресов
DGIS_API_KEY=your_2gis_api_key

# SMTP для email-уведомлений (без него — outbox в logs/)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your_app_password

# Redis (для кэша, опционально — без него работает без кэша)
REDIS_URL=redis://localhost:6379
```

### Фронтенд (`frontend/.env.local`, опционально)
```env
# URL FastAPI для SSR (по умолчанию http://127.0.0.1:8000)
BACKEND_URL=http://127.0.0.1:8000
```

---

## 📋 API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `GET` | `/api/clinics/compare` | Сравнение цен по услуге и городу |
| `GET` | `/api/services/search` | Поиск услуг по тексту |
| `GET` | `/api/stats` | Статистика платформы |
| `GET` | `/api/insights/` | AI-аналитика цен по услуге |
| `GET` | `/api/history/changes` | История изменений цен |
| `POST` | `/api/subscriptions/` | Подписка на изменение цены |
| `POST` | `/api/subscriptions/newsletter` | Email-дайджест |
| `GET` | `/api/scrape/sources` | Список парсеров + расписание |
| `POST` | `/api/scrape/run?source=<source_id>` | Запустить парсер вручную |
| `POST` | `/api/scrape/schedule` | Обновить расписание парсера |

Полная документация: http://localhost:8000/docs

---

## 👥 Команда

Разработано в рамках хакатона — MVP за 48 часов.

---

*MedServicePrice.kz — делаем медицину прозрачной* 🏥
