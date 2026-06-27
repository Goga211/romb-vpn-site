"""Тесты истории платежей: GET /api/payments (изоляция по пользователю) и
внутренний POST /api/payments/record (секрет = bot_token), который зовёт бот
после ручного продления."""

from __future__ import annotations

from app.config import get_settings

# Совпадает с USER_ID в conftest (require_principal → telegram-принципал этого id).
PRINCIPAL_TG_ID = 555001
INTERNAL_SECRET = "internal-test-secret"


async def test_payments_empty_by_default(client):
    resp = await client.get("/api/payments")
    assert resp.status_code == 200
    assert resp.json()["payments"] == []


async def test_record_then_listed(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "bot_token", INTERNAL_SECRET)

    rec = await client.post(
        "/api/payments/record",
        json={"telegram_id": PRINCIPAL_TG_ID, "months": 6},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert rec.status_code == 200
    assert rec.json()["ok"] is True

    resp = await client.get("/api/payments")
    assert resp.status_code == 200
    payments = resp.json()["payments"]
    assert len(payments) == 1
    p = payments[0]
    assert "19" in p["amount"]  # $19 (RENEW_PRICE)
    assert "6" in p["title"]
    assert p["status"] == "ok"
    assert p["date"]


async def test_record_rejects_bad_secret(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "bot_token", INTERNAL_SECRET)
    resp = await client.post(
        "/api/payments/record",
        json={"telegram_id": PRINCIPAL_TG_ID, "months": 6},
        headers={"X-Internal-Secret": "wrong"},
    )
    assert resp.status_code == 403
    # И платёж не записан.
    listed = await client.get("/api/payments")
    assert listed.json()["payments"] == []


async def test_payments_isolated_per_user(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "bot_token", INTERNAL_SECRET)
    # Платёж другого пользователя не виден текущему принципалу.
    await client.post(
        "/api/payments/record",
        json={"telegram_id": PRINCIPAL_TG_ID + 1, "months": 6},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    resp = await client.get("/api/payments")
    assert resp.json()["payments"] == []
