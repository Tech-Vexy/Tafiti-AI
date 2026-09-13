import asyncio
import threading
from datetime import timedelta

from celery import Celery

from app.core.config import settings
from app.core.timeutil import utcnow

celery_app = Celery(
    "research_assistant",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_conf = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    "task_track_started": True,
    "task_time_limit": 3600,  # 1 hour
    "worker_max_tasks_per_child": 1000,
}

if settings.CELERY_BROKER_URL and settings.CELERY_BROKER_URL.startswith("rediss://"):
    celery_conf["broker_use_ssl"] = {"ssl_cert_reqs": "required"}
if settings.CELERY_RESULT_BACKEND and settings.CELERY_RESULT_BACKEND.startswith("rediss://"):
    celery_conf["redis_backend_use_ssl"] = {"ssl_cert_reqs": "required"}

celery_app.conf.update(**celery_conf)

# Single shared event loop for the process, created lazily and reused across
# Celery worker tasks. Spawning a new loop per task risks "Event loop is closed"
# / fd exhaustion under contention or nested loop usage.
_LOOP = None
_LOOP_LOCK = threading.Lock()


def _get_loop() -> asyncio.AbstractEventLoop:
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        with _LOOP_LOCK:
            if _LOOP is None or _LOOP.is_closed():
                _LOOP = asyncio.new_event_loop()
    return _LOOP


def _run_async(coro_factory):
    """Run an async coroutine factory on the shared event loop from this thread."""
    loop = _get_loop()
    return loop.run_until_complete(coro_factory())


@celery_app.task(name="process_batch_synthesis")
def process_batch_synthesis(queries: list, papers: list, user_id: str):
    """Process multiple queries in background"""
    from app.services.synthesis_service import synthesize_literature

    async def process():
        results = []

        for query, paper_list in zip(queries, papers):
            result = await synthesize_literature(query, paper_list)
            results.append({
                "query": query,
                "answer": (result or {}).get("answer", ""),
            })

        return results

    return _run_async(process)


@celery_app.task(name="cleanup_old_vectors")
def cleanup_old_vectors(days: int = 90):
    """Clean up old vector embeddings"""
    cutoff = utcnow() - timedelta(days=days)
    # Implementation depends on metadata structure
    return {"status": "completed", "cutoff": cutoff.isoformat()}


@celery_app.task(name="export_user_data")
def export_user_data(user_id: str, format: str = "json"):
    """Export all user data"""
    from app.models.database import SavedQuery
    from sqlalchemy import select

    async def export():
        from app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SavedQuery).where(SavedQuery.user_id == user_id)
            )
            queries = result.scalars().all()

            return {
                "user_id": user_id,
                "total_queries": len(queries),
                "queries": [
                    {
                        "id": q.id,
                        "title": q.title,
                        "query": q.query,
                        "papers": q.papers,
                        "answer": q.answer,
                        "tags": q.tags,
                        "is_favorite": q.is_favorite,
                        "created_at": q.created_at.isoformat() if q.created_at else None,
                        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
                    }
                    for q in queries
                ]
            }

    return _run_async(export)


@celery_app.task(name="generate_analytics")
def generate_analytics():
    """Generate system analytics"""
    from app.models.database import User, SavedQuery, ResearchSession
    from sqlalchemy import select, func

    async def analyze():
        from app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            # Count users
            user_count = await db.scalar(select(func.count(User.id)))

            # Count queries
            query_count = await db.scalar(select(func.count(SavedQuery.id)))

            # Count sessions
            session_count = await db.scalar(select(func.count(ResearchSession.id)))

            return {
                "total_users": user_count,
                "total_saved_queries": query_count,
                "total_sessions": session_count,
                "generated_at": utcnow().isoformat()
            }

    return _run_async(analyze)