import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def diagnose():
    url = os.getenv('DATABASE_URL')
    if not url:
        print("DATABASE_URL not found in .env")
        return
    
    print(f"Connecting to: {url.split('@')[-1]}") # Log host part only
    
    try:
        conn = await asyncpg.connect(url)
        
        tables = ['saved_papers', 'saved_queries']
        for table in tables:
            print(f"\n--- Columns in {table} ---")
            query = f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table}'"
            rows = await conn.fetch(query)
            if not rows:
                print(f"Table {table} not found or no columns.")
            else:
                for r in rows:
                    print(f"- {r['column_name']} ({r['data_type']})")
        
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(diagnose())
