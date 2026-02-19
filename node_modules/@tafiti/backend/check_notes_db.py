"""
Diagnose notes 500 error — check DB tables and columns, then add any missing ones.
"""
import asyncio
import asyncpg
import os
import sys
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL", "")
url = (DB_URL
       .replace("postgresql+asyncpg://", "postgresql://")
       .replace("postgresql+psycopg2://", "postgresql://"))

if not url:
    print("ERROR: DATABASE_URL not set in .env"); sys.exit(1)

# Columns the notes table MUST have (name, DDL type)
REQUIRED_NOTES_COLS = {
    "id":         "VARCHAR(50) PRIMARY KEY",
    "user_id":    "VARCHAR(50)",
    "title":      "VARCHAR(200) NOT NULL DEFAULT ''",
    "content":    "TEXT NOT NULL DEFAULT ''",
    "tags":       "JSONB DEFAULT '[]'::jsonb",
    "project_id": "INTEGER",
    "created_at": "TIMESTAMP WITHOUT TIME ZONE DEFAULT now()",
    "updated_at": "TIMESTAMP WITHOUT TIME ZONE DEFAULT now()",
}

async def main():
    conn = await asyncpg.connect(url)

    # 1. List all tables
    tables = [r["table_name"] for r in await conn.fetch(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    )]
    print("Tables:", tables)

    # 2. Create research_projects if missing (notes FK depends on it)
    if "research_projects" not in tables:
        print("Creating research_projects table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS research_projects (
                id          SERIAL PRIMARY KEY,
                title       VARCHAR(200) NOT NULL,
                description TEXT,
                owner_id    VARCHAR(50),
                created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
            )
        """)
        print("  → research_projects created.")

    # 3. Create notes table if missing
    if "notes" not in tables:
        print("Creating notes table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id          VARCHAR(50)  PRIMARY KEY,
                user_id     VARCHAR(50)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title       VARCHAR(200) NOT NULL DEFAULT '',
                content     TEXT NOT NULL DEFAULT '',
                tags        JSONB DEFAULT '[]'::jsonb,
                project_id  INTEGER REFERENCES research_projects(id) ON DELETE SET NULL,
                created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
                updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
            )
        """)
        print("  → notes created.")
    else:
        # 4. Check for missing columns and add them
        existing = {r["column_name"] for r in await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='notes'"
        )}
        print("Existing notes columns:", sorted(existing))

        missing = {col for col in REQUIRED_NOTES_COLS if col not in existing}
        if missing:
            print("Missing columns:", missing)
            for col in missing:
                ddl = REQUIRED_NOTES_COLS[col]
                # Skip PK — can't add existing PK
                if "PRIMARY KEY" in ddl:
                    continue
                try:
                    await conn.execute(f"ALTER TABLE notes ADD COLUMN IF NOT EXISTS {col} {ddl}")
                    print(f"  + Added column: {col}")
                except Exception as e:
                    print(f"  ! Failed to add {col}: {e}")
        else:
            print("All required notes columns present.")

    # 5. Quick test query
    try:
        count = await conn.fetchval("SELECT COUNT(*) FROM notes")
        print(f"Notes table OK — {count} row(s).")
    except Exception as e:
        print("Notes query failed:", e)

    await conn.close()

asyncio.run(main())
