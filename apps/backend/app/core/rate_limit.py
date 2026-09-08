from fastapi import HTTPException, Request
import time
from collections import defaultdict

import asyncio

from app.core.cache import cache




class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
        self.cleanup_task = None
    
    async def is_allowed(
        self,
        identifier: str,
        max_requests: int,
        window_seconds: int
    ) -> tuple[bool, int]:
        """Check if request is allowed. Returns (allowed, remaining)."""
        now = time.time()
        
        # Get from Redis if available
        if cache.redis:
            key = f"ratelimit:{identifier}"
            count = await cache.redis.incr(key)
            
            if count == 1:
                await cache.redis.expire(key, window_seconds)
            
            remaining = max(0, max_requests - count)
            return count <= max_requests, remaining
        
        # Fallback to in-memory
        request_times = self.requests[identifier]
        cutoff = now - window_seconds
        
        # Remove old requests
        self.requests[identifier] = [
            req_time for req_time in request_times
            if req_time > cutoff
        ]
        
        # Check limit
        current = len(self.requests[identifier])
        if current >= max_requests:
            return False, 0
        
        self.requests[identifier].append(now)
        remaining = max(0, max_requests - current - 1)
        return True, remaining
    
    async def cleanup_old_entries(self):
        """Periodic cleanup of old entries"""
        while True:
            await asyncio.sleep(3600)  # Clean every hour
            now = time.time()
            
            keys_to_delete = []
            for identifier, request_times in self.requests.items():
                if not request_times or now - request_times[-1] > 86400:
                    keys_to_delete.append(identifier)
            
            for key in keys_to_delete:
                del self.requests[key]
    
    def start_cleanup(self):
        """Start cleanup task"""
        if not self.cleanup_task:
            self.cleanup_task = asyncio.create_task(self.cleanup_old_entries())


rate_limiter = RateLimiter()


async def check_rate_limit(
    request: Request,
    max_requests: int = 60,
    window_seconds: int = 60
):
    """FastAPI dependency for rate limiting"""
    # Get identifier (IP or user ID)
    identifier = request.client.host
    
    # Check if user is authenticated
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        # Use user ID if authenticated (extract from token)
        identifier = f"user:{auth_header[-10:]}"
    
    if not await rate_limiter.is_allowed(identifier, max_requests, window_seconds):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(window_seconds)}
        )
