"""
Research Runner
===============
Background execution engine for research sessions.

Durability guarantees:
- All session state persisted to database (no in-memory dicts)
- Write-ahead logging for every task execution
- Heartbeat updates prevent false orphan detection
- Progress counters updated after each task
- Auto-checkpointing every N tasks
- Crash recovery finds and resumes orphaned work
"""

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import ResearchCheckpoint

logger = get_logger("research_runner")


class ResearchRunner:
    """Manages background research execution with durable state."""

    async def is_running(self, question_id: str, db: AsyncSession = None) -> bool:
        """Check if a research session is currently running."""
        if db:
            from app.services.durability import durability
            state = await durability.get_session_state(question_id, db)
            return state.get("status") == "running"
        return False

    async def start_research(
        self,
        question_id: str,
        db: AsyncSession,
        max_batches: int = 10,
        auto_checkpoint_interval: int = 5,
    ) -> dict:
        """Start a background research session with full durability."""
        from app.services.durability import durability

        # Check if already running (via durable state)
        existing = await durability.get_session_state(question_id, db)
        if existing.get("status") == "running":
            return {"status": "already_running", "session": existing}

        # Create or get durable session
        session = await durability.start_session(question_id, db)
        session["is_running"] = True

        try:
            from app.services.task_scheduler import task_scheduler

            # Register tasks in scheduler
            reg = await task_scheduler.register_tasks(question_id, db)
            session["total_tasks"] = reg["total_tasks"]
            session["ready_tasks"] = reg["ready"]

            # Update durable progress with total count
            await durability.update_progress(
                question_id, db,
                completed=0, failed=0, batches_run=0,
            )

            # Run batches
            for batch_num in range(max_batches):
                # Heartbeat before each batch
                await durability.update_heartbeat(question_id, db)

                ready = await task_scheduler.get_ready_tasks(question_id, db, limit=5)
                if not ready:
                    break

                batch_task_ids = [t["task_id"] for t in ready]
                await durability.update_progress(
                    question_id, db,
                    current_batch=batch_task_ids,
                )

                completed_in_batch = 0
                failed_in_batch = 0

                for task_info in ready:
                    try:
                        await self._execute_single_task(
                            question_id, task_info["task_id"], db
                        )
                        completed_in_batch += 1
                    except Exception as e:
                        logger.error(f"task_execution_error task={task_info['task_id']} error={e}")
                        failed_in_batch += 1

                        from app.services.task_scheduler import task_scheduler
                        await task_scheduler.on_task_failed(task_info["task_id"], db)

                # Update durable progress after batch
                session["tasks_completed"] = session.get("tasks_completed", 0) + completed_in_batch
                session["tasks_failed"] = session.get("tasks_failed", 0) + failed_in_batch
                session["batches_run"] = batch_num + 1

                await durability.update_progress(
                    question_id, db,
                    completed=session["tasks_completed"],
                    failed=session["tasks_failed"],
                    batches_run=batch_num + 1,
                    current_batch=[],
                )

                # Auto-checkpoint
                if session["tasks_completed"] > 0 and session["tasks_completed"] % auto_checkpoint_interval == 0:
                    from app.services.research_checkpoint import checkpoint_service
                    cp = await checkpoint_service.create_checkpoint(
                        question_id, db, trigger="auto",
                        summary=f"Auto-checkpoint after {session['tasks_completed']} tasks"
                    )
                    # Store checkpoint reference in session
                    session_state = await durability.get_session_state(question_id, db)
                    from app.models.database import ResearchSessionState
                    ss = await db.scalar(
                        select(ResearchSessionState).where(
                            ResearchSessionState.question_id == question_id
                        )
                    )
                    if ss:
                        ss.last_checkpoint_id = cp.get("id")
                        await db.commit()

            # Mark session completed
            await durability.complete_session(question_id, db)
            session["is_running"] = False

        except Exception as e:
            logger.error(f"research_session_error question={question_id} error={e}")
            await durability.complete_session(question_id, db, error=str(e))
            session["is_running"] = False
            session["error"] = str(e)

        return session

    async def _execute_single_task(
        self,
        question_id: str,
        task_id: str,
        db: AsyncSession,
    ) -> dict:
        """Execute a single task with write-ahead logging."""
        from app.services.durability import durability
        from app.services.research_state_machine import state_machine
        from app.services.task_scheduler import task_scheduler

        # Get session for WAL linkage
        session_state = await durability.get_session_state(question_id, db)
        session_id = session_state.get("id")

        # WAL: Plan the execution BEFORE doing any work
        exec_log = await durability.plan_task_execution(
            task_id=task_id,
            session_id=session_id,
            db=db,
            timeout_seconds=300,
        )

        # Find or create an agent
        from app.models.database import ResearchTask, Agent, AgentTeam
        task = await db.get(ResearchTask, task_id)
        if not task:
            await durability.fail_task_execution(exec_log["id"], db, error="Task not found")
            raise ValueError(f"Task {task_id} not found")

        team = (await db.execute(
            select(AgentTeam).where(AgentTeam.question_id == question_id)
        )).scalars().first()

        if not team:
            await durability.fail_task_execution(exec_log["id"], db, error="No team found")
            raise ValueError(f"No team found for question {question_id}")

        agent = (await db.execute(
            select(Agent).where(
                Agent.team_id == team.id,
                Agent.status.in_(["active", "spawned"]),
            ).limit(1)
        )).scalars().first()

        if not agent:
            from app.services.agent_orchestrator import agent_orchestrator
            agent = await agent_orchestrator.spawn_agent(
                team_id=team.id,
                role="researcher",
                description=f"Auto-assigned for: {task.description[:100]}",
                db=db,
            )

        # WAL: Mark execution as started
        await durability.start_task_execution(exec_log["id"], agent.id, db)

        # Transition task to running
        await state_machine.transition(
            "task", task_id, "running", db,
            reason="Scheduler dispatched task",
            actor="scheduler",
        )
        await task_scheduler.on_task_started(task_id, db)

        # Heartbeat before expensive work
        await durability.update_heartbeat(question_id, db)

        try:
            # Execute the task
            from app.services.agent_execution import agent_execution_engine
            result = await agent_execution_engine.execute_agent_task(
                agent.id, task_id, db
            )

            # Store findings in agent memory
            from app.services.agent_memory import agent_memory
            if result:
                summary = json.dumps(result)[:500]
                await agent_memory.remember(
                    agent_id=agent.id,
                    memory_type="finding",
                    content=f"Completed task: {task.description[:100]}. Result: {summary}",
                    db=db,
                    confidence=80,
                    source_task_id=task_id,
                )

            # Complete the task via orchestrator
            from app.services.agent_orchestrator import agent_orchestrator
            result_summary = json.dumps(result)[:2000] if isinstance(result, dict) else str(result)[:2000]
            await agent_orchestrator.complete_task(agent.id, db, result_summary=result_summary)

            # WAL: Mark execution completed
            await durability.complete_task_execution(exec_log["id"], db, result_summary=result_summary)

            # Transition task to completed
            await state_machine.transition(
                "task", task_id, "completed", db,
                reason="Task completed successfully",
                actor=agent.id,
            )

            # Run adaptive evaluation
            from app.services.adaptive_engine import adaptive_engine
            try:
                await adaptive_engine.evaluate_after_task(
                    agent.id, task_id, result, db
                )
            except Exception as e:
                logger.warning(f"adaptive_evaluation_skipped task={task_id} error={e}")

            # Unblock downstream tasks
            await task_scheduler.on_task_complete(task_id, db)

            # Heartbeat after completion
            await durability.update_heartbeat(question_id, db)

            return result

        except Exception as e:
            # WAL: Mark execution failed
            await durability.fail_task_execution(exec_log["id"], db, error=str(e))
            raise

    async def pause_research(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Pause a running research session with durable state."""
        from app.services.durability import durability

        state = await durability.get_session_state(question_id, db)
        if state.get("status") != "running":
            return {"status": "not_running"}

        # Pause durable session
        await durability.pause_session(question_id, db)

        # Create a checkpoint
        from app.services.research_checkpoint import checkpoint_service
        cp = await checkpoint_service.create_checkpoint(
            question_id, db, trigger="pause",
            summary=f"Paused after {state.get('completed_tasks', 0)} tasks"
        )

        # Transition question to paused
        from app.services.research_state_machine import state_machine
        try:
            await state_machine.transition(
                "question", question_id, "paused", db,
                reason="User paused research",
                actor="user",
            )
        except Exception:
            pass

        return {"status": "paused", "checkpoint": cp}

    async def resume_research(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Resume a paused research session."""
        from app.services.research_state_machine import state_machine
        try:
            await state_machine.transition(
                "question", question_id, "active", db,
                reason="User resumed research",
                actor="user",
            )
        except Exception:
            pass

        return await self.start_research(question_id, db)

    async def get_session_status(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Get the current status of a research session from durable state."""
        from app.services.durability import durability
        session = await durability.get_session_state(question_id, db)
        is_running = session.get("status") == "running"

        from app.services.task_scheduler import task_scheduler
        sched_status = await task_scheduler.get_session_status(question_id, db)

        # Get checkpoint count
        cp_count = await db.scalar(
            select(func.count()).where(
                ResearchCheckpoint.question_id == question_id
            )
        ) or 0

        # Get team info
        from app.models.database import AgentTeam, Agent
        team = (await db.execute(
            select(AgentTeam).where(AgentTeam.question_id == question_id)
        )).scalars().first()

        agent_count = 0
        active_agents = 0
        if team:
            agent_count = await db.scalar(
                select(func.count()).where(Agent.team_id == team.id)
            ) or 0
            active_agents = await db.scalar(
                select(func.count()).where(
                    Agent.team_id == team.id,
                    Agent.status.in_(["active", "working", "spawned"])
                )
            ) or 0

        return {
            "question_id": question_id,
            "is_running": is_running,
            "status": session.get("status", "idle"),
            "batches_run": session.get("batches_run", 0),
            "tasks_completed": session.get("completed_tasks", 0),
            "tasks_failed": session.get("failed_tasks", 0),
            "error": session.get("last_error"),
            "started_at": session.get("started_at"),
            "completed_at": session.get("completed_at"),
            "heartbeat_at": session.get("heartbeat_at"),
            **sched_status,
            "checkpoints": cp_count,
            "agent_count": agent_count,
            "active_agents": active_agents,
        }


research_runner = ResearchRunner()
