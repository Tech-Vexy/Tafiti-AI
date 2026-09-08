"""
Agent Memory Service
====================
Persistent memory for research agents across tasks.

Agents learn from discoveries, remember rejected leads, and share knowledge.
Memory is stored in the database and optionally cached in Redis.

Memory types:
- finding: a discovered fact or insight
- rejected_lead: something investigated and abandoned
- strategy: what approaches worked or didn't
- context: rolling summary of recent activity
- entity: extracted entity or relationship
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, desc, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import AgentMemory, Agent, Claim

logger = get_logger("agent_memory")

# Max memories per agent before pruning
MAX_MEMORIES_PER_AGENT = 200
# Max context window characters
CONTEXT_WINDOW_LIMIT = 4000


class AgentMemoryService:
    """Manages persistent memory for research agents."""

    async def remember(
        self,
        agent_id: str,
        memory_type: str,
        content: str,
        db: AsyncSession,
        confidence: int = 80,
        source_task_id: Optional[str] = None,
        source_claim_id: Optional[str] = None,
        expires_in_hours: Optional[int] = None,
    ) -> dict:
        """
        Add a memory to an agent's knowledge store.

        Args:
            agent_id: The agent's ID
            memory_type: finding, rejected_lead, strategy, context, entity
            content: The memory content
            confidence: How confident the agent is (0-100)
            source_task_id: Task that produced this memory
            source_claim_id: Claim this memory relates to
            expires_in_hours: Optional TTL for ephemeral memories
        """
        import uuid

        expires_at = None
        if expires_in_hours:
            from datetime import timedelta
            expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

        memory = AgentMemory(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            memory_type=memory_type,
            content=content[:2000],  # cap content length
            confidence=confidence,
            source_task_id=source_task_id,
            source_claim_id=source_claim_id,
            is_active=True,
            expires_at=expires_at,
            created_at=datetime.now(timezone.utc),
        )
        db.add(memory)

        # Prune old memories if we exceed the limit
        await self._prune_if_needed(agent_id, db)

        await db.commit()
        await db.refresh(memory)

        logger.info(
            f"memory_stored agent={agent_id} type={memory_type} "
            f"confidence={confidence} content_len={len(content)}"
        )

        return {
            "id": memory.id,
            "memory_type": memory_type,
            "content": memory.content,
            "confidence": confidence,
        }

    async def recall(
        self,
        agent_id: str,
        db: AsyncSession,
        memory_type: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 20,
    ) -> list[dict]:
        """
        Retrieve memories for an agent, optionally filtered by type.
        If query is provided, does simple keyword matching.
        """
        stmt = select(AgentMemory).where(
            AgentMemory.agent_id == agent_id,
            AgentMemory.is_active == True,
        )

        if memory_type:
            stmt = stmt.where(AgentMemory.memory_type == memory_type)

        # Simple keyword filter
        if query:
            keywords = query.lower().split()
            for kw in keywords[:5]:
                stmt = stmt.where(AgentMemory.content.ilike(f"%{kw}%"))

        stmt = stmt.order_by(desc(AgentMemory.confidence), desc(AgentMemory.created_at)).limit(limit)
        results = (await db.execute(stmt)).scalars().all()

        # Update access counts
        for m in results:
            m.access_count = (m.access_count or 0) + 1
        await db.commit()

        return [
            {
                "id": m.id,
                "memory_type": m.memory_type,
                "content": m.content,
                "confidence": m.confidence,
                "access_count": m.access_count,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in results
        ]

    async def get_context(self, agent_id: str, db: AsyncSession) -> str:
        """
        Build a formatted context string from the agent's memory.
        Used to inject into LLM prompts so agents build on prior work.
        """
        # Get recent high-confidence memories
        stmt = (
            select(AgentMemory)
            .where(AgentMemory.agent_id == agent_id, AgentMemory.is_active == True)
            .order_by(desc(AgentMemory.confidence), desc(AgentMemory.created_at))
            .limit(30)
        )
        memories = (await db.execute(stmt)).scalars().all()

        if not memories:
            return ""

        sections = []
        current_type = None
        section_items = []

        for m in memories:
            if m.memory_type != current_type:
                if section_items:
                    sections.append(f"  " + chr(10).join(section_items))
                current_type = m.memory_type
                section_items = []
            section_items.append(f"- [{m.confidence}%] {m.content[:200]}")

        if section_items:
            sections.append(f"  " + chr(10).join(section_items))

        type_labels = {
            "finding": "Discoveries",
            "rejected_lead": "Rejected Leads (avoid these)",
            "strategy": "Working Strategies",
            "context": "Context Summary",
            "entity": "Key Entities",
        }

        parts = []
        for i, section in enumerate(sections):
            label = type_labels.get(memories[i * 5].memory_type if i * 5 < len(memories) else "finding", "Other")
            parts.append(f"{label}:\n{section}")

        context = chr(10).join(parts)

        # Cap at limit
        if len(context) > CONTEXT_WINDOW_LIMIT:
            context = context[:CONTEXT_WINDOW_LIMIT] + "\n... (truncated)"

        return context

    async def share_memory(
        self,
        from_agent_id: str,
        to_agent_id: str,
        db: AsyncSession,
        memory_type: Optional[str] = None,
        limit: int = 10,
    ) -> int:
        """
        Copy high-confidence memories from one agent to another.
        Returns the number of memories shared.
        """
        stmt = (
            select(AgentMemory)
            .where(
                AgentMemory.agent_id == from_agent_id,
                AgentMemory.is_active == True,
                AgentMemory.confidence >= 70,
            )
        )
        if memory_type:
            stmt = stmt.where(AgentMemory.memory_type == memory_type)

        stmt = stmt.order_by(desc(AgentMemory.confidence)).limit(limit)
        source_memories = (await db.execute(stmt)).scalars().all()

        import uuid
        shared = 0
        for m in source_memories:
            new_mem = AgentMemory(
                id=str(uuid.uuid4()),
                agent_id=to_agent_id,
                memory_type=m.memory_type,
                content=m.content,
                confidence=max(60, m.confidence - 10),  # slightly lower confidence when shared
                source_task_id=m.source_task_id,
                source_claim_id=m.source_claim_id,
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            db.add(new_mem)
            shared += 1

        await db.commit()
        return shared

    async def forget(
        self,
        agent_id: str,
        db: AsyncSession,
        memory_type: Optional[str] = None,
        memory_id: Optional[str] = None,
    ) -> int:
        """Soft-delete memories. Returns count deleted."""
        if memory_id:
            stmt = select(AgentMemory).where(
                AgentMemory.id == memory_id,
                AgentMemory.agent_id == agent_id,
            )
    async def get_all_memories(self, agent_id: str, db: AsyncSession) -> list[dict]:
        """Get all memories for an agent."""
        return await self.recall(agent_id, db, limit=MAX_MEMORIES_PER_AGENT)

    async def _prune_if_needed(self, agent_id: str, db: AsyncSession):
        """Remove oldest/lowest-confidence memories if over limit."""
        count = await db.scalar(
            select(func.count()).where(
                AgentMemory.agent_id == agent_id,
                AgentMemory.is_active == True,
            )
        )
        if count and count >= MAX_MEMORIES_PER_AGENT:
            to_prune = count - MAX_MEMORIES_PER_AGENT + 20
            old_memories = (
                await db.execute(
                    select(AgentMemory)
                    .where(AgentMemory.agent_id == agent_id, AgentMemory.is_active == True)
                    .order_by(AgentMemory.confidence.asc(), AgentMemory.created_at.asc())
                    .limit(to_prune)
                )
            ).scalars().all()
            for m in old_memories:
                m.is_active = False


agent_memory = AgentMemoryService()
