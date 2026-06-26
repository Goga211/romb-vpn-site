"""Простой in-memory rate-limiter (скользящее окно) для auth-ручек.

Без внешних зависимостей и без общего стора: рассчитан на один процесс приложения
(как и mock-панель). Для многоворкерного прода нужен общий бэкенд (Redis) — см. TODO.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    """Допускает не более max_requests обращений на ключ за window секунд."""

    def __init__(self, max_requests: int, window_seconds: float):
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        moment = time.monotonic() if now is None else now
        bucket = self._hits[key]
        threshold = moment - self._window
        while bucket and bucket[0] <= threshold:
            bucket.popleft()
        if len(bucket) >= self._max:
            return False
        bucket.append(moment)
        return True


def make_rate_limiter(
    max_requests: int, window_seconds: float, bucket: str
) -> Callable[[Request], Awaitable[None]]:
    """Возвращает FastAPI-зависимость, лимитирующую запросы по IP-адресу клиента."""
    limiter = SlidingWindowLimiter(max_requests, window_seconds)

    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        if not limiter.allow(f"{bucket}:{client_ip}"):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="too many requests, try again later",
            )

    return dependency
