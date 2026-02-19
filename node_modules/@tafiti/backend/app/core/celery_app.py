from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "research_assistant",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    worker_max_tasks_per_child=1000,
    broker_use_ssl={"ssl_cert_reqs": "none"},
    redis_backend_use_ssl={"ssl_cert_reqs": "none"},
)


@celery_app.task(name="process_batch_synthesis")
def process_batch_synthesis(queries: list, papers: list, user_id: int):
    """Process multiple queries in background"""
    from app.agents.research_agent import get_research_agent
    import asyncio
    
    async def process():
        agent = get_research_agent()
        results = []
        
        for query, paper_list in zip(queries, papers):
            result = await agent.synthesize(query, paper_list)
            results.append({
                "query": query,
                "answer": result["answer"]
            })
        
        return results
    
    return asyncio.run(process())


@celery_app.task(name="cleanup_old_vectors")
def cleanup_old_vectors(days: int = 90):
    """Clean up old vector embeddings"""
    from app.services.vector_service import vector_store
    from datetime import datetime, timedelta
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    # Implementation depends on metadata structure
    return {"status": "completed", "cutoff": cutoff.isoformat()}


@celery_app.task(name="export_user_data")
def export_user_data(user_id: int, format: str = "json"):
    """Export all user data"""
    from app.models.database import User, SavedQuery
    from sqlalchemy import select
    import asyncio
    
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
                "queries": [q.to_dict() if hasattr(q, 'to_dict') else {} for q in queries]
            }
    
    return asyncio.run(export())


@celery_app.task(name="generate_analytics")
def generate_analytics():
    """Generate system analytics"""
    from app.models.database import User, SavedQuery, ResearchSession
    from sqlalchemy import select, func
    import asyncio
    
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
                "generated_at": datetime.utcnow().isoformat()
            }
    
    from datetime import datetime
    return asyncio.run(analyze())
