import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import ParserSchedule

log = logging.getLogger(__name__)

_scheduler_task = None
_running_scrapers = set()

def calculate_next_run(interval: str, from_time: datetime | None = None) -> Optional[datetime]:
    if not from_time:
        from_time = datetime.now(timezone.utc)
    if interval == "hourly":
        return from_time + timedelta(hours=1)
    elif interval == "twice_daily":
        return from_time + timedelta(hours=12)
    elif interval == "daily":
        return from_time + timedelta(days=1)
    elif interval == "weekly":
        return from_time + timedelta(days=7)
    return None

async def scheduler_loop():
    log.info("⏰ Background scraper scheduler loop started")
    while True:
        try:
            await asyncio.sleep(10)  # Check every 10 seconds for testing/quick pickup
            
            # Check global scraper running state to avoid conflicts
            from app.api.scrape import _scrape_running
            if _scrape_running:
                continue

            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                stmt = select(ParserSchedule).where(
                    ParserSchedule.is_active == True,
                    ParserSchedule.next_run <= now,
                    ParserSchedule.interval != "manual"
                )
                res = await db.execute(stmt)
                schedules = res.scalars().all()
                
                for sched in schedules:
                    if sched.parser_name in _running_scrapers:
                        continue
                    log.info(f"⏰ Scheduler triggering scheduled run for parser: {sched.parser_name}")
                    _running_scrapers.add(sched.parser_name)
                    asyncio.create_task(run_scheduled_parser(sched.parser_name, sched.interval))
        except asyncio.CancelledError:
            log.info("⏰ Background scraper scheduler loop cancelled")
            break
        except Exception as exc:
            log.error(f"⏰ Error in scheduler loop: {exc}", exc_info=True)

async def run_scheduled_parser(parser_name: str, interval: str):
    from scrape_and_ingest import run_all
    from app.api.scrape import _scrape_running
    
    # Set the global scraping flag
    import app.api.scrape
    app.api.scrape._scrape_running = True
    
    try:
        await run_all([parser_name], deep_documents=True)
    except Exception as exc:
        log.error(f"⏰ Error running scheduled scraper {parser_name}: {exc}", exc_info=True)
    finally:
        app.api.scrape._scrape_running = False
        _running_scrapers.discard(parser_name)
        
        # Update schedule next_run and last_run
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                next_run = calculate_next_run(interval, now)
                
                stmt = select(ParserSchedule).where(ParserSchedule.parser_name == parser_name)
                res = await db.execute(stmt)
                sched = res.scalar_one_or_none()
                if sched:
                    sched.last_run = now
                    sched.next_run = next_run
                    await db.commit()
                    log.info(f"⏰ Scheduler updated schedule for {parser_name}: last_run={sched.last_run}, next_run={sched.next_run}")
        except Exception as exc:
            log.error(f"⏰ Error updating schedule after run for {parser_name}: {exc}", exc_info=True)

async def init_schedules():
    from scrapers import ALL_SCRAPERS
    try:
        async with AsyncSessionLocal() as db:
            for scraper_cls in ALL_SCRAPERS:
                scraper = scraper_cls()
                name = scraper.source_id
                stmt = select(ParserSchedule).where(ParserSchedule.parser_name == name)
                res = await db.execute(stmt)
                existing = res.scalar_one_or_none()
                if not existing:
                    # Основные лабораторные сети — ежедневное обновление по умолчанию
                    core_daily = any(
                        name.startswith(p)
                        for p in ("invitro_", "helix_", "kdlolymp_", "invivo_", "medelica_")
                    ) or name.startswith("doq_")
                    interval = "daily" if core_daily else "manual"
                    next_run = calculate_next_run(interval) if interval != "manual" else None
                    db.add(ParserSchedule(
                        parser_name=name,
                        interval=interval,
                        next_run=next_run,
                        is_active=True,
                    ))
            await db.commit()
            log.info("⏰ Scraper schedules database initialized successfully")
    except Exception as e:
        log.error(f"⏰ Error initializing schedules database: {e}")

def start_scheduler():
    global _scheduler_task
    _scheduler_task = asyncio.create_task(scheduler_loop())

def stop_scheduler():
    if _scheduler_task:
        _scheduler_task.cancel()
