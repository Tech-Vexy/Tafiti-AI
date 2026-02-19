
import asyncio
from sqlalchemy import text
from app.db.session import engine

async def check_raw_data():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, user_id, title, papers, tags FROM saved_queries LIMIT 5"))
        rows = result.fetchall()
        print(f"Total raw rows: {len(rows)}")
        for row in rows:
            print(f"\nRow ID: {row.id}")
            print(f"  User: {row.user_id}")
            print(f"  Title: {row.title}")
            print(f"  Papers (type: {type(row.papers)}):")
            print(f"    {str(row.papers)[:200]}...")
            print(f"  Tags (type: {type(row.tags)}):")
            print(f"    {row.tags}")

if __name__ == "__main__":
    asyncio.run(check_raw_data())
