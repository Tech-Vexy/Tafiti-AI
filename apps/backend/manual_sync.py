import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def create_tables():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL not found")
        return
    
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://")
    
    if "sslmode" not in url:
        if "?" in url:
            url += "&sslmode=require"
        else:
            url += "?sslmode=require"
            
    print(f"Connecting to: {url.split('@')[1]}")
    try:
        conn = await asyncpg.connect(url)
        print("Connected!")
        
        print("Creating 'connections' table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS connections (
                id SERIAL PRIMARY KEY,
                follower_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                followed_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
            );
            CREATE INDEX IF NOT EXISTS ix_connections_id ON connections (id);
        """)
        
        print("Creating 'notifications' table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                link VARCHAR(255),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
            );
            CREATE INDEX IF NOT EXISTS ix_notifications_id ON notifications (id);
        """)
        
        print("Tables created successfully!")
        await conn.close()
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(create_tables())
