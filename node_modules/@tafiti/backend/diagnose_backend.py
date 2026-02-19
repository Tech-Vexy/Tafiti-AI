import asyncio
import httpx
from app.db.session import engine, init_db
from app.core.config import settings
from sqlalchemy import select, text

async def diagnose():
    print(f"APP_NAME: {settings.APP_NAME}")
    print(f"ALLOWED_ORIGINS: {settings.ALLOWED_ORIGINS} (Type: {type(settings.ALLOWED_ORIGINS)})")
    print(f"DATABASE_URL (masked): {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'LOCAL'}")
    
    print("\n--- Testing Database Connection ---")
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"Database SELECT 1 result: {result.scalar()}")
        print("Database connection SUCCESS")
    except Exception as e:
        print(f"Database connection FAILED: {e}")

    print("\n--- Testing Init DB (Creation All) ---")
    try:
        await init_db()
        print("Init DB SUCCESS")
    except Exception as e:
        print(f"Init DB FAILED: {e}")

    print("\n--- Testing Redis Connection ---")
    try:
        import redis.asyncio as redis
        r = redis.from_url(settings.REDIS_URL)
        await r.ping()
        print("Redis connection SUCCESS")
        await r.close()
    except Exception as e:
        print(f"Redis connection FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(diagnose())
