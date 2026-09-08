from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# Only enable SSL and pool settings for non-SQLite databases (production PostgreSQL)
import os
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
_engine_kwargs = dict(
    echo=settings.DATABASE_ECHO,
    future=True,
    pool_pre_ping=True,
)
if not _is_sqlite:
    connect_args = {}
    if os.getenv("DB_SSL_ENABLED", "true").lower() == "true":
        import ssl
        ssl_verify = os.getenv("DB_SSL_VERIFY", "false").lower() == "true"
        ctx = ssl.create_default_context()
        if not ssl_verify:
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx

    _engine_kwargs.update(
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        if not _is_sqlite:
            try:
                from sqlalchemy import text
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            except Exception as e:
                import logging
                logging.getLogger("db").warning(f"Could not initialize pgvector extension: {e}")
        await conn.run_sync(Base.metadata.create_all)
