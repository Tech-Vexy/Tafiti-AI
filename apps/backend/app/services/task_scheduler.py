"""
Task DAG Scheduler
==================
Resolves task dependency graphs and manages execution order.

Tasks have a `depends_on` field (list of task IDs). This service:
1. Registers tasks in the schedule when created
2. Resolves which tasks are unblocked when dependencies complete
3. Handles failure cascading (block downstream, optionally retry)
4. Provides the ready queue for background execution
"""

from app.core.timeutil import utcnow

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import (
    ResearchTaskSchedule, ResearchTask,
)

logger = get_logger("task_scheduler")


class TaskScheduler:
    """Manages DAG dependency resolution for research tasks."""

    async def register_tasks(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Register all tasks for a question into the schedule.
        Tasks with no dependencies are immediately marked ready.
        """
        tasks = (
            await db.execute(
                select(ResearchTask).where(ResearchTask.question_id == question_id)
            )
        ).scalars().all()

        registered = 0
        ready = 0

        for task in tasks:
            # Check if already registered
            existing = await db.scalar(
                select(ResearchTaskSchedule).where(
                    ResearchTaskSchedule.task_id == task.id
                )
            )
            if existing:
                continue

            deps = task.depends_on or []
            is_ready = len(deps) == 0

            schedule = ResearchTaskSchedule(
                question_id=question_id,
                task_id=task.id,
                is_ready=is_ready,
                is_blocked=False,
                blocked_by=[],
                retry_count=0,
                max_retries=3,
                scheduled_at=utcnow() if is_ready else None,
                timeout_seconds=300,
            )
            db.add(schedule)
            registered += 1
            if is_ready:
                ready += 1

        await db.commit()

        logger.info(
            f"tasks_registered question={question_id} "
            f"total={registered} ready={ready}"
        )

        return {"registered": registered, "ready": ready, "total_tasks": len(tasks)}

    async def get_ready_tasks(
        self,
        question_id: str,
        db: AsyncSession,
        limit: int = 5,
    ) -> list[dict]:
        """Get tasks ready for execution (all deps satisfied)."""
        stmt = (
            select(ResearchTaskSchedule, ResearchTask)
            .join(ResearchTask, ResearchTaskSchedule.task_id == ResearchTask.id)
            .where(
                ResearchTaskSchedule.question_id == question_id,
                ResearchTaskSchedule.is_ready,
                ResearchTask.status.in_(["pending"]),
            )
            .order_by(ResearchTaskSchedule.scheduled_at)
            .limit(limit)
        )
        results = (await db.execute(stmt)).all()

        return [
            {
                "schedule_id": schedule.id,
                "task_id": task.id,
                "task_type": task.task_type,
                "description": task.description,
                "retry_count": schedule.retry_count,
            }
            for schedule, task in results
        ]

    async def on_task_complete(
        self,
        task_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Called when a task completes. Unblocks downstream tasks.
        Returns newly unblocked tasks.
        """
        schedule = await db.scalar(
            select(ResearchTaskSchedule).where(
                ResearchTaskSchedule.task_id == task_id
            )
        )
        if not schedule:
            return {"unblocked": []}

        schedule.is_ready = False
        schedule.completed_at = utcnow()

        # Find all schedules where this task is a dependency
        question_id = schedule.question_id
        all_schedules = (
            await db.execute(
                select(ResearchTaskSchedule).where(
                    ResearchTaskSchedule.question_id == question_id
                )
            )
        ).scalars().all()

        newly_unblocked = []
        for other in all_schedules:
            if not other.is_ready and not other.is_blocked:
                task = await db.get(ResearchTask, other.task_id)
                if not task:
                    continue
                deps = task.depends_on or []
                if task_id in deps:
                    # Check if all other deps are also completed
                    remaining = []
                    for dep_id in deps:
                        if dep_id == task_id:
                            continue
                        dep_task = await db.get(ResearchTask, dep_id)
                        if dep_task and dep_task.status != "completed":
                            remaining.append(dep_id)

                    if not remaining:
                        # All dependencies satisfied — unblock
                        other.is_ready = True
                        other.scheduled_at = utcnow()
                        other.blocked_by = []
                        newly_unblocked.append({
                            "task_id": other.task_id,
                            "description": task.description if task else "",
                        })

        await db.commit()

        logger.info(
            f"task_completed task={task_id} unblocked={len(newly_unblocked)}"
        )

        return {"unblocked": newly_unblocked}

    async def on_task_failed(
        self,
        task_id: str,
        db: AsyncSession,
        auto_retry: bool = True,
    ) -> dict:
        """
        Called when a task fails. Handles retries and blocking downstream.
        """
        schedule = await db.scalar(
            select(ResearchTaskSchedule).where(
                ResearchTaskSchedule.task_id == task_id
            )
        )
        if not schedule:
            return {"action": "none"}

        schedule.retry_count = (schedule.retry_count or 0) + 1

        if auto_retry and schedule.retry_count < (schedule.max_retries or 3):
            # Reset task to pending for retry
            task = await db.get(ResearchTask, task_id)
            if task:
                task.status = "pending"
                task.started_at = None
                task.completed_at = None

            schedule.is_ready = True
            schedule.scheduled_at = utcnow()

            await db.commit()
            logger.info(
                f"task_retry task={task_id} attempt={schedule.retry_count}"
            )
            return {"action": "retry", "attempt": schedule.retry_count}

        # Max retries exceeded — block downstream tasks
        question_id = schedule.question_id
        all_schedules = (
            await db.execute(
                select(ResearchTaskSchedule).where(
                    ResearchTaskSchedule.question_id == question_id
                )
            )
        ).scalars().all()

        blocked_count = 0
        for other in all_schedules:
            task = await db.get(ResearchTask, other.task_id)
            if not task:
                continue
            deps = task.depends_on or []
            if task_id in deps and not other.is_blocked:
                other.is_blocked = True
                other.blocked_by = deps
                other.is_ready = False
                blocked_count += 1

        await db.commit()

        logger.info(
            f"task_failed_permanently task={task_id} "
            f"retries={schedule.retry_count} blocked_downstream={blocked_count}"
        )

        return {
            "action": "blocked",
            "retry_count": schedule.retry_count,
            "blocked_downstream": blocked_count,
        }

    async def on_task_started(self, task_id, db):
        schedule = await db.scalar(
            select(ResearchTaskSchedule).where(ResearchTaskSchedule.task_id == task_id)
        )
        if schedule:
            schedule.is_ready = False
            schedule.started_at = utcnow()
            await db.commit()

    async def get_session_status(self, question_id, db):
        schedules = (await db.execute(
            select(ResearchTaskSchedule).where(ResearchTaskSchedule.question_id == question_id)
        )).scalars().all()
        total = len(schedules)
        ready = sum(1 for s in schedules if s.is_ready)
        blocked = sum(1 for s in schedules if s.is_blocked)
        running = sum(1 for s in schedules if s.started_at and not s.completed_at)
        completed = sum(1 for s in schedules if s.completed_at)
        tasks = (await db.execute(
            select(ResearchTask).where(ResearchTask.question_id == question_id)
        )).scalars().all()
        task_status_counts = {}
        for t in tasks:
            task_status_counts[t.status] = task_status_counts.get(t.status, 0) + 1
        return {
            "total_tasks": total, "ready_tasks": ready, "blocked_tasks": blocked,
            "running_tasks": running, "completed_tasks": completed,
            "task_statuses": task_status_counts,
        }


task_scheduler = TaskScheduler()
