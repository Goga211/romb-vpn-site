"""Доступ к таблице accounts (десктопный вход по e-mail).

Аккаунт ключуется по e-mail и/или telegram_id. Для подписок в Remnawave у него
есть стабильный remnawave_key — синтетический «telegramId» вне диапазона реальных
Telegram-id, чтобы весь код панели, завязанный на telegram_id, работал без правок.
"""

from __future__ import annotations

from datetime import datetime, timezone

import aiosqlite

# Сдвиг для синтетических ключей. Реальные Telegram-id сейчас ~10^10, до 10^15 им
# далеко — пересечений с настоящими telegram_id не будет.
REMNAWAVE_KEY_OFFSET = 1_000_000_000_000_000


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row: aiosqlite.Row | None) -> dict | None:
    return dict(row) if row is not None else None


async def get_by_email(conn: aiosqlite.Connection, email: str) -> dict | None:
    cur = await conn.execute(
        "SELECT * FROM accounts WHERE email = ?", (email.strip().lower(),)
    )
    return _row_to_dict(await cur.fetchone())


async def get_by_id(conn: aiosqlite.Connection, account_id: int) -> dict | None:
    cur = await conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,))
    return _row_to_dict(await cur.fetchone())


async def get_by_telegram_id(conn: aiosqlite.Connection, telegram_id: int) -> dict | None:
    cur = await conn.execute(
        "SELECT * FROM accounts WHERE telegram_id = ?", (telegram_id,)
    )
    return _row_to_dict(await cur.fetchone())


async def create(
    conn: aiosqlite.Connection,
    *,
    email: str,
    password_hash: str,
    display_name: str | None = None,
) -> dict:
    """Создаёт аккаунт и присваивает стабильный remnawave_key (= OFFSET + id)."""
    normalized = email.strip().lower()
    cur = await conn.execute(
        "INSERT INTO accounts (email, password_hash, remnawave_key, display_name, created_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (normalized, password_hash, 0, display_name, _now()),
    )
    account_id = int(cur.lastrowid)
    remnawave_key = REMNAWAVE_KEY_OFFSET + account_id
    await conn.execute(
        "UPDATE accounts SET remnawave_key = ? WHERE id = ?", (remnawave_key, account_id)
    )
    await conn.commit()
    created = await get_by_id(conn, account_id)
    assert created is not None
    return created


async def link_telegram(
    conn: aiosqlite.Connection, account_id: int, telegram_id: int
) -> None:
    """Привязывает Telegram-id к существующему e-mail-аккаунту (идемпотентно)."""
    await conn.execute(
        "UPDATE accounts SET telegram_id = ? WHERE id = ?", (telegram_id, account_id)
    )
    await conn.commit()
