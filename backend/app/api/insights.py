from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
import numpy as np

from app.core.database import get_db
from app.models.models import Service, PriceItem, Clinic

router = APIRouter(prefix="/api/insights", tags=["insights"])

@router.get("/")
async def get_service_insights(service_id: int, city: str = "Алматы", db: AsyncSession = Depends(get_db)):
    """Аналитика цен по услуге в городе (статистика, распределение, история)."""
    service_res = await db.execute(select(Service).where(Service.id == service_id))
    service = service_res.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    prices_res = await db.execute(
        select(PriceItem, Clinic)
        .join(Clinic)
        .where(
            PriceItem.service_id == service.id,
            Clinic.city == city,
            Clinic.is_active == True,
            PriceItem.price_kzt > 0
        )
    )
    results = prices_res.all()
    
    if not results:
        return {"error": "Нет данных по ценам в этом городе."}

    prices = [float(p.price_kzt) for p, c in results]
    
    min_price = min(prices)
    max_price = max(prices)
    avg_price = int(np.mean(prices))
    median_price = int(np.median(prices))
    std_dev = int(np.std(prices))

    best_deals = [(p, c) for p, c in results if float(p.price_kzt) == min_price]
    best_deal = best_deals[0] if best_deals else None
    
    ai_advice = ""
    diff_percent = 0
    if best_deal and avg_price > 0:
        diff_percent = int((1 - min_price / avg_price) * 100)
        if diff_percent > 10:
            ai_advice = f"💡 Совет: В клинике «{best_deal[1].name}» цена на {diff_percent}% ниже среднего по городу."
        elif diff_percent > 0:
            ai_advice = f"💡 Совет: Цена в клинике «{best_deal[1].name}» немного ниже рыночной."
        else:
            ai_advice = "💡 Совет: Цены на эту услугу стабильны во всех клиниках."

    histogram = []
    if len(prices) > 2 and max_price > min_price:
        counts, bins = np.histogram(prices, bins=5)
        for i in range(len(counts)):
            histogram.append({
                "range": f"{int(bins[i])} - {int(bins[i+1])} ₸",
                "count": int(counts[i])
            })
    else:
        histogram = [{"range": f"{int(min_price)} ₸", "count": len(prices)}]

    history_res = await db.execute(
        select(PriceItem.price_date, func.avg(PriceItem.price_kzt).label("avg_price"))
        .join(Clinic)
        .where(
            PriceItem.service_id == service.id,
            Clinic.city == city,
            Clinic.is_active == True,
            PriceItem.price_kzt > 0
        )
        .group_by(PriceItem.price_date)
        .order_by(PriceItem.price_date.asc())
    )
    history_rows = history_res.all()
    
    months_ru = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]
    history_data = [
        {
            "period": f"{months_ru[r.price_date.month - 1]} {r.price_date.year}",
            "price": int(r.avg_price),
        }
        for r in history_rows
    ]

    return {
        "service_name": service.name,
        "city": city,
        "stats": {
            "min": int(min_price),
            "max": int(max_price),
            "avg": avg_price,
            "median": median_price,
            "std_dev": std_dev,
            "total_clinics": len(prices)
        },
        "best_deal": {
            "clinic_name": best_deal[1].name if best_deal else None,
            "price": int(min_price),
            "diff_percent": diff_percent
        },
        "ai_advice": ai_advice,
        "distribution": histogram,
        "history": history_data,
        "history_available": len(history_data) >= 2,
    }
