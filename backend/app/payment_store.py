"""Доступ к таблице payments — истории платежей за продление подписки.

Ручная модель оплаты: пользователь переводит на карту → оператор продлевает
подписку через бота → бот вызывает внутренний endpoint API, который пишет сюда
запись. Пользователь видит её в разделе «Платежи» (GET /api/payments).
"""

from __future__ import annotations

from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def record(
    conn: aiosqlite.Connection,
    *,
    telegram_id: int,
    amount: int,
    currency: str,
    period_months: int,
    status: str = "success",
    note: str | None = None,
) -> int:
    """Фиксирует платёж и возвращает его id."""
    cur = await conn.execute(
        "INSERT INTO payments (telegram_id, amount, currency, period_months, status, note,"
        " created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (telegram_id, amount, currency, period_months, status, note, _now()),
    )
    await conn.commit()
    return int(cur.lastrowid)


async def list_by_telegram_id(
    conn: aiosqlite.Connection, telegram_id: int
) -> list[dict]:
    """Платежи пользователя, новые сверху."""
    cur = await conn.execute(
        "SELECT * FROM payments WHERE telegram_id = ? ORDER BY created_at DESC, id DESC",
        (telegram_id,),
    )
    return [dict(row) for row in await cur.fetchall()]
