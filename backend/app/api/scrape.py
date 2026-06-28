"""API: запуск веб-скрапинга."""
import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

from scrape_and_ingest import SCRAPE_LOG_PATH, run_all
from scrapers import ALL_SCRAPERS

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scrape", tags=["scraping"])

_scrape_running = False

_scrape_progress = {
    "running": False,
    "current_parser": None,
    "completed": 0,
    "total": 0,
    "errors_count": 0,
    "completed_list": []
}

SUPPORTED_FORMATS = [
    {"format": "HTML", "status": "supported", "module": "scrapers/*"},
    {"format": "PDF", "status": "supported", "module": "parsers/pdf_parser.py"},
    {"format": "DOCX", "status": "supported", "module": "parsers/docx_parser.py"},
    {"format": "Excel", "status": "supported", "module": "parsers/excel_parser.py"},
]


@router.get("/sources")
async def list_sources():
    from app.core.database import AsyncSessionLocal
    from app.models.models import ParserSchedule
    from sqlalchemy import select

    schedules_map = {}
    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(ParserSchedule))
            for s in res.scalars().all():
                schedules_map[s.parser_name] = {
                    "interval": s.interval,
                    "next_run": s.next_run.isoformat() if s.next_run else None,
                    "last_run": s.last_run.isoformat() if s.last_run else None,
                    "is_active": s.is_active
                }
    except Exception as e:
        log.warning(f"Failed to load schedules for sources: {e}")

    return [
        {
            "id": s.source_id,
            "name": s.source_name,
            "url": s.source_url,
            "clinic": s.clinic_name,
            "city": s.city,
            "schedule": schedules_map.get(s.source_id, {
                "interval": "manual",
                "next_run": None,
                "last_run": None,
                "is_active": True
            })
        }
        for s in (cls() for cls in ALL_SCRAPERS)
    ]



@router.get("/capabilities")
async def scrape_capabilities():
    return {
        "automatic_crawl": True,
        "manual_run_endpoint": "/api/scrape/run",
        "admin_ui": "/admin",
        "cron_command": "python scripts/run_scheduled_scrape.py",
        "supported_formats": SUPPORTED_FORMATS,
        "deep_document_crawl": {
            "enabled_by_default": True,
            "formats": ["pdf", "docx", "xlsx", "xls", "html_price_pages"],
            "module": "scrapers/document_pipeline.py",
            "date_extraction": "parsers/date_utils.py",
        },
        "deduplication": {
            "strategy": "unique clinic_id + service_id + price_date; repeated runs update the existing price",
            "raw_layer_table": "parsed_price_rows",
            "normalized_table": "price_items",
        },
        "error_logging": {
            "path": str(SCRAPE_LOG_PATH),
            "fields": ["source", "source_url", "clinic", "city", "errors"],
        },
        "unmatched_queue_endpoint": "/api/normalize/unmatched",
    }


@router.get("/logs")
async def scrape_logs(limit: int = Query(10, ge=1, le=100)):
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.models import ParserLog

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ParserLog).order_by(ParserLog.created_at.desc()).limit(limit)
        )
        logs = result.scalars().all()

        items = []
        for log_entry in logs:
            items.append({
                "source": log_entry.parser_name,
                "status": log_entry.status,
                "errors": [log_entry.error_message] if log_entry.error_message else [],
                "rows": log_entry.records_processed,
                "inserted": log_entry.records_inserted,
                "time": log_entry.created_at.isoformat()
            })
        return {"items": items}


@router.post("/run")
async def trigger_scrape(
    background_tasks: BackgroundTasks,
    source: list[str] | None = Query(None, description="ID источников"),
    sync: bool = Query(False, description="Дождаться завершения (для отладки)"),
    deep_documents: bool = Query(False, description="Обход PDF/DOCX/Excel на сайтах клиник"),
):
    global _scrape_running, _scrape_progress
    if _scrape_running:
        raise HTTPException(status_code=409, detail="Скрапинг уже выполняется")

    _scrape_running = True
    _scrape_progress.update({
        "running": True,
        "current_parser": None,
        "completed": 0,
        "total": 0,
        "errors_count": 0,
        "completed_list": [],
    })

    async def job():
        global _scrape_running, _scrape_progress
        try:
            await run_all(source, deep_documents=deep_documents)
        except Exception:
            log.exception("Background scrape failed")
            _scrape_progress["errors_count"] += 1
        finally:
            _scrape_running = False
            _scrape_progress["running"] = False
            _scrape_progress["current_parser"] = None

    if sync:
        try:
            results = await run_all(source, deep_documents=deep_documents)
            return {"status": "completed", "results": results}
        finally:
            _scrape_running = False
            _scrape_progress["running"] = False
            _scrape_progress["current_parser"] = None

    background_tasks.add_task(job)
    return {"status": "started", "message": "Скрапинг запущен в фоне (HTML + документы)"}


@router.get("/status")
async def scrape_status():
    global _scrape_progress
    return _scrape_progress



class ScheduleUpdate(BaseModel):
    parser_name: str
    interval: str  # manual | hourly | twice_daily | daily | weekly
    is_active: bool = True


@router.post("/schedule")
async def update_schedule(data: ScheduleUpdate):
    from app.core.database import AsyncSessionLocal
    from app.models.models import ParserSchedule
    from app.services.scheduler import calculate_next_run
    from sqlalchemy import select
    from datetime import datetime, timezone

    if data.interval not in ("manual", "hourly", "twice_daily", "daily", "weekly"):
        raise HTTPException(status_code=400, detail="Неподдерживаемый интервал")

    async with AsyncSessionLocal() as db:
        stmt = select(ParserSchedule).where(ParserSchedule.parser_name == data.parser_name)
        res = await db.execute(stmt)
        sched = res.scalar_one_or_none()
        if not sched:
            sched = ParserSchedule(parser_name=data.parser_name)
            db.add(sched)

        sched.interval = data.interval
        sched.is_active = data.is_active
        if data.interval == "manual":
            sched.next_run = None
        else:
            sched.next_run = calculate_next_run(data.interval, datetime.now(timezone.utc))

        await db.commit()
        return {
            "status": "success",
            "parser_name": sched.parser_name,
            "interval": sched.interval,
            "next_run": sched.next_run.isoformat() if sched.next_run else None,
            "is_active": sched.is_active
        }
