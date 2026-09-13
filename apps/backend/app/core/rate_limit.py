import time
from collections import defaultdict

import asyncio

from app.core.cache import cache

# Hard cap on in-memory rate-limit entries (fallback when Redis is unavailable).
# Oldest entries are evicted first (dicts preserve insertion order in py3.7+).
MAX_IN_MEMORY_ENTRIES = 10_000


class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
        self.cleanup_task = None

    async def is_allowed(
        self,
        identifier: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int, int]:
        """Check if request is allowed.

        Returns ``(allowed, remaining, reset_in_seconds)`` so callers can expose
        accurate ``X-RateLimit-*`` headers and ``Retry-After``.
        """
        now = time.time()

        # Redis-backed path (shared across workers).
        if cache.redis:
            key = f"ratelimit:{identifier}"
            count = await cache.redis.incr(key)

            if count == 1:
                await cache.redis.expire(key, window_seconds)

            remaining = max(0, max_requests - count)
            try:
                ttl = await cache.redis.ttl(key)
                reset_in = int(ttl) if ttl and ttl > 0 else window_seconds
            except Exception:
                reset_in = window_seconds
            return count <= max_requests, remaining, reset_in

        # In-memory fallback (no Redis).
        request_times = self.requests[identifier]
        cutoff = now - window_seconds

        # Drop expired entries
        self.requests[identifier] = [t for t in request_times if t > cutoff]

        # Bound memory: evict oldest identifiers when over the cap
        if len(self.requests) > MAX_IN_MEMORY_ENTRIES:
            over = len(self.requests) - MAX_IN_MEMORY_ENTRIES
            for _ in range(over):
                self.requests.pop(next(iter(self.requests)), None)

        current = len(self.requests[identifier])
        first = self.requests[identifier][0] if self.requests[identifier] else now
        reset_in = max(1, int(window_seconds - (now - first)))

        if current >= max_requests:
            return False, 0, reset_in

        self.requests[identifier].append(now)
        remaining = max(0, max_requests - current - 1)
        return True, remaining, reset_in

    async def cleanup_old_entries(self):
        """Periodically remove stale in-memory entries."""
        while True:
            await asyncio.sleep(600)  # every 10 minutes
            now = time.time()
            stale = [
                identifier
                for identifier, request_times in self.requests.items()
                if not request_times or now - request_times[-1] > 3600
            ]
            for identifier in stale:
                self.requests.pop(identifier, None)

    def start_cleanup(self):
        """Start the background cleanup task (idempotent)."""
        if self.cleanup_task is None or self.cleanup_task.done():
            self.cleanup_task = asyncio.create_task(self.cleanup_old_entries())


rate_limiter = RateLimiter()