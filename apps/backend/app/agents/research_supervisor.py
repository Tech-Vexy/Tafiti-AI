"""
Research Supervisor Agent
========================
Top-level orchestrator that manages the research intelligence pipeline.

Agent Hierarchy:
    Research Supervisor (this file)
    ├── Discovery Agent  → searches APIs, finds sources
    ├── Evidence Agent   → extracts passages, links evidence to claims
    ├── Reasoning Agent  → extracts claims, synthesizes, suggests next steps
    └── Critic Agent     → reviews quality of findings (existing agent)

The Supervisor:
- Creates and manages ResearchTask DAGs
- Dispatches tasks to specialized agents based on task_type
- Tracks progress and handles failures
- Produces a final synthesis when all tasks complete
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    ResearchQuestion, ResearchTask, Source, Claim,
)

logger = get_logger("research_supervisor")


# Task type → agent mapping
TASK_AGENT_MAP = {
    "search": "_run_discovery_task",
    "literature_review": "_run_discovery_task",
    "contradiction_search": "_run_discovery_task",
    "dataset_analysis": "_run_discovery_task",
    "evidence_extraction": "_run_evidence_task",
    "claim_extraction": "_run_reasoning_task",
    "synthesis": "_run_synthesis_task",
}


class ResearchSupervisor:
    """
    Orchestrates the full research intelligence pipeline:
    Discovery → Evidence → Reasoning → Critique → Synthesis.
    """

    async def start_research(
        self,
        question_id: str,
        db: AsyncSession,
        task_plan: Optional[list[dict]] = None,
    ) -> dict:
        """
        Start a research investigation for the given question.

        If no task_plan is provided, generates a default plan:
        1. Search across APIs
        2. Extract claims from sources
        3. Link evidence to claims
        4. Detect contradictions
        5. Synthesize findings
        """
        question = await db.get(ResearchQuestion, question_id)
        if not question:
            raise ValueError(f"Research question {question_id} not found")

        if not task_plan:
            task_plan = self._default_plan()

        # Create task records
        tasks = []
        for task_def in task_plan:
            task = ResearchTask(
                question_id=question_id,
                task_type=task_def["type"],
                description=task_def.get("description", task_def["type"]),
                depends_on=task_def.get("depends_on", []),
                status="pending",
            )
            db.add(task)
            tasks.append(task)

        await db.commit()

        # Refresh to get IDs
        for task in tasks:
            await db.refresh(task)

        logger.info(
            f"research_started question_id={question_id} tasks={len(tasks)}"
        )

        return {
            "question_id": question_id,
            "tasks_created": len(tasks),
            "task_ids": [t.id for t in tasks],
        }

    async def execute_task(
        self,
        task_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Execute a single research task by dispatching to the appropriate agent.
        Updates task status and returns results.
        """
        task = await db.get(ResearchTask, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        # Check if dependencies are met
        if task.depends_on:
            for dep_id in task.depends_on:
                dep_task = await db.get(ResearchTask, dep_id)
                if dep_task and dep_task.status != "completed":
                    return {
                        "task_id": task_id,
                        "status": "blocked",
                        "message": f"Dependency {dep_id} not yet completed",
                    }

        # Update status to running
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        await db.commit()

        # Dispatch to appropriate agent
        agent_method_name = TASK_AGENT_MAP.get(task.task_type)
        if not agent_method_name:
            task.status = "failed"
            task.error = f"Unknown task type: {task.task_type}"
            await db.commit()
            return {"task_id": task_id, "status": "failed", "error": task.error}

        try:
            agent_method = getattr(self, agent_method_name)
            result = await agent_method(task, db)

            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            task.result_summary = str(result)[:1000]
            await db.commit()

            logger.info(f"task_completed task_id={task_id} type={task.task_type}")

            return {"task_id": task_id, "status": "completed", **result}

        except Exception as e:
            task.status = "failed"
            task.error = str(e)[:500]
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()

            logger.error(f"task_failed task_id={task_id} error={e}")

            return {"task_id": task_id, "status": "failed", "error": str(e)}

    async def execute_all_ready_tasks(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> list[dict]:
        """
        Find and execute all tasks whose dependencies are met.
        Returns results of all executed tasks.
        """
        stmt = (
            select(ResearchTask)
            .where(
                ResearchTask.question_id == question_id,
                ResearchTask.status == "pending",
            )
            .order_by(ResearchTask.created_at)
        )
        result = await db.execute(stmt)
        pending_tasks = result.scalars().all()

        results = []
        for task in pending_tasks:
            # Check if dependencies are met
            deps_met = True
            if task.depends_on:
                for dep_id in task.depends_on:
                    dep_task = await db.get(ResearchTask, dep_id)
                    if dep_task and dep_task.status != "completed":
                        deps_met = False
                        break

            if deps_met:
                task_result = await self.execute_task(task.id, db)
                results.append(task_result)

        return results

    async def get_research_progress(
        self,
        question_id: str,
        db: AsyncSession,
    ) -> dict:
        """Get a summary of research progress."""
        question = await db.get(ResearchQuestion, question_id)
        if not question:
            raise ValueError(f"Research question {question_id} not found")

        stmt = (
            select(ResearchTask)
            .where(ResearchTask.question_id == question_id)
            .order_by(ResearchTask.created_at)
        )
        result = await db.execute(stmt)
        tasks = result.scalars().all()

        source_stmt = select(Source).join(ResearchTask).where(
            ResearchTask.question_id == question_id
        )
        source_result = await db.execute(source_stmt)
        sources = source_result.scalars().all()

        claim_stmt = select(Claim).where(Claim.question_id == question_id)
        claim_result = await db.execute(claim_stmt)
        claims = claim_result.scalars().all()

        return {
            "question": {
                "id": question.id,
                "question": question.question,
                "status": question.status,
            },
            "tasks": {
                "total": len(tasks),
                "completed": sum(1 for t in tasks if t.status == "completed"),
                "running": sum(1 for t in tasks if t.status == "running"),
                "failed": sum(1 for t in tasks if t.status == "failed"),
                "pending": sum(1 for t in tasks if t.status == "pending"),
            },
            "sources": len(sources),
            "claims": {
                "total": len(claims),
                "verified": sum(1 for c in claims if c.verification_status == "verified"),
                "disputed": sum(1 for c in claims if c.verification_status == "disputed"),
                "unverified": sum(1 for c in claims if c.verification_status == "unverified"),
            },
        }

    def _default_plan(self) -> list[dict]:
        """Generate a default research task plan."""
        return [
            {
                "type": "search",
                "description": "Search academic databases for relevant papers",
                "depends_on": [],
            },
            {
                "type": "literature_review",
                "description": "Review abstracts and extract key findings",
                "depends_on": [],
            },
            {
                "type": "contradiction_search",
                "description": "Search for counter-evidence and contradictions",
                "depends_on": [],
            },
            {
                "type": "claim_extraction",
                "description": "Extract verifiable claims from discovered sources",
                "depends_on": [],  # runs after search tasks complete
            },
            {
                "type": "evidence_extraction",
                "description": "Link evidence to extracted claims",
                "depends_on": [],
            },
            {
                "type": "synthesis",
                "description": "Synthesize findings into a comprehensive report",
                "depends_on": [],
            },
        ]

    # ── Agent Dispatchers ──────────────────────────────────────────────────────

    async def _run_discovery_task(self, task: ResearchTask, db: AsyncSession) -> dict:
        """Dispatch to the Discovery Engine."""
        from app.services.discovery_engine import discovery_engine

        question = await db.get(ResearchQuestion, task.question_id)
        if not question:
            return {"error": "Question not found"}

        results = await discovery_engine.search_all(
            query=question.question,
            task_id=task.id,
            db=db,
            max_results=20,
        )

        return {
            "sources_found": len(results),
            "backend": "multi",
        }

    async def _run_evidence_task(self, task: ResearchTask, db: AsyncSession) -> dict:
        """Dispatch to the Evidence Engine."""
        from app.services.evidence_engine import evidence_engine

        # Find all claims for this question
        stmt = select(Claim).where(Claim.question_id == task.question_id)
        result = await db.execute(stmt)
        claims = result.scalars().all()

        total_evidence = 0
        for claim in claims:
            ev_result = await evidence_engine.extract_evidence_for_claim(
                claim.id, db
            )
            total_evidence += ev_result.get("evidence_created", 0)

        return {
            "claims_processed": len(claims),
            "evidence_extracted": total_evidence,
        }

    async def _run_reasoning_task(self, task: ResearchTask, db: AsyncSession) -> dict:
        """Dispatch to the Reasoning Engine for claim extraction."""
        from app.services.reasoning_engine import reasoning_engine

        claims = await reasoning_engine.extract_claims_from_sources(
            question_id=task.question_id,
            task_id=task.id,
            db=db,
        )

        return {
            "claims_extracted": len(claims),
        }

    async def _run_synthesis_task(self, task: ResearchTask, db: AsyncSession) -> dict:
        """Dispatch to the Reasoning Engine for synthesis."""
        from app.services.reasoning_engine import reasoning_engine

        synthesis = await reasoning_engine.synthesize_findings(
            question_id=task.question_id,
            db=db,
        )

        suggestions = await reasoning_engine.suggest_next_steps(
            question_id=task.question_id,
            db=db,
        )

        return {
            "synthesis_length": len(synthesis),
            "next_steps": suggestions,
        }


# Singleton
research_supervisor = ResearchSupervisor()
