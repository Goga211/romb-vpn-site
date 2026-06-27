"""Промокоды и их активации.

Код даёт фиксированное число бонусных дней подписки. Создаёт админ через бота
(внутренний endpoint API — бот в БД не пишет). Активация — одна на пользователя.
"""

from __future__ import annotations

from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize(code: str) -> str:
    return code.strip().upper()


async def create(
    conn: aiosqlite.Connection, code: str, bonus_days: int, max_uses: int = 0
) -> bool:
    """Создаёт промокод. False — если такой код уже есть."""
    try:
        await conn.execute(
            "INSERT INTO promo_codes (code, bonus_days, max_uses, used_count, created_at)"
            " VALUES (?, ?, ?, 0, ?)",
            (normalize(code), bonus_days, max_uses, _now()),
        )
        await conn.commit()
        return True
    except aiosqlite.IntegrityError:
        return False


async def get(conn: aiosqlite.Connection, code: str) -> dict | None:
    cur = await conn.execute(
        "SELECT * FROM promo_codes WHERE code = ?", (normalize(code),)
    )
    row = await cur.fetchone()
    return dict(row) if row else None


async def already_redeemed(
    conn: aiosqlite.Connection, code: str, telegram_id: int
) -> bool:
    cur = await conn.execute(
        "SELECT 1 FROM promo_redemptions WHERE code = ? AND telegram_id = ?",
        (normalize(code), telegram_id),
    )
    return await cur.fetchone() is not None


async def redeem(
    conn: aiosqlite.Connection, code: str, telegram_id: int
) -> int | None:
    """Помечает код активированным пользователем и возвращает bonus_days.

    None — если код не найден, исчерпан или уже активирован этим пользователем.
    Сама выдача дней (через панель) делается вызывающим кодом после успеха.
    """
    norm = normalize(code)
    row = await get(conn, norm)
    if row is None:
        return None
    if row["max_uses"] and row["used_count"] >= row["max_uses"]:
        return None
    if await already_redeemed(conn, norm, telegram_id):
        return None
    try:
        await conn.execute(
            "INSERT INTO promo_redemptions (code, telegram_id, created_at) VALUES (?, ?, ?)",
            (norm, telegram_id, _now()),
        )
    except aiosqlite.IntegrityError:
        return None  # гонка: успели активировать параллельно
    await conn.execute(
        "UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?", (norm,)
    )
    await conn.commit()
    return int(row["bonus_days"])
