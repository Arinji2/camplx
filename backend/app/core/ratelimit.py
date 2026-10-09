"""In-process sliding-window rate limiter. OWNER: shared."""
import time
from collections import defaultdict, deque

from fastapi import Request

from app.config import get_settings
from app.core.errors import ApiError


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int) -> None:
        """Raise 429 when `key` exceeded `limit` inside the configured window."""
        window = get_settings().rate_limit_window_seconds
        now = time.monotonic()
        bucket = self._hits[key]
        while bucket and now - bucket[0] >= window:
            bucket.popleft()
        if len(bucket) >= limit:
            raise ApiError(429, "RATE_LIMITED", "Too many requests. Try again shortly.")
        bucket.append(now)

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter()


def rate_limit(prefix: str, limit: int):
    """FastAPI dependency: per-client-IP sliding window on `prefix`."""

    async def _dep(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        limiter.check(f"{prefix}:{ip}", limit)

    return _dep

