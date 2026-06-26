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
