"""Отправка email (SMTP) или запись в лог в локальный outbox без SMTP."""
import logging
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

log = logging.getLogger(__name__)

LOG_PATH = Path(__file__).resolve().parents[2] / "logs" / "outbox_emails.log"


def _log_outbox(to: str, subject: str, body: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    line = (
        f"{datetime.now(timezone.utc).isoformat()}\t{to}\t{subject}\t"
        f"{body.replace(chr(10), ' ')[:500]}\n"
    )
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line)
    log.info("email outbox (no SMTP): %s — %s", to, subject)


def send_email(to: str, subject: str, body_text: str, body_html: str | None = None) -> bool:
    """Отправляет письмо через SMTP. Без SMTP — пишет в logs/outbox_emails.log."""
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = os.getenv("SMTP_FROM", user or "noreply@medserviceprice.kz")

    if not host:
        _log_outbox(to, subject, body_text)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(host, port, timeout=20) as server:
            if os.getenv("SMTP_TLS", "true").lower() in ("1", "true", "yes"):
                server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, [to], msg.as_string())
        log.info("email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        log.error("SMTP failed for %s: %s", to, exc)
        _log_outbox(to, f"[FAILED] {subject}", body_text)
        return False


def send_price_subscription_confirmation(
    email: str,
    service_name: str,
    clinic_name: str,
    city: str,
    price_kzt: str | None = None,
) -> bool:
    subject = f"MedPrice KZ: подписка на «{service_name}»"
    price_line = f"Текущая цена: {price_kzt} ₸\n" if price_kzt else ""
    body = (
        f"Здравствуйте!\n\n"
        f"Вы подписались на уведомления об изменении цены:\n"
        f"• Услуга: {service_name}\n"
        f"• Клиника: {clinic_name}\n"
        f"• Город: {city}\n"
        f"{price_line}\n"
        f"Мы сообщим вам, когда цена изменится.\n\n"
        f"— MedServicePrice.kz"
    )
    html = (
        f"<p>Вы подписались на уведомления по услуге <b>{service_name}</b> "
        f"в клинике <b>{clinic_name}</b> ({city}).</p>"
        f"<p>Мы сообщим вам при изменении цены.</p>"
    )
    return send_email(email, subject, body, html)


def send_newsletter_welcome(email: str, city: str | None = None) -> bool:
    city_line = f" в городе {city}" if city else ""
    subject = "MedPrice KZ: подписка на дайджест цен"
    body = (
        f"Спасибо за подписку на дайджест MedPrice KZ{city_line}!\n\n"
        f"Вы будете получать оповещения о снижении цен на популярные услуги.\n\n"
        f"— MedServicePrice.kz"
    )
    return send_email(email, subject, body)
