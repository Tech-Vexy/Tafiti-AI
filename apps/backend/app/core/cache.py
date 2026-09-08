import redis.asyncio as aioredis
from typing import Optional, Any
import json
from functools import wraps
import hashlib

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("cache")


class RedisCache:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self.enabled = bool(settings.REDIS_URL)
    
    async def connect(self):
        if self.enabled:
            self.redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
    
    async def disconnect(self):
        if self.redis:
            await self.redis.close()
    
    async def get(self, key: str) -> Optional[Any]:
        if not self.redis:
            return None
        
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.warning(f"Redis get error for key '{key}': {e}")
        return None

    async def set(self, key: str, value: Any, ttl: int = None, expire: int = None):
        if not self.redis:
            return

        try:
            ttl = ttl or expire or settings.CACHE_TTL
            await self.redis.setex(
                key,
                ttl,
                json.dumps(value, default=str)
            )
        except Exception as e:
            logger.warning(f"Redis set error for key '{key}': {e}")

    async def delete(self, key: str):
        if not self.redis:
            return

        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.warning(f"Redis delete error for key '{key}': {e}")

    async def ping(self):
        if not self.redis:
            raise ConnectionError("Redis not connected")
        await self.redis.ping()

    async def clear_pattern(self, pattern: str):
        if not self.redis:
            return

        try:
            # Use SCAN instead of KEYS to avoid blocking Redis in production
            cursor = 0
            while True:
                cursor, keys = await self.redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await self.redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            logger.warning(f"Redis clear_pattern error for '{pattern}': {e}")
    
    def make_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from prefix and arguments"""
        parts = [prefix] + [str(arg) for arg in args]
        if kwargs:
            parts.append(hashlib.md5(json.dumps(kwargs, sort_keys=True).encode()).hexdigest())
        return ":".join(parts)


# Global cache instance
cache = RedisCache()


def cached(prefix: str, ttl: int = None):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = cache.make_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator
