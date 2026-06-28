"""Тесты e-mail авторизации десктопа: register/login/logout/session и резолв
принципала из session-cookie для защищённых ручек (/api/me)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.account_store import REMNAWAVE_KEY_OFFSET
from app.config import get_settings
from app.db import get_db
from app.remnawave import MockRemnawave


@pytest.fixture
async def auth_client(conn, monkeypatch):
    """ASGI-клиент с РЕАЛЬНОЙ авторизацией (require_principal не подменён),
    но с изолированными БД и mock-панелью. Куки httpx хранит между запросами."""
    from app.main import app
    from app.routers import api as api_router
    from app.routers import auth as auth_router

    mock = MockRemnawave(get_settings())
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[api_router._client] = lambda: mock
    # Лимитеры выключаем в интеграционных тестах (их проверяет test_rate_limit).
    app.dependency_overrides[auth_router.register_rate_limit] = lambda: None
    app.dependency_overrides[auth_router.login_rate_limit] = lambda: None
    monkeypatch.setattr("app.routers.auth.get_client", lambda: mock)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


async def test_register_sets_session_and_trial(auth_client):
    resp = await auth_client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "secret123"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["authenticated"] is True
    assert body["kind"] == "email"
    assert body["email"] == "a@b.com"
    assert get_settings().session_cookie_name in resp.cookies

    # сессия видна через /api/auth/session
    me = await auth_client.get("/api/auth/session")
    assert me.json()["authenticated"] is True
    assert me.json()["kind"] == "email"


async def test_register_duplicate_conflict(auth_client):
    await auth_client.post("/api/auth/register", json={"email": "d@b.com", "password": "secret123"})
    resp = await auth_client.post(
        "/api/auth/register", json={"email": "d@b.com", "password": "secret123"}
    )
    assert resp.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "secret123"},
        {"email": "x@y.com", "password": "short"},
    ],
)
async def test_register_validation(auth_client, payload):
    resp = await auth_client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422


async def test_login_flow(auth_client):
    await auth_client.post("/api/auth/register", json={"email": "l@b.com", "password": "secret123"})
    await auth_client.post("/api/auth/logout")

    bad = await auth_client.post(
        "/api/auth/login", json={"email": "l@b.com", "password": "wrongpass1"}
    )
    assert bad.status_code == 401

    ok = await auth_client.post(
        "/api/auth/login", json={"email": "l@b.com", "password": "secret123"}
    )
    assert ok.status_code == 200
    assert ok.json()["email"] == "l@b.com"


async def test_logout_clears_session(auth_client):
    await auth_client.post("/api/auth/register", json={"email": "o@b.com", "password": "secret123"})
    await auth_client.post("/api/auth/logout")

    me = await auth_client.get("/api/auth/session")
    assert me.json()["authenticated"] is False
    assert me.json()["kind"] == "anon"


async def test_cookie_session_authorizes_me(auth_client):
    reg = await auth_client.post(
        "/api/auth/register", json={"email": "m@b.com", "password": "secret123"}
    )
    account_id = reg.json()["account_id"]

    resp = await auth_client.get("/api/me")
    assert resp.status_code == 200
    # principal.telegram_id для e-mail-аккаунта = remnawave_key = OFFSET + account_id
    assert resp.json()["telegram_id"] == REMNAWAVE_KEY_OFFSET + account_id
    assert resp.json()["is_admin"] is False


async def test_me_without_auth_401(auth_client):
    resp = await auth_client.get("/api/me")
    assert resp.status_code == 401


async def test_session_check_renews_cookie(auth_client):
    """GET /session продлевает e-mail-сессию (sliding expiration): выставляет
    свежий session-cookie, чтобы активный пользователь не разлогинивался."""
    await auth_client.post(
        "/api/auth/register", json={"email": "renew@b.com", "password": "secret123"}
    )
    cookie_name = get_settings().session_cookie_name

    resp = await auth_client.get("/api/auth/session")
    assert resp.json()["authenticated"] is True
    # на ответе /session приходит свежий Set-Cookie (продление)
    assert cookie_name in resp.cookies


async def test_invalid_initdata_header_falls_back_to_cookie(auth_client, monkeypatch):
    """Битый initData в заголовке НЕ выкидывает пользователя с валидной cookie-сессией:
    резолв проваливается к проверке session-cookie, а не возвращает 401."""
    await auth_client.post(
        "/api/auth/register", json={"email": "fb@b.com", "password": "secret123"}
    )
    # initData-ветка резолва активна только при заданном bot_token.
    monkeypatch.setattr(get_settings(), "bot_token", "123:test-bot-token")

    resp = await auth_client.get(
        "/api/auth/session", headers={"Authorization": "tma broken-init-data"}
    )
    assert resp.status_code == 200
    assert resp.json()["authenticated"] is True
    assert resp.json()["kind"] == "email"


# ----- Обратная привязка Telegram из десктоп-кабинета -----

INTERNAL_SECRET = "internal-test-secret"


def _set_bot_token(monkeypatch):
    # confirm-endpoint сверяет X-Internal-Secret с bot_token; ставим известный.
    monkeypatch.setattr(get_settings(), "bot_token", INTERNAL_SECRET)


async def _register(auth_client, email):
    resp = await auth_client.post(
        "/api/auth/register", json={"email": email, "password": "secret123"}
    )
    assert resp.status_code == 201


def _token_from_deep_link(deep_link: str) -> str:
    return deep_link.split("start=link_", 1)[1]


async def test_link_telegram_full_flow(auth_client, monkeypatch):
    _set_bot_token(monkeypatch)
    await _register(auth_client, "tglink@b.com")

    start = await auth_client.post("/api/auth/link-telegram/start")
    assert start.status_code == 200
    assert "start=link_" in start.json()["deep_link"]
    token = _token_from_deep_link(start.json()["deep_link"])

    # неверный внутренний секрет — 403
    bad = await auth_client.post(
        "/api/auth/link-telegram/confirm",
        json={"token": token, "telegram_id": 777},
        headers={"X-Internal-Secret": "wrong"},
    )
    assert bad.status_code == 403

    ok = await auth_client.post(
        "/api/auth/link-telegram/confirm",
        json={"token": token, "telegram_id": 777},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert ok.status_code == 200
    assert ok.json()["ok"] is True

    # сессия теперь резолвится на реальный telegram_id (общая подписка)
    me = await auth_client.get("/api/me")
    assert me.json()["telegram_id"] == 777
    assert me.json()["telegram_linked"] is True


async def test_link_telegram_confirm_invalid_token(auth_client, monkeypatch):
    _set_bot_token(monkeypatch)
    await _register(auth_client, "badtok@b.com")
    resp = await auth_client.post(
        "/api/auth/link-telegram/confirm",
        json={"token": "does-not-exist", "telegram_id": 5},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 410


async def test_link_telegram_start_conflict_when_already_linked(auth_client, monkeypatch):
    _set_bot_token(monkeypatch)
    await _register(auth_client, "dup@b.com")
    start = await auth_client.post("/api/auth/link-telegram/start")
    token = _token_from_deep_link(start.json()["deep_link"])
    await auth_client.post(
        "/api/auth/link-telegram/confirm",
        json={"token": token, "telegram_id": 888},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    # повторный старт — аккаунт уже привязан
    again = await auth_client.post("/api/auth/link-telegram/start")
    assert again.status_code == 409
