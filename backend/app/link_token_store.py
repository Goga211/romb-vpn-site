"""Одноразовые токены привязки Telegram к e-mail-аккаунту.

Десктоп-кабинет (e-mail-сессия) создаёт токен → отдаёт пользователю deep-link на
бота → бот подтверждает токен через внутренний endpoint, и API проставляет
telegram_id аккаунту. Токен одноразовый и с TTL.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import aiosqlite

TOKEN_TTL_SECONDS = 600  # 10 минут на то, чтобы открыть бота и подтвердить


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create(conn: aiosqlite.Connection, account_id: int) -> str:
    """Создаёт одноразовый токен для аккаунта. Заодно чистит протухшие."""
    await conn.execute("DELETE FROM tg_link_tokens WHERE expires_at < ?", (_now().isoformat(),))
    token = secrets.token_urlsafe(24)
    expires_at = _now() + timedelta(seconds=TOKEN_TTL_SECONDS)
    await conn.execute(
        "INSERT INTO tg_link_tokens (token, account_id, created_at, expires_at)"
        " VALUES (?, ?, ?, ?)",
        (token, account_id, _now().isoformat(), expires_at.isoformat()),
    )
    await conn.commit()
    return token


async def consume(conn: aiosqlite.Connection, token: str) -> int | None:
    """Возвращает account_id и гасит токен. None — если не найден или протух."""
    cur = await conn.execute(
        "SELECT account_id, expires_at FROM tg_link_tokens WHERE token = ?", (token,)
    )
    row = await cur.fetchone()
    if row is None:
        return None
    # Токен одноразовый — удаляем при любом исходе (даже если протух).
    await conn.execute("DELETE FROM tg_link_tokens WHERE token = ?", (token,))
    await conn.commit()
    expires_at = datetime.fromisoformat(row["expires_at"])
    if expires_at < _now():
        return None
    return int(row["account_id"])
