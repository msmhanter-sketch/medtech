"""API подписок на изменение цены и дайджест."""
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Clinic, NewsletterSubscriber, PriceItem, PriceSubscription, Service
from app.services.email_notify import send_newsletter_welcome, send_price_subscription_confirmation

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


class SubscribeRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    service_id: int = Field(..., ge=1)
    clinic_id: int = Field(..., ge=1)
    city: str = Field(..., min_length=2, max_length=100)


class NewsletterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    city: Optional[str] = Field(None, max_length=100)


class SubscribeResponse(BaseModel):
    status: str
    message: str
    subscription_id: int | None = None
    email_sent: bool = False


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post(
    "/",
    response_model=SubscribeResponse,
    summary="Подписка на изменение цены",
)
async def subscribe_to_price(
    body: SubscribeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SubscribeResponse:
    email = _normalize_email(body.email)
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Некорректный email")

    svc = await db.get(Service, body.service_id)
    if not svc or not svc.is_active:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    clinic = await db.get(Clinic, body.clinic_id)
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=404, detail="Клиника не найдена")

    existing = await db.scalar(
        select(PriceSubscription).where(
            PriceSubscription.email == email,
            PriceSubscription.service_id == body.service_id,
            PriceSubscription.clinic_id == body.clinic_id,
            PriceSubscription.is_active == True,  # noqa: E712
        )
    )
    if existing:
        return SubscribeResponse(
            status="already_subscribed",
            message="Вы уже подписаны на уведомления по этой услуге в этой клинике.",
            subscription_id=existing.id,
            email_sent=False,
        )

    sub = PriceSubscription(
        email=email,
        service_id=body.service_id,
        clinic_id=body.clinic_id,
        city=body.city.strip(),
    )
    db.add(sub)
    try:
        await db.commit()
        await db.refresh(sub)
    except IntegrityError as exc:
        await db.rollback()
        log.error("subscription DB error: %s", exc)
        raise HTTPException(status_code=500, detail="Ошибка сохранения подписки. Перезапустите API.") from exc

    price_row = await db.scalar(
        select(PriceItem.price_kzt)
        .where(
            PriceItem.clinic_id == body.clinic_id,
            PriceItem.service_id == body.service_id,
        )
        .order_by(PriceItem.price_date.desc())
        .limit(1)
    )
    price_str = str(int(price_row)) if price_row else None
    sent = send_price_subscription_confirmation(
        email, svc.name, clinic.name, body.city.strip(), price_str
    )

    log.info("subscription: %s → service=%s clinic=%s", email, body.service_id, body.clinic_id)
    return SubscribeResponse(
        status="subscribed",
        message="Подписка оформлена. Проверьте почту — мы отправили подтверждение."
        if sent
        else "Подписка сохранена. Подтверждение записано (SMTP не настроен — см. logs/outbox_emails.log).",
        subscription_id=sub.id,
        email_sent=sent,
    )


@router.post(
    "/newsletter",
    response_model=SubscribeResponse,
    summary="Подписка на дайджест цен (footer)",
)
async def subscribe_newsletter(
    body: NewsletterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SubscribeResponse:
    email = _normalize_email(body.email)
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Некорректный email")

    existing = await db.scalar(
        select(NewsletterSubscriber).where(
            NewsletterSubscriber.email == email,
            NewsletterSubscriber.is_active == True,  # noqa: E712
        )
    )
    if existing:
        return SubscribeResponse(
            status="already_subscribed",
            message="Этот email уже подписан на дайджест.",
            subscription_id=existing.id,
            email_sent=False,
        )

    row = NewsletterSubscriber(email=email, city=body.city.strip() if body.city else None)
    db.add(row)
    try:
        await db.commit()
        await db.refresh(row)
    except IntegrityError:
        await db.rollback()
        return SubscribeResponse(
            status="already_subscribed",
            message="Этот email уже подписан.",
            subscription_id=None,
            email_sent=False,
        )

    sent = send_newsletter_welcome(email, body.city)
    return SubscribeResponse(
        status="subscribed",
        message="Спасибо! Проверьте почту." if sent else "Подписка сохранена.",
        subscription_id=row.id,
        email_sent=sent,
    )
