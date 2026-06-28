# 🏥 MedServicePrice.kz

<div align="center">

**Агрегатор и сравнение цен на медицинские услуги в Казахстане**

> Найди самую выгодную цену на анализ крови, МРТ или приём терапевта — не обходя двадцать сайтов клиник вручную.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![SQLite](https://img.shields.io/badge/SQLite-MVP-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)

</div>

---

## 🎯 О проекте

**MedServicePrice.kz** — MVP агрегатора цен на медицинские услуги Казахстана, аналог Aviasales но для здоровья. Платформа автоматически собирает прайс-листы с сайтов клиник и лабораторий, нормализует их к единому справочнику через fuzzy-матчинг и предоставляет удобный интерфейс для сравнения цен.

**Проблема:** Пациент вынужден вручную обходить десятки сайтов клиник, чтобы сравнить стоимость даже простого анализа крови. Рынок медицинских услуг в Казахстане полностью непрозрачен.

**Решение:** Централизованная платформа, которая автоматически собирает прайсы, нормализует названия и позволяет мгновенно увидеть — где дешевле и надёжнее.

---

## 📊 Статистика MVP (реальные данные)

| Метрика | Требование хакатона | Результат |
|:--------|:-------------------:|:---------:|
| 🏙️ Городов Казахстана | ≥ 3 | **17** ✅ |
| 🏥 Клиник в базе | ≥ 10 | **554** (551 с GPS) ✅ |
| 📋 Справочник услуг | ≥ 50 | **1 329** ✅ |
| 💵 Актуальных цен | ≥ 100 | **11 363** (из 81 389 raw) ✅ |
| 🔍 Источников парсинга | ≥ 3 | **10+ источников** ✅ |
| 🤖 Точность авто-матчинга | — | **88.60%** ✅ |
| ⚠️ Аномалий заблокировано | — | **696 записей** ✅ |

---

## 🚀 Быстрый старт

### Требования

- **Python 3.11+** — [скачать](https://www.python.org/downloads/)
- **Node.js 18+** — [скачать](https://nodejs.org/)
- Git

### Шаг 1 — Клонировать репозиторий

```bash
git clone https://github.com/msmhanter-sketch/medtech.git
cd medtech
```

### Шаг 2 — Запустить одной командой (Windows)

```bat
start.bat
```

Или просто **дважды кликнуть** на `start.bat` в папке проекта.

Скрипт сам:
- Создаст Python venv и установит зависимости
- Установит npm пакеты (если нужно)
- Откроет бэкенд и фронтенд в двух окнах

| Сервис | URL |
|--------|-----|
| 🌐 Сайт | http://localhost:3000 |
| ⚙️ Swagger API | http://localhost:8000/docs |
| 🛡️ Админ | http://localhost:3000/admin |

> **База данных** уже заполнена реальными данными — ничего дополнительно делать не нужно.

---

### Ручной запуск (если нужно)

**Терминал 1 — бэкенд:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Терминал 2 — фронтенд:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🏗️ Архитектура системы

```
medtech/
├── backend/                         # Python + FastAPI
│   ├── app/
│   │   ├── api/                     # REST-эндпоинты
│   │   │   ├── clinics.py           # Сравнение цен по услугам и городам
│   │   │   ├── services.py          # Поиск услуг (fuzzy + нормализация)
│   │   │   ├── insights.py          # Аналитика: медиана, разброс, тренды
│   │   │   ├── history.py           # История изменений цен
│   │   │   ├── normalize.py         # Очередь нормализации (Unmatched Queue)
│   │   │   ├── subscriptions.py     # Email-подписки на снижение цен
│   │   │   ├── scrape.py            # Управление парсерами и расписанием
│   │   │   ├── dgis.py              # 2GIS геокодирование адресов клиник
│   │   │   └── stats.py             # Статистика платформы
│   │   ├── models/models.py         # SQLAlchemy ORM
│   │   ├── normalizer/
│   │   │   ├── matcher.py           # Rapidfuzz WRatio fuzzy-matching
│   │   │   └── text_utils.py        # NFC, стоп-слова, ё->е нормализация
│   │   ├── schemas/clinic.py        # Pydantic v2 схемы
│   │   └── main.py                  # FastAPI + lifespan hook
│   ├── scrapers/                    # 10+ парсеров клиник и лабораторий
│   │   ├── doq.py                   # DOQ.kz REST API (все города)
│   │   ├── invitro.py               # Invitro KZ (HTML)
│   │   ├── helix.py                 # Helix KZ (HTML)
│   │   ├── kdlolymp.py              # KDL / Olymp (HTML + PDF)
│   │   ├── invivo.py                # Invivo (HTML)
│   │   ├── idoctor.py               # iDoctor (HTML)
│   │   ├── sunkar.py                # Sunkar (HTML)
│   │   └── ...                      # + другие парсеры
│   ├── fast_ingest.py               # Быстрый импорт JSON-файлов парсеров
│   ├── detect_anomalies.py          # Блокировка ценовых выбросов по медиане
│   └── seed_services.py             # Загрузка справочника услуг
│
└── frontend/                        # Next.js 14 + TypeScript
    ├── app/
    │   ├── page.tsx                 # SSR главная страница + поиск
    │   ├── ClientHome.tsx           # Клиентский SPA
    │   ├── admin/page.tsx           # Панель администратора
    │   └── clinics/[id]/page.tsx    # Страница клиники
    ├── components/
    │   ├── HeroSection.tsx          # Главный экран: поиск + статистика
    │   ├── CompareResults.tsx       # Вкладки: Список / Карта / Клиники
    │   ├── ClinicCard.tsx           # Карточка клиники
    │   ├── ClinicMap.tsx            # Leaflet-карта (OpenStreetMap)
    │   ├── CompareTable.tsx         # Таблица сравнения
    │   ├── AIPriceInsights.tsx      # Графики и аналитика (Recharts)
    │   ├── PriceHistoryModal.tsx    # История изменений цены
    │   ├── PriceChangesFeed.tsx     # Лента изменений цен
    │   ├── BookingModal.tsx         # Форма записи к врачу
    │   └── CompareSidebar.tsx       # Email-мониторинг цен
    └── lib/
        ├── api.ts                   # Типизированный HTTP-клиент
        └── maps.ts                  # 2GIS, Google Maps, геолокация
```

---

## ✨ Ключевые возможности

### Для пользователей

| Функция | Описание |
|---------|----------|
| 🔍 **Умный поиск** | Автодополнение по 1 329 услугам. Нормализует запросы и устойчив к опечаткам. |
| 📋 **Сравнение цен** | Карточки клиник с ценой, рейтингом, адресом и датой обновления прайса. |
| 🏥 **Вкладка «Клиники»** | Информация о сети: города присутствия, тренды цен (рост/падение в тенге и %). |
| 🗺️ **Интерактивная карта** | Leaflet-карта с маркерами 554 клиник и поп-апами. |
| 🧭 **Маршруты** | Интеграция с **2GIS** и **Google Maps** — один клик до маршрута. |
| 📈 **История цен** | Интерактивный график колебания стоимости по месяцам. |
| 🔔 **Email-мониторинг** | Подписка на снижение цены ниже заданного порога. |
| 🎯 **Фильтры** | По городу, ценовому диапазону, рейтингу, верификации. |
| 📤 **Шаринг** | Web Share API — поделиться результатом одним кликом. |

### Для администраторов (`/admin`)

| Функция | Описание |
|---------|----------|
| 📊 **Дашборд** | Общая статистика, лента изменений цен |
| 🤖 **Нормализация** | Unmatched Queue с ручной привязкой через автодополнение |
| ⏱️ **Планировщик** | Расписание каждого парсера (ручной / 1ч / 12ч / 24ч / неделя) |
| ⚠️ **Аномалии** | Список заблокированных цен с отклонением > 5x от медианы |

---

## 🤖 Алгоритм нормализации услуг

Сопоставление разнородных названий из прайс-листов с единым справочником:

```
«ОАК»                  ->  «Общий анализ крови (ОАК)»
«CBC»                  ->  «Общий анализ крови (ОАК)»
«25-OH витамин Д»      ->  «Витамин D (25-OH)»
«Прием кардиолога»     ->  «Консультация кардиолога»
```

**Пайплайн:**

```
Сырая строка из прайс-листа
        ↓
  normalize_text():  NFC + ё->е + стоп-слова + нижний регистр
        ↓
  rapidfuzz WRatio (+ синонимы)
        ↓
  score >= 88  ->  Auto-accept (88.6% строк)
  72-87        ->  Unmatched Queue (ручная разметка)
  < 72         ->  Rejected
```

**Детекция аномалий:** `detect_anomalies.py` блокирует записи с ценой, отличающейся от медианы по городу более чем в 5 раз.

---

## 🕷️ Источники данных

| Парсер | Источник | Метод | Охват |
|--------|----------|-------|-------|
| `doq.py` | **DOQ.kz** | REST API | Все 17 городов |
| `kdlolymp.py` | **KDL / KDL Олимп** | HTML + PDF | Алматы, Астана, Шымкент, + |
| `invitro.py` | **Invitro KZ** | HTML | Алматы, Астана, Караганда, + |
| `helix.py` | **Helix KZ** | HTML | Алматы |
| `invivo.py` | **Invivo** | HTML | Алматы, Астана |
| `idoctor.py` | **iDoctor** | HTML | Алматы |
| `sunkar.py` | **Sunkar** | HTML | Алматы |
| `document_pipeline.py` | **PDF/DOCX** | pdfplumber | Несколько клиник |
| `seed_labs_from_2gis.py` | **2GIS API** | REST API | 17 городов (GPS) |

### Запуск парсинга вручную

```bash
cd backend

# Конкретный источник
python scrape_and_ingest.py --source invitro_kz

# Все зарегистрированные источники
python scrape_and_ingest.py

# Быстрый импорт JSON из data/parsed/
python fast_ingest.py
```

---

## 🌍 Поддерживаемые города (17)

Алматы · Астана · Шымкент · Актобе · Тараз · Усть-Каменогорск · Семей · Актау · Атырау · Кокшетау · Кызылорда · Петропавловск · Костанай · Уральск · Туркестан · Павлодар · Темиртау

---

## 🔧 Стек технологий

### Бэкенд

| Компонент | Технология |
|-----------|-----------|
| API | **FastAPI 0.111** (async) |
| ORM | **SQLAlchemy 2** (async) |
| БД | **SQLite** + aiosqlite |
| Кэш | **Redis** (опционально) |
| Fuzzy | **rapidfuzz** WRatio |
| Парсинг | **BeautifulSoup4** + httpx |
| PDF/DOCX | **pdfplumber** + python-docx |
| Email | **aiosmtplib** |

### Фронтенд

| Компонент | Технология |
|-----------|-----------|
| Фреймворк | **Next.js 14** (SSR) |
| Язык | **TypeScript 5** |
| Карта | **Leaflet** + react-leaflet |
| Графики | **Recharts** |
| Анимации | **Framer Motion** |
| Иконки | **Lucide React** |

---

## 📋 REST API Reference

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/api/clinics/compare` | Сравнение цен по услуге, городу, сортировке |
| `GET` | `/api/services/search?q=...` | Fuzzy-поиск услуг |
| `GET` | `/api/categories/` | Список категорий (cached) |
| `GET` | `/api/stats` | Статистика платформы |
| `GET` | `/api/insights/` | Аналитика: медиана, разброс, тренды |
| `GET` | `/api/history/changes` | Лента изменений цен |
| `GET` | `/api/clinics/{id}` | Детальная страница клиники |
| `GET` | `/api/clinics/{id}/history/{service_id}` | История цены в клинике |
| `POST` | `/api/subscriptions/` | Подписка на изменение цены |
| `GET` | `/api/scrape/sources` | Список парсеров + расписание |
| `POST` | `/api/scrape/run` | Ручной запуск парсера |
| `POST` | `/api/normalize/match` | Ручная привязка услуги |

> Полная документация: **http://localhost:8000/docs**

---

## 📝 Переменные окружения

### `backend/.env` (опционально)

```env
DGIS_API_KEY=your_2gis_api_key_here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your_app_password
REDIS_URL=redis://localhost:6379
DATABASE_URL=sqlite+aiosqlite:///./medtech.db
```

### `frontend/.env.local` (опционально)

```env
BACKEND_URL=http://127.0.0.1:8000
```

---

## 🏆 Для жюри хакатона

| Критерий | Вес | Реализация |
|----------|-----|-----------|
| **Качество данных** | 25% | 81 389 raw-строк, 88.6% авто-матчинг, детекция аномалий |
| **UX / поиск** | 25% | Нормализация запросов, 3 вида отображения (список/карта/клиники) |
| **Техническая реализация** | 20% | Async FastAPI + Next.js SSR, Docker, SQLAlchemy |
| **Охват рынка** | 15% | 554 клиники, 17 городов, 551 с GPS-координатами |
| **Дополнительные функции** | 15% | Карта, история цен, Email-мониторинг, маршруты, шаринг |

---

## 🗺️ Дорожная карта

- [ ] Мобильное приложение (React Native / Expo)
- [ ] PostgreSQL для production-масштаба
- [ ] Celery + Redis — очередь задач для параллельного парсинга
- [ ] Telegram-бот — уведомления о снижении цен
- [ ] Рейтинги на основе 2GIS и Google Maps
- [ ] Онлайн-запись к врачу
- [ ] Версия на казахском языке

---

## 👥 Команда

Разработано в рамках **Хакатона 2025** (MedServicePrice.kz).

---

<div align="center">

**MedServicePrice.kz — делаем медицину прозрачной** 🏥

*Найди лучшую цену. Сохрани здоровье и деньги.*

</div>
