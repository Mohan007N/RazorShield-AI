"""
RazorShield AI — Redis Cache Layer.

Real-time state management for velocity tracking and feature computation.
"""

from redis.asyncio import Redis

from backend.app.core.config import settings


class CacheManager:
    """Redis cache manager for real-time features."""

    def __init__(self):
        self._redis: Redis | None = None

    async def connect(self) -> Redis:
        """Connect to Redis."""
        if self._redis is None:
            self._redis = Redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            await self._redis.ping()
        return self._redis

    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def get_redis(self) -> Redis:
        """Get Redis client."""
        return await self.connect()


cache_manager = CacheManager()

__all__ = ["cache_manager"]
