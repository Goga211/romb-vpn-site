"""Одноразовые токены сброса пароля (десктопный e-mail-вход).

В БД хранится не сам токен, а его SHA-256: утечка таблицы не даёт захватить
аккаунт (в отличие от tg_link_tokens, где сырой токен бесполезен без доступа к
Telegram-аккаунту). Токен одноразовый и с TTL; на аккаунт держим один активный.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import aiosqlite

TOKEN_TTL_SECONDS = 3600  # 1 час на то, чтобы открыть письмо и сменить пароль


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create(conn: aiosqlite.Connection, account_id: int) -> str:
    """Создаёт токен сброса для аккаунта, возвращает сырой токен (в БД — его хэш).

    Заодно чистит протухшие и прежние токены этого аккаунта — активный всегда один,
    повторный запрос сброса инвалидирует предыдущую ссылку.
    """
    await conn.execute(
        "DELETE FROM password_reset_tokens WHERE expires_at < ? OR account_id = ?",
        (_now().isoformat(), account_id),
    )
    token = secrets.token_urlsafe(32)
    expires_at = _now() + timedelta(seconds=TOKEN_TTL_SECONDS)
    await conn.execute(
        "INSERT INTO password_reset_tokens (token_hash, account_id, created_at, expires_at)"
        " VALUES (?, ?, ?, ?)",
        (_hash(token), account_id, _now().isoformat(), expires_at.isoformat()),
    )
    await conn.commit()
    return token


async def consume(conn: aiosqlite.Connection, token: str) -> int | None:
    """Возвращает account_id и гасит токен. None — если не найден или протух."""
    token_hash = _hash(token)
    cur = await conn.execute(
        "SELECT account_id, expires_at FROM password_reset_tokens WHERE token_hash = ?",
        (token_hash,),
    )
    row = await cur.fetchone()
    if row is None:
        return None
    # Одноразовый — удаляем при любом исходе (даже если уже протух).
    await conn.execute("DELETE FROM password_reset_tokens WHERE token_hash = ?", (token_hash,))
    await conn.commit()
    if datetime.fromisoformat(row["expires_at"]) < _now():
        return None
    return int(row["account_id"])
