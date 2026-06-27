"""Тесты привязки e-mail к Telegram-аккаунту (вход на сайте).

Фикстура `client` (conftest) подменяет require_principal на Telegram-принципала,
поэтому здесь это «пользователь в мини-аппе, привязывающий почту».
"""

from __future__ import annotations

import pytest

from app import account_store


async def test_link_email_creates_linked_account(client, conn):
    resp = await client.post(
        "/api/auth/link-email", json={"email": "tg@b.com", "password": "secret123"}
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "tg@b.com"

    account = await account_store.get_by_email(conn, "tg@b.com")
    assert account is not None
    # Привязан к реальному telegram_id → подписка будет общей с десктопом.
    assert account["telegram_id"] is not None


async def test_link_email_conflict_when_already_linked(client):
    first = await client.post(
        "/api/auth/link-email", json={"email": "one@b.com", "password": "secret123"}
    )
    assert first.status_code == 201
    second = await client.post(
        "/api/auth/link-email", json={"email": "two@b.com", "password": "secret123"}
    )
    assert second.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "secret123"},
        {"email": "x@y.com", "password": "short"},
    ],
)
async def test_link_email_validation(client, payload):
    resp = await client.post("/api/auth/link-email", json=payload)
    assert resp.status_code == 422


async def test_me_reports_linked_email(client):
    await client.post(
        "/api/auth/link-email", json={"email": "me@b.com", "password": "secret123"}
    )
    resp = await client.get("/api/me")
    assert resp.status_code == 200
    assert resp.json()["linked_email"] == "me@b.com"
