"""
Research Durability Service
==========================
Ensures no research work is lost on crash, restart, or failure.

Key capabilities:
1. Durable session state (replaces in-memory dict)
2. Write-ahead logging for task execution
3. Crash recovery on startup (detect orphaned sessions/tasks)
4. Task timeout enforcement
5. Idempotent task execution
6. Heartbeat monitoring
"""

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import (
    ResearchSessionState, TaskExecutionLog,
)

logger = get_logger("durability")


def _utcnow() -> datetime:
    """Naive UTC now, matching the TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DurabilityService:
    """
    Manages durable research session state.
    All session tracking goes through the database, not in-memory dicts.
    """

    # ── Session Lifecycle ─────────────────────────────────────────────────────

    async def get_or_create_session(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Get existing session or create a new one."""
        session = await db.scalar(
            select(ResearchSessionState).where(
                ResearchSessionState.question_id == question_id
            )
        )

        if session:
            return self._session_to_dict(session)

        # Create new session
        session = ResearchSessionState(
            id=str(uuid.uuid4()),
            question_id=question_id,
            status="idle",
            heartbeat_at=_utcnow(),
            created_at=_utcnow(),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        return self._session_to_dict(session)

    async def start_session(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Mark a session as running."""
        session = await db.scalar(
            select(ResearchSessionState).where(
                ResearchSessionState.question_id == question_id
            )
        )
        if not session:
            return await self.get_or_create_session(question_id, db)

        session.status = "running"
        session.started_at = _utcnow()
        session.heartbeat_at = _utcnow()
        await db.commit()
        return self._session_to_dict(session)

    async def update_heartbeat(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> None:
        """Update the heartbeat timestamp to prevent orphan detection."""
        session = await db.scalar(
            select(ResearchSessionState).where(
                ResearchSessionState.question_id == question_id
            )
        )
        if session:
            session.heartbeat_at = _utcnow()
            await db.commit()

    async def update_progress(
        self,
        question_id: str,
        db: AsyncSession,
        completed: int = None,
        failed: int = None,
        batches_run: int = None,
        current_batch: list = None,
    ) -> dict:
        """Update session progress counters."""
        session = await db.scalar(
            select(ResearchSessionState).where(
                ResearchSessionState.question_id == question_id
            )
        )
        if not session:
            return {}

        if completed is not None:
            session.completed_tasks = completed
        if failed is not None:
            session.failed_tasks = failed
        if batches_run is not None:
            session.batches_run = batches_run
        if current_batch is not None:
            session.current_batch = current_batch

        session.heartbeat_at = _utcnow()
        session.updated_at = _utcnow()
        await db.commit()
        return self._session_to_dict(session)

    async def complete_session(
        self,
        question_id: str,
        db: AsyncSession,
        error: str = None,
    ) -> dict:
        """Mark a session as completed or failed."""
        session = await db.scalar(
            select(ResearchSessionState).where(
                ResearchSessionState.question_id == question_id
            )
        )
        if not session:
            return {}

        now = _utcnow()
        if error:
            session.status = "failed"
            session.last_error = error[:2000]
        else:
            session.status = "completed"
        session.completed_at = now
        session.heartbeat_at = now
        await db.commit()
        return self._session_to_dict(session)

    async def pause_session(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Mark a session as paused."""
        session = await db.scalar(
            select(ResearchSessionState).where(
                ResearchSessionState.question_id == question_id
            )
        )
        if not session:
            return {}

        session.status = "paused"
        session.paused_at = _utcnow()
        await db.commit()
        return self._session_to_dict(session)

    async def get_session_state(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Get current session state."""
        session = await db.scalar(
            select(ResearchSessionState).where(
                ResearchSessionState.question_id == question_id
            )
        )
        if not session:
            return {"status": "idle", "question_id": question_id}
        return self._session_to_dict(session)

    # ── Write-Ahead Log ───────────────────────────────────────────────────────

    async def plan_task_execution(
        self,
        task_id: str,
        session_id: str,
        db: AsyncSession,
        timeout_seconds: int = 300,
    ) -> dict:
        """
        Record intent to execute a task BEFORE doing the work.
        This is the write-ahead log entry.
        """
        # Check idempotency — don't plan the same task twice in the same session
        existing = await db.scalar(
            select(TaskExecutionLog).where(
                TaskExecutionLog.task_id == task_id,
                TaskExecutionLog.session_id == session_id,
                TaskExecutionLog.status.in_(["planned", "executing"]),
            )
        )
        if existing:
            return self._exec_log_to_dict(existing)

        # Get attempt number
        attempt = await db.scalar(
            select(func.coalesce(func.max(TaskExecutionLog.attempt_number), 0)).where(
                TaskExecutionLog.task_id == task_id,
            )
        )

        log = TaskExecutionLog(
            id=str(uuid.uuid4()),
            task_id=task_id,
            session_id=session_id,
            status="planned",
            planned_at=_utcnow(),
            idempotency_key=f"{task_id}:attempt_{attempt + 1}",
            attempt_number=(attempt or 0) + 1,
            timeout_seconds=timeout_seconds,
            timeout_at=_utcnow() + timedelta(seconds=timeout_seconds),
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)

        return self._exec_log_to_dict(log)

    async def start_task_execution(
        self,
        log_id: str,
        agent_id: str,
        db: AsyncSession,
    ) -> dict:
        """Mark task execution as started (called right before actual work)."""
        log = await db.get(TaskExecutionLog, log_id)
        if not log:
            raise ValueError(f"Execution log {log_id} not found")

        log.status = "executing"
        log.started_at = _utcnow()
        log.agent_id = agent_id
        await db.commit()
        return self._exec_log_to_dict(log)

    async def complete_task_execution(
        self,
        log_id: str,
        db: AsyncSession,
        result_summary: str = None,
    ) -> dict:
        """Mark task execution as completed."""
        log = await db.get(TaskExecutionLog, log_id)
        if not log:
            raise ValueError(f"Execution log {log_id} not found")

        log.status = "completed"
        log.completed_at = _utcnow()
        log.result_summary = (result_summary or "")[:2000]
        await db.commit()
        return self._exec_log_to_dict(log)

    async def fail_task_execution(
        self, log_id: str, db: AsyncSession, error: str = None,
    ) -> dict:
        log = await db.get(TaskExecutionLog, log_id)
        if not log:
            raise ValueError(f"Execution log {log_id} not found")
        log.status = "failed"
        log.completed_at = _utcnow()
        log.error = (error or "")[:2000]
        await db.commit()
        return self._exec_log_to_dict(log)

    # ── Crash Recovery ──

    async def recover_orphaned_sessions(
        self,
        db: AsyncSession,
        stale_threshold_seconds: int = 120,
    ) -> dict:
        """
        Find and recover orphaned sessions and their executing tasks on startup or manual recovery.
        A session is orphaned if it is marked as 'running' but has not received a heartbeat within stale_threshold_seconds.
        """
        now = _utcnow()
        cutoff = now - timedelta(seconds=stale_threshold_seconds)

        # 1. Identify running sessions with stale or missing heartbeat
        stmt = select(ResearchSessionState).where(
            ResearchSessionState.status == "running",
            or_(
                ResearchSessionState.heartbeat_at.is_(None),
                ResearchSessionState.heartbeat_at < cutoff,
            )
        )
        res = await db.scalars(stmt)
        orphaned_sessions = list(res.all())

        orphaned_session_ids = [s.id for s in orphaned_sessions]
        orphaned_tasks_count = 0

        if orphaned_session_ids:
            # 2. Mark planned or executing tasks under these sessions as orphaned
            exec_logs_stmt = select(TaskExecutionLog).where(
                TaskExecutionLog.session_id.in_(orphaned_session_ids),
                TaskExecutionLog.status.in_(["planned", "executing"]),
            )
            exec_res = await db.scalars(exec_logs_stmt)
            exec_logs = list(exec_res.all())
            orphaned_tasks_count = len(exec_logs)

            for log in exec_logs:
                log.status = "orphaned"
                log.error = "Session abandoned or crashed"
                log.completed_at = now

            for session in orphaned_sessions:
                session.status = "failed"
                session.last_error = "Recovered after crash/disconnect (heartbeat timed out)"
                session.completed_at = now

            await db.commit()

        return {
            "orphaned_sessions": len(orphaned_sessions),
            "orphaned_tasks": orphaned_tasks_count,
            "recovered_at": now.isoformat(),
        }

    async def enforce_timeouts(
        self,
        db: AsyncSession,
    ) -> dict:
        """
        Find executing tasks that have exceeded their timeout_at and mark them failed.
        """
        now = _utcnow()
        stmt = select(TaskExecutionLog).where(
            TaskExecutionLog.status == "executing",
            TaskExecutionLog.timeout_at.is_not(None),
            TaskExecutionLog.timeout_at < now,
        )
        res = await db.scalars(stmt)
        timed_out_logs = list(res.all())

        for log in timed_out_logs:
            log.status = "failed"
            log.error = f"Execution timed out after {log.timeout_seconds}s"
            log.completed_at = now

        if timed_out_logs:
            await db.commit()

        return {
            "timed_out_tasks": len(timed_out_logs),
            "checked_at": now.isoformat(),
        }

    # ── Serializers ──

    def _session_to_dict(self, s: ResearchSessionState) -> dict:
        return {
            "id": s.id,
            "question_id": s.question_id,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "paused_at": s.paused_at.isoformat() if s.paused_at else None,
            "total_tasks": s.total_tasks,
            "completed_tasks": s.completed_tasks,
            "failed_tasks": s.failed_tasks,
            "batches_run": s.batches_run,
            "current_batch": s.current_batch or [],
            "last_error": s.last_error,
            "retry_count": s.retry_count,
            "max_retries": s.max_retries,
            "heartbeat_at": s.heartbeat_at.isoformat() if s.heartbeat_at else None,
            "heartbeat_interval": s.heartbeat_interval,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }

    def _exec_log_to_dict(self, log: TaskExecutionLog) -> dict:
        return {
            "id": log.id,
            "task_id": log.task_id,
            "session_id": log.session_id,
            "agent_id": log.agent_id,
            "status": log.status,
            "planned_at": log.planned_at.isoformat() if log.planned_at else None,
            "started_at": log.started_at.isoformat() if log.started_at else None,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            "result_summary": log.result_summary,
            "error": log.error,
            "idempotency_key": log.idempotency_key,
            "attempt_number": log.attempt_number,
            "timeout_seconds": log.timeout_seconds,
            "timeout_at": log.timeout_at.isoformat() if log.timeout_at else None,
        }


durability = DurabilityService()
__all__ = ["DurabilityService", "durability"]
