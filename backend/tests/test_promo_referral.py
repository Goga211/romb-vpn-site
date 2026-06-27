"""Тесты промокодов и реферальной программы.

Промокод: админ создаёт (внутренний endpoint), пользователь активирует → бонусные
дни к подписке, повторно нельзя. Реферал: регистрация связки (бот), бонус
пригласившему при первой оплате приглашённого (через record_payment)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import Principal, require_principal
from app.config import get_settings
from app.db import get_db
from app.remnawave import MockRemnawave

PRINCIPAL_TG_ID = 555001
SECRET = "internal-test-secret"


@pytest.fixture
async def papi(conn, monkeypatch):
    """ASGI-клиент: принципал — telegram 555001, своя mock-панель, известный секрет."""
    from app.main import app
    from app.routers import api as api_router

    mock = MockRemnawave(get_settings())
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[api_router._client] = lambda: mock
    app.dependency_overrides[require_principal] = lambda: Principal(
        PRINCIPAL_TG_ID, "user", "User", kind="telegram"
    )
    monkeypatch.setattr(get_settings(), "bot_token", SECRET)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


def _h():
    return {"X-Internal-Secret": SECRET}


# ----- Промокоды -----

async def test_promo_create_and_redeem(papi):
    await papi.post("/api/trial")  # у принципала появляется подписка
    created = await papi.post("/api/promo/create", json={"code": "welcome", "days": 7}, headers=_h())
    assert created.status_code == 200
    assert created.json()["code"] == "WELCOME"  # нормализуется в верхний регистр

    redeem = await papi.post("/api/promo/redeem", json={"code": "welcome"})
    assert redeem.status_code == 200
    assert redeem.json()["bonus_days"] == 7

    # Повторная активация тем же пользователем — отказ.
    again = await papi.post("/api/promo/redeem", json={"code": "WELCOME"})
    assert again.status_code == 400


async def test_promo_unknown_code(papi):
    await papi.post("/api/trial")
    resp = await papi.post("/api/promo/redeem", json={"code": "NOPE"})
    assert resp.status_code == 400


async def test_promo_create_needs_secret(papi):
    resp = await papi.post("/api/promo/create", json={"code": "Y1"}, headers={"X-Internal-Secret": "no"})
    assert resp.status_code == 403


async def test_promo_default_days_from_settings(papi):
    await papi.post("/api/trial")
    # days не передаём → берётся promo_bonus_days (7).
    await papi.post("/api/promo/create", json={"code": "DEF"}, headers=_h())
    redeem = await papi.post("/api/promo/redeem", json={"code": "DEF"})
    assert redeem.json()["bonus_days"] == get_settings().promo_bonus_days


# ----- Рефералы -----

async def test_referral_register_and_info(papi):
    # 555001 пригласил 777.
    reg = await papi.post(
        "/api/referral/register",
        json={"invitee_telegram_id": 777, "referrer_telegram_id": PRINCIPAL_TG_ID},
        headers=_h(),
    )
    assert reg.status_code == 200 and reg.json()["ok"] is True

    info = await papi.get("/api/referral")
    body = info.json()
    assert f"ref_{PRINCIPAL_TG_ID}" in body["link"]
    assert body["invited"] == 1
    assert body["rewarded"] == 0


async def test_referral_self_and_duplicate_ignored(papi):
    self_ref = await papi.post(
        "/api/referral/register",
        json={"invitee_telegram_id": PRINCIPAL_TG_ID, "referrer_telegram_id": PRINCIPAL_TG_ID},
        headers=_h(),
    )
    assert self_ref.json()["ok"] is False

    await papi.post(
        "/api/referral/register",
        json={"invitee_telegram_id": 888, "referrer_telegram_id": PRINCIPAL_TG_ID},
        headers=_h(),
    )
    dup = await papi.post(
        "/api/referral/register",
        json={"invitee_telegram_id": 888, "referrer_telegram_id": 999},
        headers=_h(),
    )
    assert dup.json()["ok"] is False  # первый реферер выигрывает


async def test_referral_bonus_on_invitee_payment(papi):
    await papi.post("/api/trial")  # у пригласившего (555001) есть подписка для бонуса
    await papi.post(
        "/api/referral/register",
        json={"invitee_telegram_id": 777, "referrer_telegram_id": PRINCIPAL_TG_ID},
        headers=_h(),
    )
    # Приглашённый 777 оплатил → record_payment начисляет бонус пригласившему.
    pay = await papi.post(
        "/api/payments/record", json={"telegram_id": 777, "months": 6}, headers=_h()
    )
    assert pay.status_code == 200

    info = await papi.get("/api/referral")
    assert info.json()["rewarded"] == 1

    # Повторная оплата приглашённого бонус не дублирует.
    await papi.post("/api/payments/record", json={"telegram_id": 777, "months": 6}, headers=_h())
    info2 = await papi.get("/api/referral")
    assert info2.json()["rewarded"] == 1
