import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def sync_db():
    print(f"Connecting to {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        print("Checking for required tables...")
        required_tables = ["saved_papers", "research_sessions", "saved_queries", "notes", "users", "search_history", "connections", "notifications"]
        for table in required_tables:
            check_table = text(f"SELECT to_regclass('public.{table}');")
            result = await conn.execute(check_table)
            if result.scalar():
                print(f"Table '{table}' exists.")
            else:
                print(f"Table '{table}' MISSING!")
                if table == "search_history":
                    print("Creating 'search_history' table...")
                    await conn.execute(text("""
                        CREATE TABLE search_history (
                            id SERIAL PRIMARY KEY,
                            user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            query TEXT NOT NULL,
                            results_count INTEGER DEFAULT 0,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
                        );
                        CREATE INDEX ix_search_history_id ON search_history (id);
                    """))
                    print("Table 'search_history' created successfully.")
                elif table == "connections":
                    print("Creating 'connections' table...")
                    await conn.execute(text("""
                        CREATE TABLE connections (
                            id SERIAL PRIMARY KEY,
                            follower_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            followed_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            status VARCHAR(20) DEFAULT 'pending',
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
                        );
                        CREATE INDEX ix_connections_id ON connections (id);
                    """))
                    print("Table 'connections' created successfully.")
                elif table == "notifications":
                    print("Creating 'notifications' table...")
                    await conn.execute(text("""
                        CREATE TABLE notifications (
                            id SERIAL PRIMARY KEY,
                            user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            type VARCHAR(50) NOT NULL,
                            content TEXT NOT NULL,
                            link VARCHAR(255),
                            is_read BOOLEAN DEFAULT FALSE,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
                        );
                        CREATE INDEX ix_notifications_id ON notifications (id);
                    """))
                    print("Table 'notifications' created successfully.")

        print("\nChecking for missing columns in 'users' table...")
        
        # Columns to add to 'users' table
        columns_to_add = [
            ("bio", "TEXT"),
            ("university", "VARCHAR(200)"),
            ("expertise_areas", "JSONB"),
            ("career_field", "VARCHAR(200)"),
            ("citation_count", "INTEGER DEFAULT 0"),
            ("publications_count", "INTEGER DEFAULT 0"),
            ("interest_score", "INTEGER DEFAULT 0"),
            ("subscription_status", "VARCHAR(20) DEFAULT 'trialing'"),
            ("trial_ends_at", "TIMESTAMP"),
            ("subscription_ends_at", "TIMESTAMP"),
            ("paystack_customer_id", "VARCHAR(100)"),
            ("paystack_subscription_id", "VARCHAR(100)")
        ]
        
        for col_name, col_type in columns_to_add:
            try:
                # Check if column exists
                check_sql = text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='{col_name}';
                """)
                result = await conn.execute(check_sql)
                if not result.fetchone():
                    print(f"Adding column '{col_name}' to 'users' table...")
                    await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"))
                else:
                    print(f"Column '{col_name}' already exists.")
            except Exception as e:
                print(f"Error adding column '{col_name}': {e}")

    await engine.dispose()
    print("Database sync complete.")

if __name__ == "__main__":
    asyncio.run(sync_db())
