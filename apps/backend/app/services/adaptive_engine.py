"""
Adaptive Research Engine
========================
Makes research agents truly adaptive — they evaluate their discoveries,
recommend next actions, generate new tasks, and pivot strategy dynamically.

Key patterns:
1. Self-evaluation after each task completion
2. Dynamic task generation based on discoveries
3. Strategy evolution mid-research
4. Conditional specialist spawning
5. Cross-agent context sharing
6. Research depth calibration

This engine sits between the Orchestrator and ExecutionEngine,
adding an intelligence layer that makes the research process
responsive to what is actually discovered.
"""

import json

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import (
    AgentTeam, Agent, ResearchQuestion, ResearchTask,
    Source, Claim, Evidence,
)

logger = get_logger("adaptive_engine")


# Adaptation signal types
SIGNALS = {
    "spawn_specialist": "A new specialist agent is needed",
    "pivot_strategy": "The current approach is not working, try something different",
    "deepen_investigation": "Found promising leads that need deeper investigation",
    "resolve_contradiction": "Contradictory claims found, need resolution",
    "expand_search": "Current sources are insufficient, broaden the search",
    "focus_narrow": "Found the core area, focus resources here",
    "synthesize_early": "Enough evidence to produce an interim synthesis",
    "terminate": "Research is sufficient, wrap up",
}


class AdaptiveEngine:
    """
    Monitors research progress and makes intelligent decisions about
    what the team should do next based on what has been discovered.
    """

    async def evaluate_after_task(
        self,
        agent_id: str,
        task_id: str,
        task_result: dict,
        db: AsyncSession,
    ) -> dict:
        """
        Called after every task completion. Analyzes the result and
        returns adaptation signals that the orchestrator uses to
        dynamically adjust the research plan.

        Returns:
            {
                "signals": [{"type": str, "reason": str, "priority": int}],
                "recommended_tasks": [{"type": str, "description": str, "depends_on": []}],
                "spawn_requests": [{"role": str, "description": str}],
                "strategy_update": str or None,
                "shared_context": str,  # summary for other agents
            }
        """
        agent = await db.get(Agent, agent_id)
        task = await db.get(ResearchTask, task_id)
        if not agent or not task:
            return {"signals": [], "recommended_tasks": [], "spawn_requests": []}

        question = await db.get(ResearchQuestion, task.question_id)
        if not question:
            return {"signals": [], "recommended_tasks": [], "spawn_requests": []}

        # Gather full research state
        state = await self._gather_research_state(task.question_id, db)

        # LLM-powered evaluation
        evaluation = await self._llm_evaluate(
            question.question, state, agent.role, task_result
        )

        # Generate adaptation signals
        signals = self._interpret_signals(evaluation, state)

        # Generate recommended follow-up tasks
        recommended = await self._generate_followup_tasks(
            question, state, evaluation, db
        )

        # Determine if specialists should be spawned
        spawn_requests = self._determine_spawns(evaluation, state)

        # Update shared context for other agents
        shared_context = await self._update_shared_context(
            task.question_id, agent, evaluation, db
        )

        result = {
            "signals": signals,
            "recommended_tasks": recommended,
            "spawn_requests": spawn_requests,
            "strategy_update": evaluation.get("strategy_update"),
            "shared_context": shared_context,
        }

        logger.info(
            f"adaptive_evaluation agent={agent.name} signals={len(signals)} "
            f"tasks={len(recommended)} spawns={len(spawn_requests)}"
        )

        return result

    async def should_replan(self, question_id: str, db: AsyncSession) -> dict:
        """
        Periodic check: should the team change its research strategy?
        Called every N completed tasks or when contradictions spike.
        """
        state = await self._gather_research_state(question_id, db)

        evaluation = await self._llm_replan_check(state)

        return {
            "should_replan": evaluation.get("should_replan", False),
            "reason": evaluation.get("reason", ""),
            "new_strategy": evaluation.get("new_strategy"),
            "adjustments": evaluation.get("adjustments", []),
        }

    async def calibrate_depth(
        self, question_id: str, db: AsyncSession
    ) -> dict:
        """
        Determine how deep the research should go based on:
        - Topic complexity
        - Available sources
        - Current evidence quality
        - Time/resource constraints
        """
        state = await self._gather_research_state(question_id, db)

        depth = await self._llm_calibrate_depth(state)

        return {
            "recommended_depth": depth.get("depth", "standard"),
            "max_additional_tasks": depth.get("max_tasks", 5),
            "focus_areas": depth.get("focus_areas", []),
            "reasoning": depth.get("reasoning", ""),
        }

    # ── Internal Methods ───────────────────────────────────────────────────

    async def _gather_research_state(self, question_id: str, db: AsyncSession) -> dict:
        """Collect full research state for analysis."""
        question = await db.get(ResearchQuestion, question_id)

        # Tasks
        tasks = (await db.execute(
            select(ResearchTask).where(ResearchTask.question_id == question_id)
        )).scalars().all()

        # Sources
        sources = (await db.execute(
            select(Source).join(ResearchTask).where(ResearchTask.question_id == question_id)
        )).scalars().all()

        # Claims
        claims = (await db.execute(
            select(Claim).where(Claim.question_id == question_id)
        )).scalars().all()

        # Agents
        team = (await db.execute(
            select(AgentTeam).where(AgentTeam.question_id == question_id)
        )).scalars().first()

        agents = []
        if team:
            agents = (await db.execute(
                select(Agent).where(Agent.team_id == team.id)
            )).scalars().all()

        # Evidence
        evidence_count = 0
        if claims:
            evidence_count = await db.scalar(
                select(func.count()).where(Evidence.claim_id.in_([c.id for c in claims]))
            ) or 0

        return {
            "question": question.question if question else "",
            "description": question.description if question else "",
            "tasks": {
                "total": len(tasks),
                "completed": sum(1 for t in tasks if t.status == "completed"),
                "running": sum(1 for t in tasks if t.status == "running"),
                "failed": sum(1 for t in tasks if t.status == "failed"),
                "pending": sum(1 for t in tasks if t.status == "pending"),
                "types": [t.task_type for t in tasks],
            },
            "sources": {
                "total": len(sources),
                "types": list(set(s.source_type for s in sources if s.source_type)),
            },
            "claims": {
                "total": len(claims),
                "verified": sum(1 for c in claims if c.verification_status == "verified"),
                "disputed": sum(1 for c in claims if c.verification_status == "disputed"),
                "unverified": sum(1 for c in claims if c.verification_status == "unverified"),
                "avg_confidence": sum(c.confidence for c in claims) // len(claims) if claims else 0,
            },
            "evidence_count": evidence_count,
            "agents": {
                "total": len(agents),
                "active": sum(1 for a in agents if a.status in ("active", "working")),
                "roles": list(set(a.role for a in agents)),
            },
        }

    async def _llm_evaluate(self, question, state, agent_role, task_result):
        try:
            from app.core.model_router import model_router, TaskType
            prompt = (
                "You are an adaptive research engine. An agent just completed a task. "
                "Analyze results and recommend next actions.\n\n"
                "Question: " + question + "\n"
                "Agent: " + agent_role + "\n"
                "Result: " + json.dumps(task_result)[:500] + "\n"
                "State: " + json.dumps(state, default=str)[:800] + "\n\n"
                "Return JSON: {assessment: str, signals: [{type, reason, priority}], "
                "strategy_update: str|null, gaps: [str], confidence: int}"
            )
            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.CRITIQUE,
                temperature=0.3, max_tokens=1500,
            )
            content = result["content"].strip()
            if "```" in content:
                content = content.split("```")[1].split("```")[0]
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
        except Exception as e:
            logger.error("llm_evaluate_failed: " + str(e))
            return {"assessment": "Evaluation failed", "signals": [], "strategy_update": None, "gaps": [], "confidence": 50}

    async def _llm_replan_check(self, state):
        try:
            from app.core.model_router import model_router, TaskType
            prompt = (
                "Analyze research progress and decide if strategy should change.\n\n"
                "State: " + json.dumps(state, default=str)[:1000] + "\n\n"
                "Return JSON: {should_replan: bool, reason: str, new_strategy: str|null, adjustments: [str]}"
            )
            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.SEARCH_PLANNING,
                temperature=0.3, max_tokens=500,
            )
            content = result["content"].strip()
            if "```" in content:
                content = content.split("```")[1].split("```")[0]
            return json.loads(content)
        except Exception:
            return {"should_replan": False, "reason": "Check failed"}

    async def _llm_calibrate_depth(self, state):
        try:
            from app.core.model_router import model_router, TaskType
            prompt = (
                "Recommend research depth based on state.\n\n"
                "State: " + json.dumps(state, default=str)[:800] + "\n\n"
                "Return JSON: {depth: 'shallow'|'standard'|'deep'|'exhaustive', max_tasks: int, focus_areas: [str], reasoning: str}"
            )
            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.SEARCH_PLANNING,
                temperature=0.3, max_tokens=500,
            )
            content = result["content"].strip()
            if "```" in content:
                content = content.split("```")[1].split("```")[0]
            return json.loads(content)
        except Exception:
            return {"depth": "standard", "max_tasks": 5, "focus_areas": [], "reasoning": "Default"}

    def _interpret_signals(self, evaluation, state):
        raw = evaluation.get("signals", [])
        interpreted = []
        for sig in raw:
            if isinstance(sig, dict) and "type" in sig:
                p = sig.get("priority", 5)
                if sig["type"] == "resolve_contradiction" and state["claims"]["disputed"] > 2:
                    p = min(10, p + 3)
                if sig["type"] == "expand_search" and state["sources"]["total"] < 5:
                    p = min(10, p + 2)
                if sig["type"] == "terminate" and state["claims"]["verified"] >= 3:
                    p = min(10, p + 2)
                interpreted.append({"type": sig["type"], "reason": sig.get("reason", ""), "priority": p})
        interpreted.sort(key=lambda x: x["priority"], reverse=True)
        return interpreted[:5]

    async def _generate_followup_tasks(self, question, state, evaluation, db):
        tasks = []
        done = set(state["tasks"]["types"])
        if state["sources"]["total"] > 0 and "claim_extraction" not in done:
            tasks.append({"type": "claim_extraction", "description": "Extract claims from sources", "depends_on": []})
        if state["claims"]["total"] > 0 and state["evidence_count"] == 0:
            tasks.append({"type": "evidence_extraction", "description": "Link evidence to claims", "depends_on": []})
        if state["claims"]["disputed"] > 0 and "contradiction_search" not in done:
            tasks.append({"type": "contradiction_search", "description": "Resolve disputed claims", "depends_on": []})
        if state["claims"]["verified"] >= 2 and state["evidence_count"] >= 3 and "synthesis" not in done:
            tasks.append({"type": "synthesis", "description": "Synthesize findings", "depends_on": []})
        for gap in evaluation.get("gaps", [])[:2]:
            if isinstance(gap, str) and len(gap) > 10:
                tasks.append({"type": "literature_review", "description": gap[:200], "depends_on": []})
        return tasks[:4]

    def _determine_spawns(self, evaluation, state):
        spawns = []
        for sig in evaluation.get("signals", []):
            if isinstance(sig, dict) and sig.get("type") == "spawn_specialist":
                r = sig.get("reason", "").lower()
                if "contradict" in r:
                    spawns.append({"role": "verifier", "description": "Resolve contradictions"})
                elif "methodolog" in r or "bias" in r:
                    spawns.append({"role": "critic", "description": "Evaluate methodology"})
                elif "tangential" in r or "connect" in r:
                    spawns.append({"role": "scout", "description": "Explore connections"})
                else:
                    spawns.append({"role": "researcher", "description": sig.get("reason", "Specialist needed")[:200]})
        if state["claims"]["disputed"] > 2 and not any(s["role"] == "verifier" for s in spawns):
            spawns.append({"role": "verifier", "description": "Multiple disputed claims"})
        if state["sources"]["total"] > 10 and state["claims"]["total"] == 0:
            spawns.append({"role": "extractor", "description": "Many sources, no claims extracted"})
        return spawns[:2]

    async def _update_shared_context(self, question_id, agent, evaluation, db):
        assessment = evaluation.get("assessment", "")
        gaps = evaluation.get("gaps", [])
        confidence = evaluation.get("confidence", 50)
        update = f"[{agent.name}] Assessment: {assessment}\nConfidence: {confidence}%\nGaps: {'; '.join(gaps[:3]) if gaps else 'None'}\n"
        team = (await db.execute(select(AgentTeam).where(AgentTeam.question_id == question_id))).scalars().first()
        if team:
            current = team.shared_context or ""
            team.shared_context = (current + "\n" + update)[-2000:]
            await db.commit()
        return update


adaptive_engine = AdaptiveEngine()
