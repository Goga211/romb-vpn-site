"""Рефералы: кто кого привёл, и начисление бонуса пригласившему.

Приглашённый открывает бота по ссылке t.me/<bot>?start=ref_<id> → бот регистрирует
связку через внутренний endpoint API. Бонус пригласившему начисляется ОДИН раз —
при первой оплате приглашённого (см. record_payment).
"""

from __future__ import annotations

from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def register(
    conn: aiosqlite.Connection, invitee_telegram_id: int, referrer_telegram_id: int
) -> bool:
    """Привязывает приглашённого к пригласившему. False — самореферал или
    приглашённый уже привязан (первый реферер выигрывает)."""
    if invitee_telegram_id == referrer_telegram_id:
        return False
    try:
        await conn.execute(
            "INSERT INTO referrals (invitee_telegram_id, referrer_telegram_id, created_at,"
            " rewarded) VALUES (?, ?, ?, 0)",
            (invitee_telegram_id, referrer_telegram_id, _now()),
        )
        await conn.commit()
        return True
    except aiosqlite.IntegrityError:
        return False  # приглашённый уже зарегистрирован под другим реферером


async def claim_reward(
    conn: aiosqlite.Connection, invitee_telegram_id: int
) -> int | None:
    """Атомарно помечает реферал вознаграждённым и возвращает referrer_telegram_id.

    None — если реферала нет или бонус уже начислен. Возврат referrer'а означает,
    что вызывающий код должен выдать ему дни через панель.
    """
    cur = await conn.execute(
        "SELECT referrer_telegram_id FROM referrals"
        " WHERE invitee_telegram_id = ? AND rewarded = 0",
        (invitee_telegram_id,),
    )
    row = await cur.fetchone()
    if row is None:
        return None
    await conn.execute(
        "UPDATE referrals SET rewarded = 1, rewarded_at = ? WHERE invitee_telegram_id = ?",
        (_now(), invitee_telegram_id),
    )
    await conn.commit()
    return int(row["referrer_telegram_id"])


async def count_invited(conn: aiosqlite.Connection, referrer_telegram_id: int) -> int:
    cur = await conn.execute(
        "SELECT COUNT(*) AS n FROM referrals WHERE referrer_telegram_id = ?",
        (referrer_telegram_id,),
    )
    row = await cur.fetchone()
    return int(row["n"]) if row else 0


async def count_rewarded(conn: aiosqlite.Connection, referrer_telegram_id: int) -> int:
    cur = await conn.execute(
        "SELECT COUNT(*) AS n FROM referrals WHERE referrer_telegram_id = ? AND rewarded = 1",
        (referrer_telegram_id,),
    )
    row = await cur.fetchone()
    return int(row["n"]) if row else 0


async def claim_milestone(
    conn: aiosqlite.Connection, referrer_telegram_id: int, goal: int
) -> bool:
    """Одноразовая веха: True — если пригласивший НАБРАЛ `goal` оплативших друзей
    и награда за неё ещё не выдавалась (тогда вызывающий начисляет бонусные дни).

    Считаем по rewarded (оплатившим), а не приглашённым — анти-накрутка, как у бонуса
    за друга. Идемпотентность гарантирует PRIMARY KEY (referrer, goal): повторная
    выдача ловится IntegrityError.
    """
    if goal <= 0:
        return False
    if await count_rewarded(conn, referrer_telegram_id) < goal:
        return False
    try:
        await conn.execute(
            "INSERT INTO referral_milestones (referrer_telegram_id, goal, granted_at)"
            " VALUES (?, ?, ?)",
            (referrer_telegram_id, goal, _now()),
        )
        await conn.commit()
        return True
    except aiosqlite.IntegrityError:
        return False  # награда за эту веху уже начислена
