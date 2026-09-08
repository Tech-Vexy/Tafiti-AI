"""
Agent Execution Engine
======================
Connects the AgentOrchestrator to actual LLM execution.
When an agent is assigned a task, this engine performs the actual research work:
- Researcher agents search academic databases
- Extractor agents extract claims from papers
- Critic agents review findings
- Synthesist agents generate reports
- Scout agents explore tangential topics

Each agent role has its own execution strategy that leverages
existing services (discovery_engine, evidence_engine, reasoning_engine)
and direct LLM calls.
"""

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    AgentTeam, Agent, AgentMessage, ResearchQuestion, ResearchTask,
    Source, Passage, Claim,
)

logger = get_logger("agent_execution")


class AgentExecutionEngine:
    """
    Executes research tasks on behalf of agents.
    Each role has a specialized execution strategy.
    """

    async def execute_agent_task(
        self,
        agent_id: str,
        task_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Main entry point: execute a task for an agent.
        Dispatches to the appropriate role-specific executor.
        """
        agent = await db.get(Agent, agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        task = await db.get(ResearchTask, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        question = await db.get(ResearchQuestion, task.question_id)
        if not question:
            raise ValueError(f"Research question {task.question_id} not found")

        # Dispatch based on agent role
        executors = {
            "lead": self._execute_lead,
            "researcher": self._execute_researcher,
            "critic": self._execute_critic,
            "synthesist": self._execute_synthesist,
            "extractor": self._execute_extractor,
            "verifier": self._execute_verifier,
            "scout": self._execute_scout,
        }

        executor = executors.get(agent.role, self._execute_researcher)
        result = await executor(agent, task, question, db)

        logger.info(
            f"agent_task_executed agent_id={agent_id} role={agent.role} "
            f"task_type={task.task_type} result_keys={list(result.keys())}"
        )
        return result

    # ── Researcher Executor ────────────────────────────────────────────────
    async def _execute_researcher(self, agent, task, question, db):
        """Researcher: searches academic databases and discovers sources."""
        from app.services.discovery_engine import discovery_engine

        results = await discovery_engine.search_all(
            query=question.question,
            task_id=task.id,
            db=db,
            max_results=20,
        )

        source_count = len(results)

        # Broadcast finding
        from app.services.agent_orchestrator import agent_orchestrator
        await agent_orchestrator.send_message(
            team_id=agent.team_id,
            sender_agent_id=agent.id,
            message_type="finding",
            content=f"Found {source_count} sources for: {question.question[:100]}",
            metadata={"source_count": source_count, "task_id": task.id},
            db=db,
        )

        return {"sources_found": source_count, "query": question.question[:200]}

    # ── Extractor Executor ─────────────────────────────────────────────────
    async def _execute_extractor(self, agent, task, question, db):
        """Extractor: pulls claims and evidence from discovered sources."""
        from app.services.reasoning_engine import reasoning_engine

        claims = await reasoning_engine.extract_claims_from_sources(
            question_id=task.question_id,
            task_id=task.id,
            db=db,
        )

        from app.services.agent_orchestrator import agent_orchestrator
        await agent_orchestrator.send_message(
            team_id=agent.team_id,
            sender_agent_id=agent.id,
            message_type="finding",
            content=f"Extracted {len(claims)} claims from sources",
            metadata={"claims_extracted": len(claims), "task_id": task.id},
            db=db,
        )

        return {"claims_extracted": len(claims)}

    # ── Critic Executor ────────────────────────────────────────────────────
    async def _execute_critic(self, agent, task, question, db):
        """Critic: reviews the quality and validity of findings."""
        # Get all claims for this question
        stmt = select(Claim).where(Claim.question_id == task.question_id)
        result = await db.execute(stmt)
        claims = result.scalars().all()

        if not claims:
            return {"critique": "No claims to review yet", "issues_found": 0}

        # Build context for critique
        claim_texts = []
        for c in claims[:10]:
            claim_texts.append(f"[{c.claim_type}] {c.text} (confidence: {c.confidence}%)")

        context = "\n".join(claim_texts)

        # Use LLM for critique
        critique = await self._llm_critique(question.question, context)

        from app.services.agent_orchestrator import agent_orchestrator
        await agent_orchestrator.send_message(
            team_id=agent.team_id,
            sender_agent_id=agent.id,
            message_type="critique",
            content=critique[:500],
            metadata={"claims_reviewed": len(claims), "task_id": task.id},
            db=db,
        )

        return {"critique": critique[:1000], "claims_reviewed": len(claims)}

    # ── Synthesist Executor ────────────────────────────────────────────────
    async def _execute_synthesist(self, agent, task, question, db):
        """Synthesist: integrates findings into a coherent report."""
        from app.services.reasoning_engine import reasoning_engine

        synthesis = await reasoning_engine.synthesize_findings(
            question_id=task.question_id,
            db=db,
        )

        suggestions = await reasoning_engine.suggest_next_steps(
            question_id=task.question_id,
            db=db,
        )

        from app.services.agent_orchestrator import agent_orchestrator
        await agent_orchestrator.send_message(
            team_id=agent.team_id,
            sender_agent_id=agent.id,
            message_type="synthesis",
            content=synthesis[:500],
            metadata={"synthesis_length": len(synthesis), "suggestions": len(suggestions)},
            db=db,
        )

        return {"synthesis_length": len(synthesis), "next_steps": suggestions}

    # ── Verifier Executor ──────────────────────────────────────────────────
    async def _execute_verifier(self, agent, task, question, db):
        """Verifier: cross-references claims against original sources."""
        stmt = select(Claim).where(Claim.question_id == task.question_id)
        result = await db.execute(stmt)
        claims = result.scalars().all()

        verified = 0
        disputed = 0
        for claim in claims:
            if claim.verification_status == "unverified":
                # Auto-verify based on evidence strength
                if claim.supporting_count >= 3 and claim.contradicting_count == 0:
                    claim.verification_status = "verified"
                    verified += 1
                elif claim.contradicting_count > claim.supporting_count:
                    claim.verification_status = "disputed"
                    disputed += 1

        await db.commit()

        from app.services.agent_orchestrator import agent_orchestrator
        await agent_orchestrator.send_message(
            team_id=agent.team_id,
            sender_agent_id=agent.id,
            message_type="finding",
            content=f"Verified {verified} claims, disputed {disputed} claims",
            metadata={"verified": verified, "disputed": disputed},
            db=db,
        )

        return {"verified": verified, "disputed": disputed, "total": len(claims)}

    # ── Scout Executor ─────────────────────────────────────────────────────
    async def _execute_scout(self, agent, task, question, db):
        """Scout: explores tangential topics and unexpected connections."""
        # Use LLM to suggest tangential research directions
        tangential = await self._llm_scout_directions(question.question)

        # Create follow-up search tasks for the most promising directions
        spawned = []
        from app.services.agent_orchestrator import agent_orchestrator
        for direction in tangential[:2]:  # Limit to 2 sub-directions
            child = await agent_orchestrator.spawn_subagent(
                parent_agent_id=agent.id,
                role="researcher",
                description=f"Scout follow-up: {direction}",
                db=db,
            )
            spawned.append(child.id)

        await agent_orchestrator.send_message(
            team_id=agent.team_id,
            sender_agent_id=agent.id,
            message_type="finding",
            content=f"Scouted {len(tangential)} tangential directions, spawned {len(spawned)} sub-agents",
            metadata={"directions": tangential, "spawned_agents": spawned},
            db=db,
        )

        return {"directions": tangential, "sub_agents_spawned": len(spawned)}

    # ── Lead Executor ──────────────────────────────────────────────────────
    async def _execute_lead(self, agent, task, question, db):
        """Lead: coordinates team, reviews findings, delegates work."""
        # Get all agents in the team
        stmt = select(Agent).where(Agent.team_id == agent.team_id)
        result = await db.execute(stmt)
        agents = result.scalars().all()

        # Get team progress
        task_stmt = select(ResearchTask).where(ResearchTask.question_id == task.question_id)
        task_result = await db.execute(task_stmt)
        tasks = task_result.scalars().all()

        completed = sum(1 for t in tasks if t.status == "completed")
        total = len(tasks)

        # Generate a team status report
        report = f"Team progress: {completed}/{total} tasks completed. "
        report += f"Active agents: {len([a for a in agents if a.status in ('active', 'working')])}. "

        # Suggest next actions
        from app.services.agent_orchestrator import agent_orchestrator
        suggestions = await self._llm_lead_suggestions(
            question.question, report, agents
        )

        await agent_orchestrator.send_message(
            team_id=agent.team_id,
            sender_agent_id=agent.id,
            message_type="status_update",
            content=report + " Suggestions: " + "; ".join(suggestions[:3]),
            metadata={"completed": completed, "total": total, "suggestions": suggestions},
            db=db,
        )

        return {"report": report, "suggestions": suggestions}

    # ── LLM Helpers ────────────────────────────────────────────────────────

    async def _llm_critique(self, question: str, claims_context: str) -> str:
        """Use LLM to critique research claims."""
        try:
            from app.core.model_router import model_router, TaskType
            prompt = (
                "You are a rigorous academic critic. Review these claims about the research "
                "question and identify: unsupported assertions, methodological weaknesses, "
                "logical fallacies, missing evidence, and areas needing further investigation.\n\n"
                "Research Question: " + question + "\n\nClaims:\n" + claims_context +
                "\n\nProvide a concise critique (max 500 words)."
            )
            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.CRITIQUE,
                temperature=0.3, max_tokens=1000,
            )
            return result["content"].strip()
        except Exception as e:
            logger.error("llm_critique_failed: " + str(e))
            return "Critique generation failed: " + str(e)

    async def _llm_scout_directions(self, question: str) -> list:
        """Use LLM to suggest tangential research directions."""
        try:
            from app.core.model_router import model_router, TaskType
            prompt = (
                "Given this research question, suggest 3 tangential or unexpected research "
                "directions that could yield surprising findings. Be creative but relevant.\n\n"
                "Question: " + question +
                "\n\nReturn a JSON array of strings."
            )
            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.SEARCH_PLANNING,
                temperature=0.5, max_tokens=500,
            )
            raw = result["content"].strip()
            if "```" in raw:
                raw = raw.split("```")[1].split("```")[0]
                if raw.startswith("json"): raw = raw[4:]
            directions = json.loads(raw)
            return directions if isinstance(directions, list) else []
        except Exception as e:
            logger.error("llm_scout_failed: " + str(e))
            return ["Explore recent publications on " + question[:50]]

    async def _llm_lead_suggestions(self, question: str, status: str, agents: list) -> list:
        """Use LLM to suggest team actions."""
        try:
            from app.core.model_router import model_router, TaskType
            agent_summary = ", ".join([f"{a.role}({a.status})" for a in agents])
            prompt = (
                "You are a research team lead. Based on the current status, suggest 3 "
                "specific next actions for the team.\n\n"
                "Question: " + question + "\n"
                "Status: " + status + "\n"
                "Agents: " + agent_summary +
                "\n\nReturn a JSON array of action strings."
            )
            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.SEARCH_PLANNING,
                temperature=0.3, max_tokens=500,
            )
            raw = result["content"].strip()
            if "```" in raw:
                raw = raw.split("```")[1].split("```")[0]
                if raw.startswith("json"): raw = raw[4:]
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else ["Continue research"]
        except Exception as e:
            logger.error("llm_lead_suggestions_failed: " + str(e))
            return ["Continue with current research plan"]


# Singleton
agent_execution_engine = AgentExecutionEngine()
