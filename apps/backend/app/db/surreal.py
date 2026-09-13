"""
SurrealDB Integration for Tafiti-AI.

Supports:
- High-performance shared/pooled AsyncSurreal client for direct SurrealQL, graph queries, and vector search.
- Agno SurrealDb memory & storage adapter for Agent memory management.
"""

import asyncio
from typing import Optional, AsyncGenerator, Any, Dict
from contextlib import asynccontextmanager
import logging

from surrealdb import AsyncSurreal
from app.core.config import settings

logger = logging.getLogger("db.surreal")

_shared_client: Optional[AsyncSurreal] = None
_client_lock = asyncio.Lock()


async def get_shared_surreal_client() -> AsyncSurreal:
    """
    Returns a singleton authenticated AsyncSurreal connection with automatic reconnect.
    Eliminates repetitive WebSocket handshakes on every query.
    """
    global _shared_client
    if _shared_client is not None:
        return _shared_client

    async with _client_lock:
        if _shared_client is not None:
            return _shared_client

        if not settings.SURREALDB_URL:
            raise ValueError("SURREALDB_URL is not configured — set it in the environment to use SurrealDB features")

        logger.info(f"Connecting shared SurrealDB client to {settings.SURREALDB_URL}...")
        client = AsyncSurreal(settings.SURREALDB_URL)
        await client.connect()
        if settings.SURREALDB_USER and settings.SURREALDB_PASSWORD:
            await client.signin({
                "username": settings.SURREALDB_USER,
                "password": settings.SURREALDB_PASSWORD,
            })
        elif settings.SURREALDB_TOKEN:
            await client.authenticate(settings.SURREALDB_TOKEN)

        await client.use(settings.SURREALDB_NAMESPACE, settings.SURREALDB_DATABASE)
        _shared_client = client
        logger.info("Shared SurrealDB client authenticated and ready.")
        return _shared_client


async def close_shared_surreal_client() -> None:
    """Gracefully close the shared SurrealDB client during application shutdown."""
    global _shared_client
    if _shared_client is not None:
        try:
            await _shared_client.close()
            logger.info("Shared SurrealDB client closed.")
        except Exception as e:
            logger.warning(f"Error closing shared SurrealDB client: {e}")
        finally:
            _shared_client = None


@asynccontextmanager
async def get_surreal_client() -> AsyncGenerator[AsyncSurreal, None]:
    """
    Context manager providing access to the shared, authenticated SurrealDB client.
    Does not close the connection on context exit so connections are reused.
    """
    try:
        client = await get_shared_surreal_client()
        yield client
    except Exception as e:
        logger.warning(f"SurrealDB client error: {e}. Attempting reconnect...")
        global _shared_client
        _shared_client = None
        # Retry with a fresh connection
        client = await get_shared_surreal_client()
        yield client


def get_agno_surreal_db(
    namespace: Optional[str] = None,
    database: Optional[str] = None,
    memory_table: str = "user_memories",
    session_table: str = "agent_sessions",
) -> Any:
    """
    Constructs an Agno SurrealDb memory backend instance configured with
    the Tafiti AI SurrealDB cluster.
    """
    from agno.db.surrealdb import SurrealDb

    ns = namespace or settings.SURREALDB_NAMESPACE
    db = database or settings.SURREALDB_DATABASE
    creds: Dict[str, str] = {}
    if settings.SURREALDB_USER and settings.SURREALDB_PASSWORD:
        creds = {
            "username": settings.SURREALDB_USER,
            "password": settings.SURREALDB_PASSWORD,
        }

    return SurrealDb(
        client=None,
        db_url=settings.SURREALDB_URL,
        db_creds=creds,
        db_ns=ns,
        db_db=db,
        memory_table=memory_table,
        session_table=session_table,
    )


def get_surreal_memory_manager(
    model: Any = None,
    memory_capture_instructions: Optional[str] = None,
    namespace: Optional[str] = None,
    database: Optional[str] = None,
) -> Any:
    """
    Returns an Agno MemoryManager connected to SurrealDB Cloud.
    """
    from agno.memory import MemoryManager

    db = get_agno_surreal_db(namespace=namespace, database=database)
    kwargs: Dict[str, Any] = {"db": db}

    if model is not None:
        kwargs["model"] = model
    if memory_capture_instructions:
        kwargs["memory_capture_instructions"] = memory_capture_instructions

    return MemoryManager(**kwargs)


async def check_surreal_health() -> Dict[str, Any]:
    """
    Verifies connection to the configured SurrealDB instance.
    """
    import aiohttp

    status: Dict[str, Any] = {
        "configured_url": settings.SURREALDB_URL,
        "http_url": settings.SURREALDB_HTTP_URL,
        "namespace": settings.SURREALDB_NAMESPACE,
        "database": settings.SURREALDB_DATABASE,
        "http_healthy": False,
        "version": None,
    }

    try:
        if not settings.SURREALDB_HTTP_URL:
            status["error"] = "SURREALDB_HTTP_URL is not configured"
            return status
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{settings.SURREALDB_HTTP_URL}/version", timeout=5) as resp:
                if resp.status == 200:
                    status["http_healthy"] = True
                    status["version"] = (await resp.text()).strip()
    except Exception as e:
        status["error"] = str(e)

    return status
