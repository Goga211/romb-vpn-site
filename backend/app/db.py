"""SQLite-хранилище обращений (aiosqlite).

Одно соединение на время жизни приложения хранится в `app.state.db`. Пишет в БД
только API-процесс (бот к ней не обращается), поэтому конкурентной записи из
разных процессов нет. Включён WAL для устойчивости при параллельных чтениях.
"""

from __future__ import annotations

import aiosqlite
from fastapi import Request

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tickets (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_telegram_id   INTEGER NOT NULL,
    username           TEXT,
    first_name         TEXT,
    status             TEXT NOT NULL DEFAULT 'open',  -- open | answered | closed
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id          INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author             TEXT NOT NULL,                 -- user | admin
    admin_telegram_id  INTEGER,
    text               TEXT NOT NULL,                 -- может быть пустым, если есть вложение
    attachment_path    TEXT,                          -- имя файла-картинки в папке attachments
    attachment_mime    TEXT,                          -- image/jpeg | image/png | image/webp
    created_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages(ticket_id);

-- Аккаунты десктопного входа по e-mail. Telegram-пользователей здесь нет: их
-- личность приходит подписанным initData, подписки в панели ключуются по
-- telegram_id. Для e-mail-входа нужна своя запись с паролем и стабильным
-- remnawave_key (= telegramId подписок этого аккаунта в Remnawave).
CREATE TABLE IF NOT EXISTS accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    telegram_id    INTEGER UNIQUE,                 -- проставляется при привязке к Telegram
    remnawave_key  INTEGER NOT NULL UNIQUE,        -- telegramId подписок в панели
    display_name   TEXT,
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

-- Одноразовые токены привязки Telegram к e-mail-аккаунту (обратная привязка из
-- десктоп-кабинета). Десктоп создаёт токен → пользователь открывает бота по
-- deep-link → бот подтверждает токен через внутренний endpoint API.
CREATE TABLE IF NOT EXISTS tg_link_tokens (
    token       TEXT PRIMARY KEY,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);

-- Одноразовые токены сброса пароля (десктопный e-mail-вход). Хранится SHA-256
-- токена, а не сам токен: утечка таблицы не даёт захватить аккаунт. Письмо со
-- ссылкой отправляет API через SMTP (см. mailer.py).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash  TEXT PRIMARY KEY,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);

-- История платежей (ручная модель: оператор продлевает подписку через бота → API
-- фиксирует платёж). telegram_id — тот же ключ подписок в панели, что у /api/me
-- (реальный Telegram-id или синтетический remnawave_key e-mail-аккаунта), поэтому
-- пользователь видит свои платежи рядом со своей подпиской.
CREATE TABLE IF NOT EXISTS payments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id    INTEGER NOT NULL,
    amount         INTEGER NOT NULL,              -- сумма в целых единицах валюты
    currency       TEXT NOT NULL DEFAULT 'RUB',
    period_months  INTEGER NOT NULL,              -- на сколько продлили
    status         TEXT NOT NULL DEFAULT 'success',
    note           TEXT,
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_tg ON payments(telegram_id);

-- Промокоды: код даёт bonus_days дней подписки, max_uses активаций всего
-- (0 = без лимита). Создаёт админ через бота (внутренний endpoint API).
CREATE TABLE IF NOT EXISTS promo_codes (
    code        TEXT PRIMARY KEY,           -- хранится в верхнем регистре
    bonus_days  INTEGER NOT NULL,
    max_uses    INTEGER NOT NULL DEFAULT 0, -- 0 = без лимита
    used_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

-- Активации промокодов: один код — одна активация на пользователя (telegram_id).
CREATE TABLE IF NOT EXISTS promo_redemptions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    code         TEXT NOT NULL,
    telegram_id  INTEGER NOT NULL,
    created_at   TEXT NOT NULL,
    UNIQUE(code, telegram_id)
);

-- Рефералы: кто кого привёл. Бонус пригласившему начисляется при ПЕРВОЙ оплате
-- приглашённого (rewarded=1). invitee_telegram_id уникален — один реферер на юзера.
CREATE TABLE IF NOT EXISTS referrals (
    invitee_telegram_id   INTEGER PRIMARY KEY,
    referrer_telegram_id  INTEGER NOT NULL,
    created_at            TEXT NOT NULL,
    rewarded              INTEGER NOT NULL DEFAULT 0,
    rewarded_at           TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_telegram_id);

CREATE TABLE IF NOT EXISTS referral_milestones (
    referrer_telegram_id  INTEGER NOT NULL,
    goal                  INTEGER NOT NULL,
    granted_at            TEXT NOT NULL,
    PRIMARY KEY (referrer_telegram_id, goal)
);
"""


async def connect(path: str) -> aiosqlite.Connection:
    """Открывает соединение, включает WAL/FK и создаёт схему (идемпотентно)."""
    conn = await aiosqlite.connect(path)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(_SCHEMA)
    await _migrate(conn)
    await conn.commit()
    return conn


async def _migrate(conn: aiosqlite.Connection) -> None:
    """Доводит схему уже существующих БД до текущей (ADD COLUMN идемпотентно).

    CREATE TABLE IF NOT EXISTS не добавляет колонки в созданную ранее таблицу,
    поэтому новые поля прикручиваем явно — на боевой support.db в volume.
    """
    cur = await conn.execute("PRAGMA table_info(ticket_messages)")
    columns = {row["name"] for row in await cur.fetchall()}
    if "attachment_path" not in columns:
        await conn.execute("ALTER TABLE ticket_messages ADD COLUMN attachment_path TEXT")
    if "attachment_mime" not in columns:
        await conn.execute("ALTER TABLE ticket_messages ADD COLUMN attachment_mime TEXT")


async def get_db(request: Request) -> aiosqlite.Connection:
    """FastAPI dependency: соединение из app.state (создаётся в lifespan)."""
    return request.app.state.db
