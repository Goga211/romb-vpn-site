"""Отправка писем через SMTP (сброс пароля).

Без внешних зависимостей: stdlib smtplib в отдельном потоке (asyncio.to_thread),
чтобы не блокировать event loop. Если SMTP не сконфигурирован (smtp_host пуст) —
письмо не уходит, а ссылка пишется в лог (удобно для локальной отладки). В проде
об отсутствии SMTP предупреждает validate_runtime_config на старте.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from .config import Settings

logger = logging.getLogger("romb.mailer")


def smtp_configured(settings: Settings) -> bool:
    return bool(settings.smtp_host)


def _send_sync(
    settings: Settings, to_email: str, subject: str, text_body: str, html_body: str
) -> None:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user or "no-reply@localhost"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    mode = settings.smtp_tls.strip().lower()
    if mode == "ssl":
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, context=context, timeout=15
        ) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if mode == "starttls":
            server.starttls(context=ssl.create_default_context())
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


async def send_email(
    settings: Settings, to_email: str, subject: str, text_body: str, html_body: str
) -> bool:
    """Отправляет письмо. Возвращает True при успехе. Сбой SMTP не пробрасываем —
    запрос пользователя не должен падать из-за проблем с почтовым сервером."""
    if not smtp_configured(settings):
        logger.warning("SMTP not configured — email to %s not sent (subject: %s)", to_email, subject)
        return False
    try:
        await asyncio.to_thread(_send_sync, settings, to_email, subject, text_body, html_body)
        return True
    except Exception as exc:  # noqa: BLE001 — любой сбой SMTP глушим, чтобы не валить ручку
        logger.error("failed to send email to %s: %s", to_email, exc)
        return False


def _reset_link(settings: Settings, token: str) -> str:
    return f"{settings.site_url.rstrip('/')}/reset-password?token={token}"


async def send_password_reset(settings: Settings, to_email: str, token: str) -> bool:
    """Письмо со ссылкой сброса пароля. В dev без SMTP логирует ссылку."""
    link = _reset_link(settings, token)
    if not smtp_configured(settings):
        # Локальная отладка: SMTP нет — печатаем ссылку, чтобы пройти флоу руками.
        logger.warning("SMTP off — password reset link for %s: %s", to_email, link)
        return False

    subject = "Сброс пароля — Romb VPN"
    text_body = (
        f"Вы запросили сброс пароля для аккаунта {to_email}.\n\n"
        f"Чтобы задать новый пароль, перейдите по ссылке (действует 1 час):\n{link}\n\n"
        "Если вы не запрашивали сброс — просто проигнорируйте это письмо."
    )
    html_body = (
        f"<p>Вы запросили сброс пароля для аккаунта <b>{to_email}</b>.</p>"
        f'<p><a href="{link}">Задать новый пароль</a> (ссылка действует 1 час).</p>'
        "<p>Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>"
    )
    return await send_email(settings, to_email, subject, text_body, html_body)
