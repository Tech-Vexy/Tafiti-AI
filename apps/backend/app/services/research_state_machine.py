"""
Research State Machine
=====================
Validated state transitions with audit logging for all research entities.

Every state change goes through this service, which:
1. Validates the transition is allowed
2. Updates the status field
3. Writes to the audit log
4. Returns the result
"""

from app.core.timeutil import utcnow
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import (
    ResearchAuditLog, ResearchQuestion, ResearchTask,
    AgentTeam, Agent,
)

logger = get_logger("state_machine")

# ── Valid transitions ─────────────────────────────────────────────────────────
# Each key maps entity status to the set of allowed next statuses.

QUESTION_TRANSITIONS = {
    "active": {"paused", "completed", "abandoned"},
    "paused": {"active", "abandoned"},
    "completed": {"active"},  # reopen
    "abandoned": {"active"},  # reopen
}

TASK_TRANSITIONS = {
    "pending": {"running", "cancelled"},
    "running": {"completed", "failed", "cancelled"},
    "completed": {"pending"},  # retry
    "failed": {"pending", "cancelled"},  # retry
    "cancelled": {"pending"},  # un-cancel
}

TEAM_TRANSITIONS = {
    "forming": {"active", "disbanded"},
    "active": {"paused", "completed", "disbanded"},
    "paused": {"active", "disbanded"},
    "completed": {"active"},  # reopen
    "disbanded": {"active"},  # reform
}

AGENT_TRANSITIONS = {
    "spawned": {"active", "retired", "failed"},
    "active": {"working", "retired", "failed"},
    "working": {"active", "completed", "failed", "retired"},
    "completed": {"active", "retired"},
    "failed": {"active", "retired"},
    "retired": {"active"},  # un-retire
}

ENTITY_TRANSITIONS = {
    "question": QUESTION_TRANSITIONS,
    "task": TASK_TRANSITIONS,
    "team": TEAM_TRANSITIONS,
    "agent": AGENT_TRANSITIONS,
}

# Maps entity_type string to SQLAlchemy model
ENTITY_MODELS = {
    "question": ResearchQuestion,
    "task": ResearchTask,
    "team": AgentTeam,
    "agent": Agent,
}


class TransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


class ResearchStateMachine:
    """
    Manages validated state transitions with audit logging.
    """

    async def transition(
        self,
        entity_type: str,
        entity_id: str,
        to_status: str,
        db: AsyncSession,
        reason: Optional[str] = None,
        actor: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Transition an entity to a new status.

        Args:
            entity_type: "question", "task", "team", or "agent"
            entity_id: The entity's ID
            to_status: The target status
            db: Database session
            reason: Optional explanation for the transition
            actor: Who initiated the transition (user_id, agent_id, "system", "scheduler")
            metadata: Additional context

        Returns:
            {"from_status": str, "to_status": str, "entity_type": str, "entity_id": str}

        Raises:
            TransitionError if the transition is invalid
        """
        model = ENTITY_MODELS.get(entity_type)
        if not model:
            raise ValueError(f"Unknown entity type: {entity_type}")

        entity = await db.get(model, entity_id)
        if not entity:
            raise ValueError(f"{entity_type.title()} {entity_id} not found")

        from_status = entity.status
        transitions = ENTITY_TRANSITIONS.get(entity_type, {})
        allowed = transitions.get(from_status, set())

        if to_status not in allowed:
            raise TransitionError(
                f"Invalid transition: {entity_type} cannot go from "
                f"'{from_status}' to '{to_status}'. "
                f"Allowed: {sorted(allowed) if allowed else 'none'}"
            )

        # Apply the transition
        entity.status = to_status

        # Update timestamp fields based on entity type
        now = utcnow()
        if entity_type == "team" and to_status == "active":
            entity.updated_at = now
        elif entity_type == "team" and to_status in ("completed", "disbanded"):
            entity.updated_at = now
        elif entity_type == "team" and to_status == "paused":
            entity.updated_at = now
        elif entity_type == "agent" and to_status == "working":
            entity.started_at = now
        elif entity_type == "agent" and to_status in ("completed", "failed", "retired"):
            entity.completed_at = now
        elif entity_type == "task" and to_status == "running":
            entity.started_at = now
        elif entity_type == "task" and to_status in ("completed", "failed"):
            entity.completed_at = now
        elif entity_type == "question":
            entity.updated_at = now

        # Write audit log
        await self._write_audit_log(
            entity_type=entity_type,
            entity_id=entity_id,
            from_status=from_status,
            to_status=to_status,
            db=db,
            reason=reason,
            actor=actor,
            metadata=metadata,
            question_id=getattr(entity, "question_id", None) or (entity_id if entity_type == "question" else None),
            task_id=entity_id if entity_type == "task" else getattr(entity, "task_id", None),
            team_id=entity_id if entity_type == "team" else getattr(entity, "team_id", None),
            agent_id=entity_id if entity_type == "agent" else None,
        )

        await db.commit()

        logger.info(
            f"state_transition {entity_type}={entity_id} "
            f"'{from_status}' -> '{to_status}' actor={actor}"
        )

        return {
            "from_status": from_status,
            "to_status": to_status,
            "entity_type": entity_type,
            "entity_id": entity_id,
        }

    async def can_transition(
        self,
        entity_type: str,
        entity_id: str,
        to_status: str,
        db: AsyncSession,
    ) -> dict:
        """Check if a transition is valid without performing it."""
        model = ENTITY_MODELS.get(entity_type)
        if not model:
            return {"valid": False, "reason": f"Unknown entity type: {entity_type}"}

        entity = await db.get(model, entity_id)
        if not entity:
            return {"valid": False, "reason": f"{entity_type.title()} {entity_id} not found"}

        from_status = entity.status
        transitions = ENTITY_TRANSITIONS.get(entity_type, {})
        allowed = transitions.get(from_status, set())

        if to_status in allowed:
            return {"valid": True, "from_status": from_status, "to_status": to_status}
        return {
            "valid": False,
            "from_status": from_status,
            "allowed": sorted(allowed),
            "reason": f"Cannot go from '{from_status}' to '{to_status}'",
        }

    async def get_audit_log(
        self,
        db: AsyncSession,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        question_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict]:
        """Retrieve audit log entries."""
        stmt = select(ResearchAuditLog)

        if question_id:
            stmt = stmt.where(ResearchAuditLog.question_id == question_id)
        elif entity_type and entity_id:
            stmt = stmt.where(
                ResearchAuditLog.entity_type == entity_type,
                ResearchAuditLog.entity_id == entity_id,
            )

        stmt = stmt.order_by(desc(ResearchAuditLog.created_at)).limit(limit)
        results = (await db.execute(stmt)).scalars().all()

        return [
            {
                "id": entry.id,
                "entity_type": entry.entity_type,
                "entity_id": entry.entity_id,
                "from_status": entry.from_status,
                "to_status": entry.to_status,
                "reason": entry.reason,
                "actor": entry.actor,
                "metadata": entry.log_metadata or {},
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
            }
            for entry in results
        ]

    async def _write_audit_log(
        self, entity_type, entity_id, from_status, to_status, db,
        reason=None, actor=None, metadata=None,
        question_id=None, task_id=None, team_id=None, agent_id=None,
    ):
        import uuid
        entry = ResearchAuditLog(
            id=str(uuid.uuid4()),
            question_id=question_id, task_id=task_id,
            team_id=team_id, agent_id=agent_id,
            entity_type=entity_type, entity_id=entity_id,
            from_status=from_status, to_status=to_status,
            reason=reason, actor=actor,
            log_metadata=metadata or {},
            created_at=utcnow(),
        )
        db.add(entry)


state_machine = ResearchStateMachine()
