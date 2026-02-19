
import asyncio
from sqlalchemy import select
from app.db.session import async_session
from app.models.database import SavedQuery
import json

async def check_data():
    async with async_session() as session:
        result = await session.execute(select(SavedQuery))
        queries = result.scalars().all()
        print(f"Total queries: {len(queries)}")
        for q in queries:
            print(f"Checking Query ID: {q.id}, User: {q.user_id}")
            try:
                # Check if papers is a list
                if not isinstance(q.papers, list):
                    print(f"  [ERROR] ID {q.id}: papers is not a list! Type: {type(q.papers)}")
                    print(f"  Value: {q.papers}")
                else:
                    print(f"  [OK] ID {q.id}: papers is a list of {len(q.papers)} items")
                
                # Check if tags is a list
                if not isinstance(q.tags, list):
                    print(f"  [ERROR] ID {q.id}: tags is not a list! Type: {type(q.tags)}")
            except Exception as e:
                print(f"  [CRITICAL] ID {q.id}: Error accessing fields: {e}")

if __name__ == "__main__":
    asyncio.run(check_data())
