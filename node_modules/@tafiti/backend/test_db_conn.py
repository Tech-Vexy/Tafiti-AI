import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def test_conn():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL not found")
        return
    
    # Remove SQLAlchemy prefix if present
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://")
    
    # Ensure it uses sslmode=require for Neon
    if "sslmode" not in url:
        if "?" in url:
            url += "&sslmode=require"
        else:
            url += "?sslmode=require"
            
    print(f"Testing connection to: {url.split('@')[1]}")
    try:
        conn = await asyncpg.connect(url)
        print("Successfully connected to Neon!")
        val = await conn.fetchval("SELECT 1")
        print(f"Query result: {val}")
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
