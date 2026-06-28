"""
app/api/normalize.py — API-роутер нормализации прайс-листов.

Эндпоинты:
  POST /api/normalize/preview     — превью матчинга без записи в БД
  POST /api/normalize/ingest      — матчинг + запись в БД
  POST /api/normalize/reload      — принудительная перезагрузка индекса
"""
import logging
from datetime import date
import io
import os
import re
import csv
import zipfile
import tempfile
from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from rapidfuzz import fuzz

from app.core.database import get_db
from app.models.models import Clinic, ParsedPriceRow, PriceItem, Service
from app.normalizer import get_matcher, init_matcher
from app.normalizer.ingestion import RawPriceRow, ingest_price_list
from app.normalizer.matcher import ServiceMatcher, MatchResult

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/normalize", tags=["normalization"])


# ─── Вспомогательные функции для архивов ────────────────────────────────────────

async def detect_clinic_from_filename(filename: str, db: AsyncSession) -> Optional[dict]:
    """Нечёткое сопоставление имени файла с активными клиниками в БД."""
    stmt = select(Clinic).where(Clinic.is_active == True)
    result = await db.execute(stmt)
    clinics = result.scalars().all()
    if not clinics:
        return None

    # Очищаем имя файла от расширения и путей, переводим в нижний регистр
    base_name = os.path.splitext(os.path.basename(filename))[0].lower()
    # Убираем спецсимволы и шумовые слова
    clean_filename = re.sub(r"[^а-яёәіңғүұқөһa-z0-9]", " ", base_name)
    clean_filename = " ".join([w for w in clean_filename.split() if w not in ["prices", "price", "прайс", "услуги", "list"]])
    
    if not clean_filename:
        return None

    best_clinic = None
    best_score = 0
    
    for clinic in clinics:
        clinic_name_normalized = re.sub(r"[^а-яёәіңғүұқөһa-z0-9]", " ", clinic.name.lower())
        clinic_name_clean = " ".join([w for w in clinic_name_normalized.split() if w not in ["лаборатория", "клиника", "больница", "lc", "kazakhstan", "пк"]])
        
        # Проверяем точное вхождение
        if clinic_name_clean in clean_filename or clean_filename in clinic_name_clean:
            score = 100
        else:
            score = fuzz.WRatio(clean_filename, clinic_name_clean)
            
        if score > best_score:
            best_score = score
            best_clinic = clinic
            
    if best_score >= 50:
        return {
            "id": best_clinic.id,
            "name": best_clinic.name,
            "city": best_clinic.city
        }
    return None


def parse_price_file(content_bytes: bytes, filename: str) -> list[dict]:
    """Парсит CSV, JSON, PDF, DOCX или Excel прайс-лист."""
    import json
    ext = os.path.splitext(filename)[1].lower()

    if ext in (".csv", ".json"):
        rows = []
        text = content_bytes.decode("utf-8", errors="ignore")
        
        if filename.endswith(".json"):
            try:
                data = json.loads(text)
                items = []
                if isinstance(data, list):
                    items = data
                elif isinstance(data, dict):
                    for v in data.values():
                        if isinstance(v, list):
                            items = v
                            break
                
                for item in items:
                    if isinstance(item, dict):
                        name_val = ""
                        price_val = ""
                        for k, v in item.items():
                            kl = str(k).lower()
                            if kl in ("name", "service", "услуга", "наименование", "title"):
                                name_val = str(v)
                            elif kl in ("price", "cost", "цена", "стоимость", "amount"):
                                price_val = str(v)
                        if name_val:
                            rows.append({"name": name_val, "price": price_val})
            except json.JSONDecodeError:
                pass
            return rows

        # CSV
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            name_val = ""
            price_val = ""
            for k, v in row.items():
                if not k:
                    continue
                kl = k.lower()
                if kl in ("name", "service", "услуга", "наименование", "title"):
                    name_val = str(v or "")
                elif kl in ("price", "cost", "цена", "стоимость", "amount"):
                    price_val = str(v or "")
            if name_val:
                rows.append({"name": name_val, "price": price_val})
        return rows

    if ext in (".pdf", ".doc", ".docx", ".xls", ".xlsx"):
        from parsers import get_parser

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(content_bytes)
                tmp_path = tmp.name
            parser_fn = get_parser(tmp_path)
            parsed = parser_fn(tmp_path)
            return [
                {"name": str(item.get("name", "")), "price": str(item.get("price", ""))}
                for item in parsed
                if item.get("name")
            ]
        except Exception as exc:
            log.warning("parse_price_file %s: %s", filename, exc)
            return []
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    return []


# ─── Pydantic-схемы для архивов ──────────────────────────────────────────────

class ImportedRow(BaseModel):
    raw_name: str
    price_str: str
    matched_service_id: Optional[int] = None
    matched_name: Optional[str] = None
    score: int = 0
    status: str = "not_found"


class FileImportPayload(BaseModel):
    filename: str
    clinic_id: int
    rows: list[ImportedRow]


class ArchiveImportPayload(BaseModel):
    files: list[FileImportPayload]
    accept_review: bool = False



# ─── Pydantic-схемы запросов/ответов ─────────────────────────────────────────

class ManualMatchRequest(BaseModel):
    parsed_row_id: int
    service_id: int


class PriceRowInput(BaseModel):
    """Одна строка входного прайс-листа."""
    name: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Название услуги как написано в прайсе клиники",
        json_schema_extra={"examples": ["ОАК (срочно)"]},
    )
    price: Optional[str] = Field(
        None,
        description="Цена в виде строки: '2 500', '1800 тг', 'от 1500'",
        json_schema_extra={"examples": ["2 500"]},
    )
    price_date: Optional[date] = Field(
        None,
        description="Дата актуальности (YYYY-MM-DD). По умолчанию — сегодня.",
    )


class PreviewRequest(BaseModel):
    """Тело запроса для превью нормализации."""
    names: list[str] = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Список названий услуг для сопоставления",
        json_schema_extra={"examples": [["ОАК", "МРТ головы без контраста", "Чистка зубов Air flow"]]},
    )


class IngestRequest(BaseModel):
    """Тело запроса для загрузки прайса в БД."""
    clinic_id: int = Field(..., description="ID клиники", ge=1)
    rows: list[PriceRowInput] = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Строки прайса с ценами",
    )
    accept_review: bool = Field(
        False,
        description=(
            "Если True — записываем в БД и строки с score 60–81 "
            "(needs_review), помечая is_verified=False."
        ),
    )


# ─── GET /api/normalize/unmatched ─────────────────────────────────────────────

@router.get(
    "/unmatched",
    summary="Очередь несопоставленных услуг",
    description="Строки из raw-слоя со статусом not_found для ручной разметки.",
)
async def list_unmatched(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    from app.models.models import ParsedPriceRow, Clinic

    stmt = (
        select(ParsedPriceRow, Clinic.name, Clinic.city)
        .join(Clinic, ParsedPriceRow.clinic_id == Clinic.id)
        .where(ParsedPriceRow.match_status == "not_found")
        .order_by(ParsedPriceRow.parsed_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    total_unmatched = await db.scalar(
        select(func.count())
        .select_from(ParsedPriceRow)
        .where(ParsedPriceRow.match_status == "not_found")
    )
    return {
        "total": total_unmatched or 0,
        "offset": offset,
        "items": [
            {
                "id": pr.id,
                "raw_name": pr.raw_name,
                "raw_price": pr.raw_price,
                "source_file": pr.source_file,
                "clinic_name": clinic_name,
                "city": clinic_city,
                "parsed_at": pr.parsed_at.isoformat(),
                "best_score": pr.match_score,
            }
            for pr, clinic_name, clinic_city in rows
        ],
    }


@router.get(
    "/review",
    summary="Очередь услуг на проверку (needs_review)",
    description="Строки с частичным совпадением (score 72–87) для ручной верификации.",
)
async def list_needs_review(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    from app.models.models import ParsedPriceRow, Clinic, Service

    stmt = (
        select(ParsedPriceRow, Clinic.name, Clinic.city, Service.name)
        .join(Clinic, ParsedPriceRow.clinic_id == Clinic.id)
        .outerjoin(Service, ParsedPriceRow.matched_service_id == Service.id)
        .where(ParsedPriceRow.match_status == "needs_review")
        .order_by(ParsedPriceRow.parsed_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    total = await db.scalar(
        select(func.count())
        .select_from(ParsedPriceRow)
        .where(ParsedPriceRow.match_status == "needs_review")
    )
    return {
        "total": total or 0,
        "offset": offset,
        "items": [
            {
                "id": pr.id,
                "raw_name": pr.raw_name,
                "raw_price": pr.raw_price,
                "source_file": pr.source_file,
                "clinic_name": clinic_name,
                "city": clinic_city,
                "parsed_at": pr.parsed_at.isoformat(),
                "best_score": pr.match_score,
                "suggested_service": suggested_name,
                "suggested_service_id": pr.matched_service_id,
            }
            for pr, clinic_name, clinic_city, suggested_name in rows
        ],
    }


# ─── POST /api/normalize/match ────────────────────────────────────────────────

@router.post(
    "/match",
    summary="Ручное сопоставление нераспознанной услуги",
    description="Привязывает сырую строку к эталонной услуге и создаёт PriceItem.",
)
async def manual_match(
    body: ManualMatchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.models import ParsedPriceRow, PriceItem
    from app.normalizer.ingestion import parse_price

    row = await db.get(ParsedPriceRow, body.parsed_row_id)
    if not row:
        raise HTTPException(status_code=404, detail="Строка не найдена")

    price = parse_price(row.raw_price) if row.raw_price else row.parsed_price_kzt
    if price is None:
        price = row.parsed_price_kzt
    if price is None:
        raise HTTPException(status_code=400, detail="Не удалось распарсить цену")

    target_date = row.parsed_at.date()
    stmt = select(PriceItem).where(
        (PriceItem.clinic_id == row.clinic_id)
        & (PriceItem.service_id == body.service_id)
        & (PriceItem.price_date == target_date)
    )
    result = await db.execute(stmt)
    existing_price = result.scalar_one_or_none()

    if existing_price:
        existing_price.price_kzt = price
        existing_price.source_name = row.raw_name
        existing_price.match_score = 100
        existing_price.is_verified = True
    else:
        new_price = PriceItem(
            clinic_id=row.clinic_id,
            service_id=body.service_id,
            price_kzt=price,
            price_date=target_date,
            source_name=row.raw_name,
            match_score=100,
            is_verified=True,
        )
        db.add(new_price)

    row.match_status = "manual_accepted"
    row.matched_service_id = body.service_id
    row.match_score = 100
    
    await db.commit()
    return {"status": "success", "message": "Услуга успешно сопоставлена"}


class ReviewActionRequest(BaseModel):
    parsed_row_id: int


@router.post("/review/approve", summary="Одобрить строку из очереди needs_review")
async def approve_review_row(
    body: ReviewActionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.models import ParsedPriceRow, PriceItem
    from app.normalizer.ingestion import parse_price

    row = await db.get(ParsedPriceRow, body.parsed_row_id)
    if not row or row.match_status != "needs_review":
        raise HTTPException(status_code=404, detail="Строка не найдена или не в очереди review")
    if not row.matched_service_id:
        raise HTTPException(status_code=400, detail="Нет предложенной услуги для одобрения")

    price = parse_price(row.raw_price) if row.raw_price else row.parsed_price_kzt
    if price is None:
        raise HTTPException(status_code=400, detail="Не удалось распарсить цену")

    target_date = row.parsed_at.date()
    existing = (
        await db.execute(
            select(PriceItem).where(
                PriceItem.clinic_id == row.clinic_id,
                PriceItem.service_id == row.matched_service_id,
                PriceItem.price_date == target_date,
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.price_kzt = price
        existing.source_name = row.raw_name
        existing.match_score = row.match_score or 85
        existing.is_verified = True
        row.price_item_id = existing.id
    else:
        new_price = PriceItem(
            clinic_id=row.clinic_id,
            service_id=row.matched_service_id,
            price_kzt=price,
            price_date=target_date,
            source_name=row.raw_name,
            match_score=row.match_score or 85,
            is_verified=True,
        )
        db.add(new_price)
        await db.flush()
        row.price_item_id = new_price.id

    row.match_status = "manual_accepted"
    await db.commit()
    return {"status": "success", "message": "Строка одобрена и опубликована"}


@router.post("/review/reject", summary="Отклонить строку из очереди review")
async def reject_review_row(
    body: ReviewActionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.models import ParsedPriceRow

    row = await db.get(ParsedPriceRow, body.parsed_row_id)
    if not row:
        raise HTTPException(status_code=404, detail="Строка не найдена")
    row.match_status = "skipped"
    await db.commit()
    return {"status": "success", "message": "Строка отклонена"}


@router.get("/disputed", summary="Спорные / неверифицированные цены")
async def list_disputed_prices(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    from app.models.models import PriceItem

    stmt = (
        select(PriceItem, Clinic.name, Clinic.city, Service.name)
        .join(Clinic, PriceItem.clinic_id == Clinic.id)
        .join(Service, PriceItem.service_id == Service.id)
        .where(PriceItem.is_verified == False)  # noqa: E712
        .order_by(PriceItem.price_date.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    total = await db.scalar(
        select(func.count()).select_from(PriceItem).where(PriceItem.is_verified == False)  # noqa: E712
    )
    return {
        "total": total or 0,
        "offset": offset,
        "items": [
            {
                "id": pi.id,
                "clinic_id": pi.clinic_id,
                "clinic_name": cname,
                "city": ccity,
                "service_id": pi.service_id,
                "service_name": sname,
                "price_kzt": float(pi.price_kzt),
                "price_date": pi.price_date.isoformat(),
                "source_name": pi.source_name,
                "match_score": pi.match_score,
                "is_verified": pi.is_verified,
            }
            for pi, cname, ccity, sname in rows
        ],
    }


@router.post("/prices/{price_id}/verify", summary="Верифицировать цену")
async def verify_price(price_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.models.models import PriceItem

    item = await db.get(PriceItem, price_id)
    if not item:
        raise HTTPException(status_code=404, detail="Цена не найдена")
    item.is_verified = True
    item.match_score = max(item.match_score or 0, 95)
    await db.commit()
    return {"status": "success", "message": "Цена верифицирована"}


@router.post("/prices/{price_id}/reject", summary="Скрыть спорную цену")
async def reject_price(price_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.models.models import PriceItem

    item = await db.get(PriceItem, price_id)
    if not item:
        raise HTTPException(status_code=404, detail="Цена не найдена")
    await db.delete(item)
    await db.commit()
    return {"status": "success", "message": "Цена удалена из публикации"}


# ─── POST /api/normalize/preview ──────────────────────────────────────────────

@router.post(
    "/preview",
    summary="Превью нормализации (без записи в БД)",
    description=(
        "Принимает список названий услуг и возвращает полный отчёт о сопоставлении. "
        "Ничего не записывает в БД — безопасно для тестирования. "
        "Идеально для UI-интерфейса проверки перед загрузкой."
    ),
)
async def preview_normalization(
    body: PreviewRequest,
    matcher: Annotated[ServiceMatcher, Depends(get_matcher)],
) -> dict:
    """
    Демо-эндпоинт для проверки качества матчинга.

    Пример использования (curl):
    ```bash
    curl -X POST http://localhost:8000/api/normalize/preview \\
      -H "Content-Type: application/json" \\
      -d '{"names": ["ОАК", "МРТ головы", "Зубная пломба"]}'
    ```
    """
    if not matcher._loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Индекс нормализации не загружен. Попробуйте /api/normalize/reload.",
        )

    report = matcher.match_price_list(body.names)
    return report.to_dict()


# ─── POST /api/normalize/ingest ───────────────────────────────────────────────

@router.post(
    "/ingest",
    summary="Загрузка нормализованного прайса в БД",
    description=(
        "Полный пайплайн: нормализация → fuzzy-матчинг → upsert в PriceItem. "
        "Возвращает статистику: сколько строк вставлено / обновлено / пропущено."
    ),
)
async def ingest_prices(
    body: IngestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    matcher: Annotated[ServiceMatcher, Depends(get_matcher)],
) -> dict:
    """
    Полный цикл загрузки прайса клиники:
    1. Нормализуем каждое название
    2. Сопоставляем с эталонным каталогом
    3. Пишем в PriceItem через PostgreSQL upsert
    """
    if not matcher._loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Индекс нормализации не загружен. Попробуйте /api/normalize/reload.",
        )

    # Формируем входные данные для матчера
    raw_names = [row.name for row in body.rows]
    raw_rows = [
        RawPriceRow(
            name=row.name,
            price_str=row.price or "",
            price_date=row.price_date,
        )
        for row in body.rows
    ]

    # Нормализуем и матчим
    report = matcher.match_price_list(raw_names)

    # Записываем в БД
    ingestion_result = await ingest_price_list(
        db=db,
        clinic_id=body.clinic_id,
        raw_rows=raw_rows,
        match_results=report.results,
        accept_review=body.accept_review,
    )

    return {
        "normalization": report.summary(),
        "ingestion": ingestion_result.to_dict(),
        "details": {
            "needs_review": [
                {
                    "raw": r.raw_input,
                    "normalized": r.normalized_input,
                    "best_match": r.matched_name,
                    "score": r.score,
                    "candidates": r.top_candidates[:3],
                }
                for r in report.needs_review
            ],
            "not_found": [
                {
                    "raw": r.raw_input,
                    "normalized": r.normalized_input,
                    "score": r.score,
                }
                for r in report.not_found
            ],
        },
    }


# ─── POST /api/normalize/reload ───────────────────────────────────────────────

@router.post(
    "/reload",
    summary="Перезагрузка индекса нормализации",
    description=(
        "Принудительно перезагружает индекс ServiceMatcher из БД. "
        "Вызывается после добавления новых услуг в каталог."
    ),
)
async def reload_index(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Перестраивает поисковый индекс из актуального состояния БД."""
    try:
        matcher = await init_matcher(db)
        return {
            "status": "ok",
            "message": "Индекс успешно перезагружен",
            "variants_count": len(matcher._flat_corpus),
            "services_count": len(matcher._index),
        }
    except Exception as exc:
        log.error(f"reload_index failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка перезагрузки индекса: {str(exc)}",
        )


# ─── POST /api/normalize/archive/upload ───────────────────────────────────────

@router.post(
    "/archive/upload",
    summary="Загрузка архива прайсов клиник-партнеров",
    description="Распаковывает архив в памяти, автоматически определяет клиники, нормализует строки услуг и возвращает превью.",
)
async def upload_archive(
    db: Annotated[AsyncSession, Depends(get_db)],
    matcher: Annotated[ServiceMatcher, Depends(get_matcher)],
    file: UploadFile = File(...),
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл должен быть ZIP-архивом",
        )
        
    if not matcher._loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Индекс нормализации не загружен. Попробуйте /api/normalize/reload.",
        )
        
    contents = await file.read()
    
    try:
        z = zipfile.ZipFile(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось прочитать ZIP-архив: {str(e)}",
        )
        
    # Получаем все клиники для выпадающего списка
    clinics_stmt = select(Clinic).where(Clinic.is_active == True)
    clinics_res = await db.execute(clinics_stmt)
    all_clinics = [
        {"id": c.id, "name": c.name, "city": c.city}
        for c in clinics_res.scalars().all()
    ]
    
    response_files = []
    
    for zip_info in z.infolist():
        if zip_info.is_dir() or zip_info.filename.startswith("__") or os.path.basename(zip_info.filename).startswith("."):
            continue
            
        filename = zip_info.filename
        basename = os.path.basename(filename)
        
        if not (basename.endswith((".csv", ".json", ".pdf", ".doc", ".docx", ".xls", ".xlsx"))):
            continue
            
        try:
            file_bytes = z.read(zip_info)
        except Exception:
            continue
        
        # 1. Автоопределение клиники по имени файла
        detected_clinic = await detect_clinic_from_filename(basename, db)
        
        # 2. Парсим строки прайса
        parsed_rows = parse_price_file(file_bytes, basename)
        if not parsed_rows:
            continue
            
        # 3. Сопоставляем услуги
        raw_names = [row["name"] for row in parsed_rows]
        report = matcher.match_price_list(raw_names)
        
        # Детализация строк
        rows_details = []
        for r_row, match_res in zip(parsed_rows, report.results):
            rows_details.append({
                "raw_name": r_row["name"],
                "price_str": r_row["price"],
                "matched_service_id": match_res.matched_service_id,
                "matched_name": match_res.matched_name,
                "score": match_res.score,
                "status": match_res.status,
            })
            
        response_files.append({
            "filename": filename,
            "detected_clinic": detected_clinic,
            "stats": report.summary(),
            "rows": rows_details,
        })
        
    return {
        "archive_name": file.filename,
        "files": response_files,
        "all_clinics": all_clinics,
    }


# ─── POST /api/normalize/archive/import ───────────────────────────────────────

@router.post(
    "/archive/import",
    summary="Импорт сопоставленных данных из архива в БД",
    description="Принимает подтвержденные пользователем данные прайсов и записывает их в PriceItem.",
)
async def import_archive(
    body: ArchiveImportPayload,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    results = []
    
    for f_payload in body.files:
        raw_rows = []
        match_results = []
        
        for r in f_payload.rows:
            if not r.matched_service_id:
                continue
                
            raw_rows.append(
                RawPriceRow(
                    name=r.raw_name,
                    price_str=r.price_str,
                )
            )
            match_results.append(
                MatchResult(
                    raw_input=r.raw_name,
                    normalized_input=r.raw_name,
                    matched_service_id=r.matched_service_id,
                    matched_name=r.matched_name,
                    score=r.score,
                    status=r.status,
                )
            )
            
        if not raw_rows:
            continue
            
        ingest_res = await ingest_price_list(
            db=db,
            clinic_id=f_payload.clinic_id,
            raw_rows=raw_rows,
            match_results=match_results,
            accept_review=body.accept_review,
        )
        
        results.append({
            "filename": f_payload.filename,
            "clinic_id": f_payload.clinic_id,
            "ingestion": ingest_res.to_dict(),
        })
        
    return {
        "status": "success",
        "results": results,
    }

