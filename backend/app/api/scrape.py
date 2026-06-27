"""API: запуск веб-скрапинга."""
import json
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from scrape_and_ingest import SCRAPE_LOG_PATH, run_all
from scrapers import ALL_SCRAPERS

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scrape", tags=["scraping"])

_scrape_running = False

SUPPORTED_FORMATS = [
    {"format": "HTML", "status": "supported", "module": "scrapers/*"},
    {"format": "PDF", "status": "supported", "module": "parsers/pdf_parser.py"},
    {"format": "DOCX", "status": "supported", "module": "parsers/docx_parser.py"},
    {"format": "Excel", "status": "supported", "module": "parsers/excel_parser.py"},
]


@router.get("/sources")
async def list_sources():
    return [
        {
            "id": s.source_id,
            "name": s.source_name,
            "url": s.source_url,
            "clinic": s.clinic_name,
            "city": s.city,
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
    path = Path(SCRAPE_LOG_PATH)
    if not path.exists():
        return {"items": []}

    lines = path.read_text(encoding="utf-8").splitlines()[-limit:]
    items = []
    for line in lines:
        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            log.warning("Skipping invalid scrape log line")
    return {"items": items}


@router.post("/run")
async def trigger_scrape(
    background_tasks: BackgroundTasks,
    source: list[str] | None = Query(None, description="ID источников"),
    sync: bool = Query(False, description="Дождаться завершения (для отладки)"),
    deep_documents: bool = Query(True, description="Обход PDF/DOCX/Excel на сайтах клиник"),
):
    global _scrape_running
    if _scrape_running and not sync:
        raise HTTPException(status_code=409, detail="Скрапинг уже выполняется")

    async def job():
        global _scrape_running
        _scrape_running = True
        try:
            await run_all(source, deep_documents=deep_documents)
        finally:
            _scrape_running = False

    if sync:
        return {"status": "completed", "results": await run_all(source, deep_documents=deep_documents)}

    background_tasks.add_task(job)
    return {"status": "started", "message": "Скрапинг запущен в фоне (HTML + документы)"}


@router.get("/status")
async def scrape_status():
    return {"running": _scrape_running}
