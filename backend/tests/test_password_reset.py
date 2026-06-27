"""Тесты сброса пароля по e-mail: forgot-password (анти-энумерация + письмо),
reset-password (смена пароля по одноразовому токену, TTL/single-use)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.db import get_db
from app.remnawave import MockRemnawave


@pytest.fixture
async def auth_client(conn, monkeypatch):
    """ASGI-клиент с реальной авторизацией, изолированной БД и mock-панелью.
    Лимитеры auth-ручек выключены (их проверяет отдельный тест)."""
    from app.main import app
    from app.routers import api as api_router
    from app.routers import auth as auth_router

    mock = MockRemnawave(get_settings())
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[api_router._client] = lambda: mock
    for limiter in (
        auth_router.register_rate_limit,
        auth_router.login_rate_limit,
        auth_router.forgot_password_rate_limit,
        auth_router.reset_password_rate_limit,
    ):
        app.dependency_overrides[limiter] = lambda: None
    monkeypatch.setattr("app.routers.auth.get_client", lambda: mock)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def captured_reset(monkeypatch):
    """Перехватывает письмо сброса, чтобы достать токен (наружу он не отдаётся)."""
    sent: dict = {}

    async def _capture(settings, to_email, token):
        sent["email"] = to_email
        sent["token"] = token
        return True

    monkeypatch.setattr("app.routers.auth.mailer.send_password_reset", _capture)
    return sent


async def _register(auth_client, email="reset@b.com", password="secret123"):
    resp = await auth_client.post(
        "/api/auth/register", json={"email": email, "password": password}
    )
    assert resp.status_code == 201


async def test_forgot_password_sends_for_existing(auth_client, captured_reset):
    await _register(auth_client, "exists@b.com")
    resp = await auth_client.post(
        "/api/auth/forgot-password", json={"email": "exists@b.com"}
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert captured_reset["email"] == "exists@b.com"
    assert captured_reset["token"]


async def test_forgot_password_generic_for_unknown(auth_client, captured_reset):
    # Незарегистрированный e-mail — тот же ответ, письмо НЕ отправляется (анти-энумерация).
    resp = await auth_client.post(
        "/api/auth/forgot-password", json={"email": "nobody@b.com"}
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert "token" not in captured_reset


async def test_reset_password_full_flow(auth_client, captured_reset):
    await _register(auth_client, "flow@b.com", "oldpass123")
    await auth_client.post("/api/auth/logout")

    await auth_client.post("/api/auth/forgot-password", json={"email": "flow@b.com"})
    token = captured_reset["token"]

    reset = await auth_client.post(
        "/api/auth/reset-password", json={"token": token, "password": "newpass456"}
    )
    assert reset.status_code == 200

    # Старый пароль больше не подходит, новый — работает.
    bad = await auth_client.post(
        "/api/auth/login", json={"email": "flow@b.com", "password": "oldpass123"}
    )
    assert bad.status_code == 401
    ok = await auth_client.post(
        "/api/auth/login", json={"email": "flow@b.com", "password": "newpass456"}
    )
    assert ok.status_code == 200


async def test_reset_password_invalid_token(auth_client):
    resp = await auth_client.post(
        "/api/auth/reset-password",
        json={"token": "does-not-exist", "password": "newpass456"},
    )
    assert resp.status_code == 410


async def test_reset_token_is_single_use(auth_client, captured_reset):
    await _register(auth_client, "single@b.com")
    await auth_client.post("/api/auth/forgot-password", json={"email": "single@b.com"})
    token = captured_reset["token"]

    first = await auth_client.post(
        "/api/auth/reset-password", json={"token": token, "password": "newpass456"}
    )
    assert first.status_code == 200
    # Повторное использование того же токена — 410.
    second = await auth_client.post(
        "/api/auth/reset-password", json={"token": token, "password": "another789"}
    )
    assert second.status_code == 410


async def test_reset_password_rejects_short(auth_client, captured_reset):
    await _register(auth_client, "short@b.com")
    await auth_client.post("/api/auth/forgot-password", json={"email": "short@b.com"})
    token = captured_reset["token"]
    resp = await auth_client.post(
        "/api/auth/reset-password", json={"token": token, "password": "short"}
    )
    assert resp.status_code == 422
