"""Юнит-тесты построения имени пользователя для панели."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.service import (
    build_renew_months_payload,
    days_until_expiry,
    filter_nodes_for_user,
    is_expiring_soon,
    map_subscription,
    panel_username,
    squad_inbound_index,
    user_inbound_uuids,
)


def test_uses_telegram_handle_when_valid():
    assert panel_username(123, "ivan_petrov") == "ivan_petrov"


def test_fallback_when_no_handle():
    assert panel_username(923153874, None) == "tg923153874"
    assert panel_username(42, "") == "tg42"


def test_fallback_when_handle_too_short():
    # Remnawave требует >= 6 символов
    assert panel_username(7, "abc") == "tg7"


def test_fallback_when_handle_has_invalid_chars():
    assert panel_username(9, "bad-name!") == "tg9"


def test_renew_months_extends_from_active_expiry():
    """Активная подписка продлевается от текущего окончания (остаток сохраняется)."""
    raw = {"uuid": "u1", "expireAt": "2030-06-20T00:00:00.000Z"}
    payload = build_renew_months_payload(raw, 6)
    assert payload["uuid"] == "u1"
    assert payload["status"] == "ACTIVE"
    assert payload["expireAt"] == "2030-12-20T00:00:00Z"


def test_renew_upgrades_to_pro():
    """Продление переводит на Pro: безлимит трафика и заданный лимит устройств."""
    raw = {"uuid": "u1", "expireAt": "2030-06-20T00:00:00.000Z"}
    payload = build_renew_months_payload(raw, 6, device_limit=7)
    assert payload["trafficLimitBytes"] == 0  # безлимит
    assert payload["hwidDeviceLimit"] == 7


def test_renew_months_clamps_short_month():
    """31 декабря + 6 мес → 30 июня (день обрезается до последнего в месяце)."""
    raw = {"uuid": "u2", "expireAt": "2030-12-31T00:00:00.000Z"}
    assert build_renew_months_payload(raw, 6)["expireAt"] == "2031-06-30T00:00:00Z"


def test_renew_months_expired_extends_from_now():
    """Истёкшая подписка продлевается от текущего момента, а не от старой даты."""
    raw = {"uuid": "u3", "expireAt": "2020-01-01T00:00:00Z"}
    payload = build_renew_months_payload(raw, 6)
    expire = datetime.fromisoformat(payload["expireAt"].replace("Z", "+00:00"))
    expected = datetime.now(timezone.utc)
    # ~6 месяцев от сейчас (с запасом на границы месяца)
    assert timedelta(days=175) < (expire - expected) < timedelta(days=190)


# --------------------- Напоминание об окончании подписки ---------------------

NOW = datetime(2026, 6, 22, 12, 0, tzinfo=timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def test_expiring_soon_within_window():
    raw = {"expireAt": _iso(NOW + timedelta(days=2, hours=12))}
    assert is_expiring_soon(raw, 3, NOW) is True


def test_not_expiring_when_far_away():
    raw = {"expireAt": _iso(NOW + timedelta(days=10))}
    assert is_expiring_soon(raw, 3, NOW) is False


def test_not_expiring_when_already_expired():
    raw = {"expireAt": _iso(NOW - timedelta(days=1))}
    assert is_expiring_soon(raw, 3, NOW) is False


def test_not_expiring_when_status_expired():
    raw = {"status": "EXPIRED", "expireAt": _iso(NOW + timedelta(days=1))}
    assert is_expiring_soon(raw, 3, NOW) is False


def test_not_expiring_when_no_date():
    assert is_expiring_soon({}, 3, NOW) is False


def test_days_until_expiry_rounds_up():
    raw = {"expireAt": _iso(NOW + timedelta(days=2, hours=12))}
    assert days_until_expiry(raw, NOW) == 3


def test_days_until_expiry_none_without_date():
    assert days_until_expiry({}, NOW) is None


# ------------------ Серверы из подписки (фильтр по inbound) ------------------

# Сквады с их inbound'ами (форма живой панели).
_SQUADS = [
    {"uuid": "sq-kg", "name": "kg", "inbounds": [{"uuid": "inb-kg"}]},
    {"uuid": "sq-ru", "name": "ru", "inbounds": [{"uuid": "inb-ru"}]},
]
# Ноды с обслуживаемыми inbound'ами (configProfile.activeInbounds).
_NODE_KG = {"name": "kg03", "configProfile": {"activeInbounds": [{"uuid": "inb-kg"}]}}
_NODE_RU = {"name": "ru_hop", "configProfile": {"activeInbounds": [{"uuid": "inb-ru"}]}}


def test_user_sees_only_subscription_nodes():
    """Юзер в скваде kg видит только kg-ноду, не ru-ноду."""
    index = squad_inbound_index(_SQUADS)
    users = [{"activeInternalSquads": [{"uuid": "sq-kg", "name": "kg"}]}]
    inbounds = user_inbound_uuids(users, index)
    visible = filter_nodes_for_user([_NODE_KG, _NODE_RU], inbounds)
    assert [n["name"] for n in visible] == ["kg03"]


def test_multiple_squads_union_nodes():
    """Юзер в двух сквадах видит ноды обоих."""
    index = squad_inbound_index(_SQUADS)
    users = [{"activeInternalSquads": [{"uuid": "sq-kg"}, {"uuid": "sq-ru"}]}]
    inbounds = user_inbound_uuids(users, index)
    visible = filter_nodes_for_user([_NODE_KG, _NODE_RU], inbounds)
    assert {n["name"] for n in visible} == {"kg03", "ru_hop"}


def test_no_subscription_hides_all_nodes():
    """Без подписки/сквадов серверов не показываем (а не все ноды панели)."""
    index = squad_inbound_index(_SQUADS)
    inbounds = user_inbound_uuids([], index)
    assert filter_nodes_for_user([_NODE_KG, _NODE_RU], inbounds) == []


def test_squad_uuid_as_bare_string():
    """activeInternalSquads может прийти голым uuid, не объектом — поддерживаем."""
    index = squad_inbound_index(_SQUADS)
    inbounds = user_inbound_uuids([{"activeInternalSquads": ["sq-ru"]}], index)
    visible = filter_nodes_for_user([_NODE_KG, _NODE_RU], inbounds)
    assert [n["name"] for n in visible] == ["ru_hop"]


_GB = 1024 ** 3


def test_used_traffic_from_top_level():
    """Когда usedTrafficBytes на верхнем уровне есть — берём его."""
    sub = map_subscription(
        {"uuid": "u1", "usedTrafficBytes": 5 * _GB, "trafficLimitBytes": 10 * _GB}, 0
    )
    assert sub.used_traffic_bytes == 5 * _GB
    assert sub.traffic_text == "5/10 GB"


def test_used_traffic_falls_back_to_nested_user_traffic():
    """usedTrafficBytes=None сверху, но есть userTraffic.usedTrafficBytes —
    это типичный ответ живой панели, карточка не должна показывать 0."""
    sub = map_subscription(
        {
            "uuid": "u1",
            "usedTrafficBytes": None,
            "trafficLimitBytes": 10 * _GB,
            "userTraffic": {"usedTrafficBytes": 95_000_000},
        },
        0,
    )
    assert sub.used_traffic_bytes == 95_000_000


def test_used_traffic_zero_when_no_data_anywhere():
    """Нет ни верхнего поля, ни вложенного — честный 0, без падения."""
    sub = map_subscription({"uuid": "u1", "trafficLimitBytes": 10 * _GB}, 0)
    assert sub.used_traffic_bytes == 0
