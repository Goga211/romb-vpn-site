"""Тесты hardening авторизации: rate-limiter и проверка прод-конфига."""

from __future__ import annotations

import pytest

from app.config import DEFAULT_SESSION_SECRET, Settings, validate_runtime_config
from app.rate_limit import SlidingWindowLimiter


def test_limiter_blocks_after_max_within_window():
    limiter = SlidingWindowLimiter(max_requests=2, window_seconds=60)
    assert limiter.allow("ip", now=0.0) is True
    assert limiter.allow("ip", now=1.0) is True
    assert limiter.allow("ip", now=2.0) is False  # третий за окно — отказ


def test_limiter_recovers_after_window():
    limiter = SlidingWindowLimiter(max_requests=1, window_seconds=10)
    assert limiter.allow("ip", now=0.0) is True
    assert limiter.allow("ip", now=5.0) is False
    assert limiter.allow("ip", now=11.0) is True  # окно прошло — снова можно


def test_limiter_keys_are_isolated():
    limiter = SlidingWindowLimiter(max_requests=1, window_seconds=60)
    assert limiter.allow("a", now=0.0) is True
    assert limiter.allow("b", now=0.0) is True  # другой ключ — свой счётчик
    assert limiter.allow("a", now=1.0) is False


def test_prod_config_rejects_default_secret():
    settings = Settings(environment="prod", session_secret=DEFAULT_SESSION_SECRET, cookie_secure=True)
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        validate_runtime_config(settings)


def test_prod_config_rejects_insecure_cookie():
    settings = Settings(
        environment="prod", session_secret="x" * 40, cookie_secure=False
    )
    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        validate_runtime_config(settings)


def test_prod_config_rejects_wildcard_cors():
    settings = Settings(
        environment="prod",
        session_secret="x" * 40,
        cookie_secure=True,
        cors_origins="https://romb.app,*",
    )
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        validate_runtime_config(settings)


def test_prod_config_rejects_remnawave_mock():
    settings = Settings(
        environment="prod",
        session_secret="x" * 40,
        cookie_secure=True,
        cors_origins="https://romb.app",
        remnawave_mock=True,
    )
    with pytest.raises(RuntimeError, match="REMNAWAVE_MOCK"):
        validate_runtime_config(settings)


def test_prod_config_passes_when_hardened():
    settings = Settings(
        environment="prod",
        session_secret="x" * 40,
        cookie_secure=True,
        cors_origins="https://romb.app",
        remnawave_mock=False,
    )
    validate_runtime_config(settings)  # не бросает


def test_dev_config_allows_default_secret():
    settings = Settings(environment="dev", session_secret=DEFAULT_SESSION_SECRET)
    validate_runtime_config(settings)  # только warning, без ошибки
