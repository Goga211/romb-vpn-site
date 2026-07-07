"""Доставка сообщений в Telegram через Bot API.

Используется для обращений из мини-аппа: пользователь пишет внутри приложения,
бэкенд отправляет текст в чат поддержки (support_chat_id) от имени бота.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

import httpx

# Telegram обрезает подпись к фото на 1024 символах — длинный текст уедет в
# мини-апп, в подпись кладём усечённую версию.
CAPTION_LIMIT = 1024


class TelegramSendError(RuntimeError):
    pass


def renew_keyboard(telegram_id: int, months: int) -> dict:
    """Inline-кнопка «Продлить» под алертом поддержки.

    callback_data `renew:{id}` обрабатывает бот (bot/main.py, on_renew): алерт
    отправляется от имени того же бота, поэтому нажатие уходит в его диспетчер —
    оператор продлевает в один тап, не выясняя ID пользователя.
    """
    return {
        "inline_keyboard": [
            [
                {
                    "text": f"➡️ Продлить на {months} мес.",
                    "callback_data": f"renew:{telegram_id}",
                }
            ]
        ]
    }


async def send_message(
    bot_token: str, chat_id: str, text: str, reply_markup: dict | None = None
) -> None:
    """Отправляет сообщение в чат. Бросает TelegramSendError при сбое."""
    if not bot_token:
        raise TelegramSendError("BOT_TOKEN не настроен")
    if not chat_id:
        raise TelegramSendError("SUPPORT_CHAT_ID не настроен")

    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload)
    if resp.status_code >= 400:
        raise TelegramSendError(f"sendMessage -> {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if not data.get("ok"):
        raise TelegramSendError(f"sendMessage not ok: {data}")


async def send_photo(
    bot_token: str,
    chat_id: str,
    photo_path: str,
    caption: str,
    reply_markup: dict | None = None,
) -> None:
    """Отправляет картинку с подписью в чат. Бросает TelegramSendError при сбое."""
    if not bot_token:
        raise TelegramSendError("BOT_TOKEN не настроен")
    if not chat_id:
        raise TelegramSendError("SUPPORT_CHAT_ID не настроен")

    data = {"chat_id": chat_id, "caption": caption[:CAPTION_LIMIT], "parse_mode": "HTML"}
    if reply_markup is not None:
        # multipart-форма — клавиатура передаётся JSON-строкой, не объектом
        data["reply_markup"] = json.dumps(reply_markup)
    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
    path = Path(photo_path)
    async with httpx.AsyncClient(timeout=30) as client:
        with path.open("rb") as fh:
            resp = await client.post(url, data=data, files={"photo": (path.name, fh)})
    if resp.status_code >= 400:
        raise TelegramSendError(f"sendPhoto -> {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    if not data.get("ok"):
        raise TelegramSendError(f"sendPhoto not ok: {data}")


def build_alert_text(
    *,
    ticket_id: int,
    username: str | None,
    first_name: str | None,
    message: str,
    telegram_id: int | None = None,
) -> str:
    """Короткий алерт в чат поддержки: только сигнал «есть новое», без всего диалога.
    Полный диалог админ открывает в мини-аппе → раздел «Заявки».

    telegram_id — ключ подписки (реальный TG-id или синтетический remnawave_key):
    без него оператор не может продлить юзера без @username (пересылку в бот такие
    юзеры часто закрывают приватностью). Число можно скопировать и отправить боту.
    """
    who = html.escape(first_name or "пользователь")
    handle = f" (@{html.escape(username)})" if username else ""
    id_line = f"🆔 <code>{telegram_id}</code>\n" if telegram_id else ""
    preview = html.escape(message.strip())
    if len(preview) > 160:
        preview = preview[:160] + "…"
    return (
        f"🆘 <b>Новое обращение #{ticket_id}</b>\n"
        f"<b>От:</b> {who}{handle}\n"
        f"{id_line}\n"
        f"{preview}\n\n"
        "<i>Ответить: откройте «Кабинет» в боте → Поддержка → Заявки.\n"
        "Продлить: кнопка под сообщением.</i>"
    )


def build_user_reply_text(*, ticket_id: int, message: str) -> str:
    """Уведомление пользователю в личку об ответе поддержки."""
    body = html.escape(message.strip())
    return (
        f"💬 <b>Ответ поддержки по обращению #{ticket_id}</b>\n\n"
        f"{body}\n\n"
        "<i>Продолжить переписку можно в мини-аппе → Поддержка.</i>"
    )
