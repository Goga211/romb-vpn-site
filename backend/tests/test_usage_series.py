"""Парсер суточного трафика bandwidth-stats Remnawave — обе формы ответа."""

from __future__ import annotations

from app.remnawave import _extract_usage_series
from app.service import map_traffic_series


def test_modern_shape_sums_series_per_day():
    """modern /bandwidth-stats/users/{uuid}: categories[] + series[].data[]
    суммируются по нодам для каждой даты."""
    payload = {
        "categories": ["2026-06-01", "2026-06-02"],
        "series": [
            {"name": "nl", "data": [100, 200]},
            {"name": "de", "data": [10, 20]},
        ],
    }
    series = _extract_usage_series(payload)
    assert series == [
        {"date": "2026-06-01", "totalBytes": 110},
        {"date": "2026-06-02", "totalBytes": 220},
    ]


def test_modern_shape_tolerates_short_or_missing_data():
    """Серия без data или короче categories не должна ронять парсер."""
    payload = {
        "categories": ["2026-06-01", "2026-06-02"],
        "series": [{"name": "nl", "data": [100]}, {"name": "broken"}],
    }
    series = _extract_usage_series(payload)
    assert series == [
        {"date": "2026-06-01", "totalBytes": 100},
        {"date": "2026-06-02", "totalBytes": 0},
    ]


def test_legacy_shape_flat_list_passes_through():
    """legacy /bandwidth-stats/users/{uuid}/legacy: плоский список
    {date,total} — map_traffic_point читает total и суммирование по дате
    делает роутер; здесь проверяем, что точки извлекаются и маппятся."""
    payload = [
        {"nodeName": "nl", "total": 500, "date": "2026-06-01"},
        {"nodeName": "de", "total": 30, "date": "2026-06-01"},
    ]
    points = map_traffic_series(_extract_usage_series(payload))
    assert [(p.date, p.bytes) for p in points] == [
        ("2026-06-01", 500),
        ("2026-06-01", 30),
    ]


def test_none_and_unknown_shapes_yield_empty():
    """404 → None в _request и любая неизвестная форма дают пустой ряд."""
    assert _extract_usage_series(None) == []
    assert _extract_usage_series({"unexpected": 1}) == []
    assert _extract_usage_series(42) == []
