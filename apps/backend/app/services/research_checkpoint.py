"""
Research Checkpoint Service
==========================
Serializes full research state into JSON snapshots for pause/resume.

Captures:
- Question status + all tasks + their statuses
- All sources, passages, evidence, claims
- Team composition + agent statuses + messages
- Agent memories
- Audit trail summary
"""

from app.core.timeutil import utcnow
from typing import Optional

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import (
    ResearchCheckpoint, ResearchQuestion, ResearchTask,
    Source, Passage, Evidence, Claim,
    AgentTeam, Agent, AgentMemory,
)

logger = get_logger("checkpoint")


class ResearchCheckpointService:
    """Snapshot and restore research state."""

    async def create_checkpoint(
        self,
        question_id: str,
        db: AsyncSession,
        trigger: str = "auto",
        summary: Optional[str] = None,
    ) -> dict:
        """
        Create a full snapshot of the research state.

        Args:
            question_id: The research question ID
            db: Database session
            trigger: What caused the checkpoint (auto, manual, pause, complete, error)
            summary: Human-readable summary of the checkpoint
        """
        import uuid

        # Gather all state
        question = await db.get(ResearchQuestion, question_id)

        # Tasks
        tasks = (
            await db.execute(
                select(ResearchTask).where(ResearchTask.question_id == question_id)
            )
        ).scalars().all()

        # Sources (via tasks)
        sources = []
        passages = []
        for task in tasks:
            task_sources = (
                await db.execute(
                    select(Source).where(Source.task_id == task.id)
                )
            ).scalars().all()
            for src in task_sources:
                src_passages = (
                    await db.execute(
                        select(Passage).where(Passage.source_id == src.id)
                    )
                ).scalars().all()
                passages.extend(src_passages)
                sources.append({
                    "id": src.id,
                    "title": src.title,
                    "source_type": src.source_type,
                    "year": src.year,
                    "doi": src.doi,
                    "citation_count": src.citation_count,
                    "relevance_score": src.relevance_score,
                })

        # Claims
        claims = (
            await db.execute(
                select(Claim).where(Claim.question_id == question_id)
            )
        ).scalars().all()

        # Evidence
        evidence_count = 0
        if claims:
            evidence_count = await db.scalar(
                select(func.count()).where(
                    Evidence.claim_id.in_([c.id for c in claims])
                )
            ) or 0

        # Team + agents
        team = (
            await db.execute(
                select(AgentTeam).where(AgentTeam.question_id == question_id)
            )
        ).scalars().first()

        agents_data = []
        if team:
            agents = (
                await db.execute(
                    select(Agent).where(Agent.team_id == team.id)
                )
            ).scalars().all()
            for a in agents:
                agents_data.append({
                    "id": a.id,
                    "role": a.role,
                    "name": a.name,
                    "status": a.status,
                    "tasks_completed": a.tasks_completed,
                })

        # Agent memories (all agents in team)
        memories = []
        if team:
            agent_ids = [a.id for a in agents_data]
            if agent_ids:
                all_memories = (
                    await db.execute(
                        select(AgentMemory).where(
                            AgentMemory.agent_id.in_(agent_ids),
                            AgentMemory.is_active,
                        )
                    )
                ).scalars().all()
                for m in all_memories:
                    memories.append({
                        "agent_id": m.agent_id,
                        "type": m.memory_type,
                        "content": m.content[:200],
                        "confidence": m.confidence,
                    })

        # Build snapshot
        snapshot = {
            "question": {
                "id": question_id,
                "question": question.question if question else "",
                "description": question.description if question else "",
                "status": question.status if question else "active",
            },
            "tasks": [
                {
                    "id": t.id,
                    "task_type": t.task_type,
                    "description": t.description,
                    "status": t.status,
                    "depends_on": t.depends_on or [],
                    "result_summary": t.result_summary[:500] if t.result_summary else None,
                }
                for t in tasks
            ],
            "sources": sources,
            "passages_count": len(passages),
            "claims": [
                {
                    "id": c.id,
                    "text": c.text[:300],
                    "claim_type": c.claim_type,
                    "confidence": c.confidence,
                    "verification_status": c.verification_status,
                    "supporting_count": c.supporting_count,
                    "contradicting_count": c.contradicting_count,
                }
                for c in claims
            ],
            "evidence_count": evidence_count,
            "team": {
                "id": team.id if team else None,
                "status": team.status if team else None,
                "name": team.name if team else None,
            } if team else None,
            "agents": agents_data,
            "memories": memories,
        }

        # Save checkpoint
        cp = ResearchCheckpoint(
            id=str(uuid.uuid4()),
            question_id=question_id,
            team_id=team.id if team else None,
            trigger=trigger,
            snapshot=snapshot,
            summary=summary,
            task_count=len(tasks),
            source_count=len(sources),
            claim_count=len(claims),
            agent_count=len(agents_data),
            created_at=utcnow(),
        )
        db.add(cp)
        await db.commit()
        await db.refresh(cp)

        logger.info(
            f"checkpoint_created question={question_id} trigger={trigger} "
            f"tasks={len(tasks)} sources={len(sources)} claims={len(claims)}"
        )

        return {
            "id": cp.id,
            "trigger": trigger,
            "task_count": len(tasks),
            "source_count": len(sources),
            "claim_count": len(claims),
            "agent_count": len(agents_data),
            "created_at": cp.created_at.isoformat() if cp.created_at else None,
        }

    async def list_checkpoints(
        self,
        question_id: str,
        db: AsyncSession,
        limit: int = 20,
    ) -> list[dict]:
        """List checkpoints for a question."""
        stmt = (
            select(ResearchCheckpoint)
            .where(ResearchCheckpoint.question_id == question_id)
            .order_by(desc(ResearchCheckpoint.created_at))
            .limit(limit)
        )
        results = (await db.execute(stmt)).scalars().all()

        return [
            {
                "id": cp.id,
                "trigger": cp.trigger,
                "summary": cp.summary,
                "task_count": cp.task_count,
                "source_count": cp.source_count,
                "claim_count": cp.claim_count,
                "agent_count": cp.agent_count,
                "created_at": cp.created_at.isoformat() if cp.created_at else None,
            }
            for cp in results
        ]


checkpoint_service = ResearchCheckpointService()
