"""E-mail авторизация десктопа: регистрация, вход, выход, статус сессии.

Telegram-пользователям эти ручки не нужны — они авторизуются подписанным initData.
Сессия e-mail-аккаунта хранится в HttpOnly-cookie (JWT), её выставляет/снимает
сервер. Подписка в Remnawave создаётся под стабильным remnawave_key аккаунта.
"""

from __future__ import annotations

import logging
import re
import secrets

import aiosqlite
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, field_validator

from .. import account_store, link_token_store, service
from ..auth import (
    Principal,
    hash_password,
    issue_session_token,
    optional_principal,
    require_principal,
    verify_password,
)
from ..config import Settings, get_settings
from ..db import get_db
from ..rate_limit import make_rate_limiter
from ..remnawave import RemnawaveError, get_client

logger = logging.getLogger("romb.auth.api")

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Лимитеры брутфорса/перебора. Значения берём из настроек на старте; в тестах
# зависимости подменяются на no-op (см. conftest), чтобы не упираться в лимит.
_rl = get_settings()
register_rate_limit = make_rate_limiter(
    _rl.auth_rate_limit_max, _rl.auth_rate_limit_window_seconds, "register"
)
login_rate_limit = make_rate_limiter(
    _rl.auth_rate_limit_max, _rl.auth_rate_limit_window_seconds, "login"
)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_MIN = 8


class CredentialsRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError("invalid email")
        return normalized

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        if len(value) < PASSWORD_MIN:
            raise ValueError(f"password must be at least {PASSWORD_MIN} characters")
        return value


class SessionResponse(BaseModel):
    authenticated: bool
    kind: str  # telegram | email | anon
    email: str | None = None
    display_name: str | None = None
    account_id: int | None = None


class LinkEmailResponse(BaseModel):
    email: str


class LinkTelegramStartResponse(BaseModel):
    deep_link: str
    expires_in: int


class LinkTelegramConfirmRequest(BaseModel):
    token: str
    telegram_id: int


class LinkTelegramConfirmResponse(BaseModel):
    ok: bool
    email: str


def _client():
    return get_client()


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_days * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


async def _activate_trial_for(remnawave_key: int, email: str, settings: Settings) -> None:
    """Создаёт пробную подписку для нового e-mail-аккаунта.

    Ошибку панели не пробрасываем: аккаунт уже создан, вход состоится, кабинет
    просто покажет «нет подписок» — пользователь оформит её вручную.
    """
    client = get_client()
    try:
        existing = await client.get_users_by_telegram_id(remnawave_key)
        if existing:
            return
        payload = service.build_trial_payload(settings, remnawave_key, username=None)
        payload["email"] = email
        await client.create_user(payload)
    except RemnawaveError as exc:
        logger.warning("trial creation failed for %s: %s", email, exc)


@router.post(
    "/register",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limit)],
)
async def register(
    body: CredentialsRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
):
    if await account_store.get_by_email(conn, body.email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")

    display_name = body.email.split("@", 1)[0]
    account = await account_store.create(
        conn,
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=display_name,
    )
    await _activate_trial_for(int(account["remnawave_key"]), body.email, settings)

    token = issue_session_token(int(account["id"]), settings)
    _set_session_cookie(response, token, settings)
    return SessionResponse(
        authenticated=True,
        kind="email",
        email=account["email"],
        display_name=account["display_name"],
        account_id=int(account["id"]),
    )


@router.post("/login", response_model=SessionResponse, dependencies=[Depends(login_rate_limit)])
async def login(
    body: CredentialsRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
):
    account = await account_store.get_by_email(conn, body.email)
    if account is None or not verify_password(body.password, account["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid email or password"
        )

    token = issue_session_token(int(account["id"]), settings)
    _set_session_cookie(response, token, settings)
    return SessionResponse(
        authenticated=True,
        kind="email",
        email=account["email"],
        display_name=account["display_name"],
        account_id=int(account["id"]),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(settings: Settings = Depends(get_settings)):
    # Очистку ставим на возвращаемый Response — иначе Set-Cookie потеряется.
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return response


@router.post(
    "/link-email",
    response_model=LinkEmailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limit)],
)
async def link_email(
    body: CredentialsRequest,
    principal: Principal = Depends(require_principal),
    conn: aiosqlite.Connection = Depends(get_db),
):
    """Привязывает e-mail+пароль к Telegram-аккаунту для входа на сайт.

    Вызывается из мини-аппа (Telegram-сессия). Создаёт строку в accounts с реальным
    telegram_id — после этого тот же пользователь входит на десктопе по почте и видит
    ту же подписку (resolve_principal резолвит привязанный аккаунт на telegram_id).
    Триал тут не создаём: подписка уже привязана к telegram_id.
    """
    # Для e-mail-входа почта уже есть — привязка не нужна.
    if principal.kind != "telegram":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="email login already configured"
        )
    if await account_store.get_by_telegram_id(conn, principal.telegram_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="telegram already linked to an email"
        )
    if await account_store.get_by_email(conn, body.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email already registered"
        )

    display_name = principal.first_name or body.email.split("@", 1)[0]
    account = await account_store.create(
        conn,
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=display_name,
    )
    await account_store.link_telegram(conn, int(account["id"]), principal.telegram_id)
    return LinkEmailResponse(email=account["email"])


@router.post("/link-telegram/start", response_model=LinkTelegramStartResponse)
async def link_telegram_start(
    principal: Principal = Depends(require_principal),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
):
    """Десктоп (e-mail-сессия) запрашивает deep-link для привязки Telegram.

    Возвращает ссылку t.me/<bot>?start=link_<token>. Пользователь открывает бота,
    бот подтверждает токен через /link-telegram/confirm, и аккаунту проставляется
    telegram_id — подписка становится общей с мини-аппом.
    """
    # Привязка нужна только e-mail-сессии (десктоп). Telegram-вход и так «привязан».
    if principal.kind == "telegram" or principal.account_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="email session required"
        )
    account = await account_store.get_by_id(conn, principal.account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    if account["telegram_id"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="telegram already linked"
        )

    token = await link_token_store.create(conn, int(account["id"]))
    deep_link = f"https://t.me/{settings.bot_username}?start=link_{token}"
    return LinkTelegramStartResponse(
        deep_link=deep_link, expires_in=link_token_store.TOKEN_TTL_SECONDS
    )


@router.post("/link-telegram/confirm", response_model=LinkTelegramConfirmResponse)
async def link_telegram_confirm(
    body: LinkTelegramConfirmRequest,
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
    x_internal_secret: str | None = Header(default=None),
):
    """Внутренний endpoint для бота: подтверждает токен и привязывает telegram_id.

    Защищён общим секретом (= bot_token), который знают только бот и API. Снаружи
    недоступен по смыслу: telegram_id боту даёт сам Telegram (id отправителя).
    """
    if not settings.bot_token or not x_internal_secret or not secrets.compare_digest(
        x_internal_secret, settings.bot_token
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    account_id = await link_token_store.consume(conn, body.token)
    if account_id is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="link code invalid or expired"
        )

    existing = await account_store.get_by_telegram_id(conn, body.telegram_id)
    if existing is not None and int(existing["id"]) != account_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="telegram already linked to another account",
        )

    account = await account_store.get_by_id(conn, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="account not found")

    await account_store.link_telegram(conn, account_id, body.telegram_id)
    return LinkTelegramConfirmResponse(ok=True, email=account["email"])


@router.get("/session", response_model=SessionResponse)
async def session(principal: Principal | None = Depends(optional_principal)):
    if principal is None:
        return SessionResponse(authenticated=False, kind="anon")
    return SessionResponse(
        authenticated=True,
        kind=principal.kind,
        email=principal.email,
        display_name=principal.first_name,
        account_id=principal.account_id,
    )
