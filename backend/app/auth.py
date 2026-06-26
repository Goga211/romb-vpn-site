"""Единая авторизация десктопа и мини-аппа.

Личность пользователя — `Principal`. Она приходит двумя путями:
  • Telegram: подписанный `initData` в заголовке `Authorization: tma <initData>`
    (как в мини-аппе) → `telegram_id` реальный;
  • e-mail: серверная сессия в HttpOnly-cookie (JWT) → `telegram_id` берётся как
    `remnawave_key` аккаунта.

В обоих случаях у Principal есть поле `.telegram_id`, поэтому весь код панели
Remnawave (он ключуется по telegram_id) работает без изменений.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import aiosqlite
import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, Request, status

from . import account_store
from .config import Settings, get_settings
from .db import get_db
from .security import parse_init_data

logger = logging.getLogger("romb.auth")

# bcrypt учитывает только первые 72 байта пароля и на длинных бросает — режем сами.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    secret = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(secret, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        secret = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(secret, password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


@dataclass(frozen=True)
class Principal:
    telegram_id: int  # реальный TG-id, либо remnawave_key e-mail-аккаунта
    username: str | None
    first_name: str | None
    kind: str  # 'telegram' | 'email'
    email: str | None = None
    account_id: int | None = None


# --------------------------------------------------------------------------- #
# JWT-сессии                                                                  #
# --------------------------------------------------------------------------- #
def issue_session_token(account_id: int, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "aid": account_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.session_ttl_days)).timestamp()),
    }
    return jwt.encode(payload, settings.session_secret, algorithm="HS256")


def _decode_session_token(token: str, settings: Settings) -> int | None:
    try:
        data = jwt.decode(token, settings.session_secret, algorithms=["HS256"])
        return int(data["aid"])
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        return None


def _extract_init_data(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() in ("tma", "twa", "bearer") and value:
        return value
    return None


# --------------------------------------------------------------------------- #
# Резолв личности                                                             #
# --------------------------------------------------------------------------- #
async def resolve_principal(
    request: Request,
    authorization: str | None,
    settings: Settings,
    conn: aiosqlite.Connection,
) -> Principal | None:
    """Определяет личность по initData или session-cookie. None — если не вышло.

    Ничего не бросает: подходит и для защищённых ручек (через require_principal),
    и для статуса сессии (optional_principal).
    """
    # 1) Telegram initData
    init_data = _extract_init_data(authorization)
    if init_data and settings.bot_token:
        try:
            user = parse_init_data(init_data, settings.bot_token)
            return Principal(
                telegram_id=user.telegram_id,
                username=user.username,
                first_name=user.first_name,
                kind="telegram",
            )
        except (ValueError, KeyError) as exc:
            logger.warning("initData rejected: %s", exc)
            return None

    # 2) e-mail сессия (cookie)
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        account_id = _decode_session_token(token, settings)
        if account_id is not None:
            account = await account_store.get_by_id(conn, account_id)
            if account is not None:
                return Principal(
                    telegram_id=int(account["remnawave_key"]),
                    username=None,
                    first_name=account["display_name"],
                    kind="email",
                    email=account["email"],
                    account_id=int(account["id"]),
                )

    # 3) dev-fallback (только если задан DEV_TELEGRAM_ID — никогда в проде)
    if settings.dev_telegram_id:
        return Principal(
            telegram_id=int(settings.dev_telegram_id),
            username="dev_user",
            first_name="Dev",
            kind="telegram",
        )
    return None


async def require_principal(
    request: Request,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
) -> Principal:
    principal = await resolve_principal(request, authorization, settings, conn)
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated"
        )
    return principal


async def optional_principal(
    request: Request,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
) -> Principal | None:
    return await resolve_principal(request, authorization, settings, conn)
