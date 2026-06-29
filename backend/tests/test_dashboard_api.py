"""Тесты эндпоинтов дашборда «Главная»: серверы и суточный трафик."""

from __future__ import annotations


async def test_servers_list(client):
    resp = await client.get("/api/servers")
    assert resp.status_code == 200
    servers = resp.json()["servers"]
    assert len(servers) >= 1
    first = servers[0]
    # Схема: имя, страна, код, статус, онлайн, загрузка 0..100.
    assert set(first) == {"name", "country", "country_code", "online", "users_online", "load"}
    assert 0 <= first["load"] <= 100
    # Маппинг кода страны в название (мок отдаёт NL → Нидерланды).
    nl = next((s for s in servers if s["country_code"] == "NL"), None)
    assert nl is not None and nl["country"] == "Нидерланды"


async def test_usage_series_default_range(client):
    resp = await client.get("/api/usage")
    assert resp.status_code == 200
    body = resp.json()
    assert "points" in body and "total_bytes" in body
    # Мок отдаёт суточный ряд за период — точки и суммарный трафик > 0.
    assert len(body["points"]) >= 1
    assert body["total_bytes"] == sum(p["bytes"] for p in body["points"])
    # Точки отсортированы по дате по возрастанию.
    dates = [p["date"] for p in body["points"]]
    assert dates == sorted(dates)


async def test_usage_series_clamps_days(client):
    # days вне диапазона зажимается в [1, 60] — не падаем и не отдаём огромный ряд.
    resp = await client.get("/api/usage?days=999")
    assert resp.status_code == 200
    assert len(resp.json()["points"]) <= 60
