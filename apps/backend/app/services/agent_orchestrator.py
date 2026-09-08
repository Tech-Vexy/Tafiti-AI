"""
Agent Orchestrator - Dynamic Research Team Management
=====================================================
Inspired by Google AntiGravity Teamwork patterns:
- Dynamic team formation
- Sub-agent spawning during research execution
- Inter-agent message passing and coordination
- Collaborative planning with human review
- Agent lifecycle management
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    AgentTeam, Agent, AgentMessage, ResearchQuestion, ResearchTask,
)

logger = get_logger("agent_orchestrator")

AGENT_ROLES = {
    "lead": {"description": "Team coordinator.", "capabilities": ["coordinate", "delegate", "review", "spawn"]},
    "researcher": {"description": "Searches academic databases and web evidence.", "capabilities": ["search_openalex", "search_semantic_scholar", "search_core", "search_parallel"]},
    "critic": {"description": "Reviews quality and validity.", "capabilities": ["review_claims", "check_citations", "identify_gaps"]},
    "synthesist": {"description": "Synthesizes findings.", "capabilities": ["synthesize", "identify_patterns", "generate_report"]},
    "extractor": {"description": "Extracts claims and evidence.", "capabilities": ["extract_claims", "extract_evidence"]},
    "verifier": {"description": "Verifies claims against sources.", "capabilities": ["verify_claims", "cross_reference", "fact_check"]},
    "scout": {"description": "Explores tangential topics.", "capabilities": ["explore_tangents", "find_connections"]},
}

_role_counters = {}


class AgentOrchestrator:
    """Manages dynamic research teams with on-demand agent spawning."""

    async def create_team(self, question_id, db, name=None, max_agents=8, initial_plan=None):
        question = await db.get(ResearchQuestion, question_id)
        if not question:
            raise ValueError("Research question not found")
        if not name:
            words = question.question.split()[:6]
            name = "Team: " + " ".join(words) + "..."
        team = AgentTeam(question_id=question_id, name=name, status="forming", team_plan=initial_plan or {}, max_agents=max_agents)
        db.add(team)
        await db.commit()
        await db.refresh(team)
        return team

    async def activate_team(self, team_id, db, plan=None):
        team = await db.get(AgentTeam, team_id)
        if not team:
            raise ValueError("Team not found")
        if plan:
            team.team_plan = plan
        team.status = "active"
        await db.commit()
        roles = self._determine_initial_roles(plan, team.max_agents)
        spawned = []
        for rd in roles:
            a = await self.spawn_agent(team_id=team_id, role=rd["role"], description=rd.get("description"), capabilities=rd.get("capabilities", []), db=db)
            spawned.append(a)
        await self.send_message(team_id=team_id, message_type="status_update", content="Team activated with " + str(len(spawned)) + " agents", db=db)
        return {"team_id": team_id, "status": "active", "agents_spawned": len(spawned), "roles": [a.role for a in spawned]}

    def _determine_initial_roles(self, plan, max_agents):
        if plan and "suggested_roles" in plan:
            return [{"role": r, **AGENT_ROLES.get(r, AGENT_ROLES["researcher"])} for r in plan["suggested_roles"][:max_agents]]
        return [{"role": "lead", **AGENT_ROLES["lead"]}, {"role": "researcher", **AGENT_ROLES["researcher"]}, {"role": "critic", **AGENT_ROLES["critic"]}]

    async def spawn_agent(self, team_id, role, db, name=None, description=None, parent_agent_id=None, capabilities=None, agent_model=None):
        team = await db.get(AgentTeam, team_id)
        if not team:
            raise ValueError("Team not found")
        count = await db.scalar(select(func.count()).where(Agent.team_id == team_id))
        if count and count >= team.max_agents:
            raise ValueError("Team has reached max agents (" + str(team.max_agents) + ")")
        ri = AGENT_ROLES.get(role, AGENT_ROLES["researcher"])
        if not capabilities:
            capabilities = ri["capabilities"]
        if not description:
            description = ri["description"]
        if not name:
            _role_counters[role] = _role_counters.get(role, 0) + 1
            name = role.title() + " #" + str(_role_counters[role])
        agent = Agent(team_id=team_id, parent_agent_id=parent_agent_id, role=role, name=name, description=description, status="spawned", agent_model=agent_model, capabilities=capabilities)
        db.add(agent)
        await db.commit()
        await db.refresh(agent)
        return agent

    async def spawn_subagent(self, parent_agent_id, role, description, db, capabilities=None):
        parent = await db.get(Agent, parent_agent_id)
        if not parent:
            raise ValueError("Parent agent not found")
        return await self.spawn_agent(team_id=parent.team_id, role=role, description=description, parent_agent_id=parent_agent_id, capabilities=capabilities, db=db)

    async def retire_agent(self, agent_id, db, summary=None):
        agent = await db.get(Agent, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        agent.status = "retired"
        agent.retired_at = datetime.now(timezone.utc)
        if summary:
            agent.output_summary = summary
        await db.commit()
        return {"agent_id": agent_id, "status": "retired"}

    async def assign_task(self, agent_id, task_id, db):
        agent = await db.get(Agent, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        task = await db.get(ResearchTask, task_id)
        if not task:
            raise ValueError("Task not found")
        agent.current_task_id = task_id
        agent.status = "working"
        agent.started_at = datetime.now(timezone.utc)
        task.status = "running"
        await db.commit()
        await self.send_message(team_id=agent.team_id, sender_agent_id=agent_id, message_type="task_assigned", content=agent.name + " assigned to: " + task.description, metadata={"task_id": task_id}, db=db)
        return {"agent_id": agent_id, "task_id": task_id, "status": "working"}

    async def complete_task(self, agent_id, db, result_summary=None, spawn_children=None):
        agent = await db.get(Agent, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if agent.current_task_id:
            task = await db.get(ResearchTask, agent.current_task_id)
            if task:
                task.status = "completed"
                task.completed_at = datetime.now(timezone.utc)
                if result_summary:
                    task.result_summary = result_summary[:1000]
        agent.status = "active"
        agent.current_task_id = None
        agent.tasks_completed += 1
        agent.started_at = None
        if result_summary:
            agent.output_summary = result_summary[:2000]
        await db.commit()
        await self.send_message(team_id=agent.team_id, sender_agent_id=agent_id, message_type="task_complete", content=agent.name + " completed: " + (result_summary or "Done")[:500], db=db)
        children = []
        if spawn_children:
            for cd in spawn_children:
                child = await self.spawn_subagent(parent_agent_id=agent_id, role=cd.get("role", "researcher"), description=cd.get("description", "Sub-task"), capabilities=cd.get("capabilities"), db=db)
                children.append(child.id)
        return {"agent_id": agent_id, "status": "completed", "tasks_completed": agent.tasks_completed, "children_spawned": children}

    async def fail_task(self, agent_id, error, db):
        agent = await db.get(Agent, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if agent.current_task_id:
            task = await db.get(ResearchTask, agent.current_task_id)
            if task:
                task.status = "failed"
                task.error = error[:500]
                task.completed_at = datetime.now(timezone.utc)
        agent.status = "active"
        agent.current_task_id = None
        agent.tasks_failed += 1
        agent.error = error[:1000]
        agent.started_at = None
        await db.commit()
        return {"agent_id": agent_id, "status": "failed", "error": error}

    async def send_message(self, team_id, message_type, content, db, sender_agent_id=None, receiver_agent_id=None, metadata=None, priority=0):
        msg = AgentMessage(team_id=team_id, sender_agent_id=sender_agent_id, receiver_agent_id=receiver_agent_id, message_type=message_type, content=content, message_metadata=metadata or {}, priority=priority)
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return msg

    async def get_team_messages(self, team_id, db, message_type=None, limit=50):
        stmt = select(AgentMessage).where(AgentMessage.team_id == team_id)
        if message_type:
            stmt = stmt.where(AgentMessage.message_type == message_type)
        stmt = stmt.order_by(desc(AgentMessage.created_at)).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    async def generate_plan(self, question_id, db, approach=None, constraints=None):
        question = await db.get(ResearchQuestion, question_id)
        if not question:
            raise ValueError("Question not found")
        plan = await self._llm_generate_plan(question.question, question.description, approach, constraints)
        team = await self.create_team(question_id=question_id, db=db, initial_plan=plan)
        return {"team_id": team.id, "plan": plan, "suggested_roles": plan.get("suggested_roles", ["lead", "researcher", "critic"]), "estimated_duration": plan.get("estimated_duration", "10-15 minutes"), "ready_to_execute": False}

    async def _llm_generate_plan(self, question, description, approach, constraints):
        try:
            from app.core.model_router import model_router, TaskType
            parts = ["Research Question: " + question]
            if description:
                parts.append("Context: " + description)
            if approach:
                parts.append("Approach: " + approach)
            if constraints:
                parts.append("Constraints: " + ", ".join(constraints))
            prompt = "Generate a JSON research plan with goals, phases (name, description, agent_roles, depends_on, estimated_minutes), suggested_roles, estimated_duration, key_databases, success_criteria.\n\n" + "\n".join(parts) + "\n\nReturn ONLY the JSON."
            result = await model_router.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type=TaskType.SEARCH_PLANNING,
                temperature=0.3, max_tokens=2000,
            )
            import json
            c = result["content"].strip()
            if "```json" in c:
                c = c.split("```json")[1].split("```")[0]
            elif "```" in c:
                c = c.split("```")[1].split("```")[0]
            return json.loads(c)
        except Exception as e:
            logger.error("plan_generation_failed: " + str(e))
            return {"goals": [question], "phases": [{"name": "Discovery", "description": "Search databases", "agent_roles": ["researcher", "scout"], "depends_on": []}, {"name": "Extraction", "description": "Extract claims", "agent_roles": ["extractor"], "depends_on": ["Discovery"]}, {"name": "Verification", "description": "Verify claims", "agent_roles": ["verifier", "critic"], "depends_on": ["Extraction"]}, {"name": "Synthesis", "description": "Synthesize report", "agent_roles": ["synthesist", "lead"], "depends_on": ["Verification"]}], "suggested_roles": ["lead", "researcher", "critic", "extractor", "synthesist"], "estimated_duration": "15-20 minutes"}

    async def get_team_status(self, team_id, db):
        team = await db.get(AgentTeam, team_id)
        if not team:
            raise ValueError("Team not found")
        ac = await db.scalar(select(func.count()).where(Agent.team_id == team_id))
        act = await db.scalar(select(func.count()).where(Agent.team_id == team_id, Agent.status.in_(["active", "working", "spawned"])))
        comp = await db.scalar(select(func.count()).where(Agent.team_id == team_id, Agent.status.in_(["completed", "retired"])))
        fail = await db.scalar(select(func.count()).where(Agent.team_id == team_id, Agent.status == "failed"))
        return {"team": {"id": team.id, "question_id": team.question_id, "name": team.name, "status": team.status, "team_plan": team.team_plan, "agent_count": ac or 0, "active_agents": act or 0, "completed_agents": comp or 0, "failed_agents": fail or 0, "max_agents": team.max_agents, "created_at": team.created_at.isoformat() if team.created_at else None, "updated_at": team.updated_at.isoformat() if team.updated_at else None}, "shared_context": team.shared_context}

    async def get_team_detail(self, team_id, db):
        status = await self.get_team_status(team_id, db)
        agents = (await db.execute(select(Agent).where(Agent.team_id == team_id).order_by(Agent.spawned_at))).scalars().all()
        messages = await self.get_team_messages(team_id, db, limit=20)
        names = {a.id: a.name for a in agents}
        agent_list = []
        for a in agents:
            sc = await db.scalar(select(func.count()).where(Agent.parent_agent_id == a.id))
            agent_list.append({"id": a.id, "team_id": a.team_id, "parent_agent_id": a.parent_agent_id, "role": a.role, "name": a.name, "description": a.description, "status": a.status, "capabilities": a.capabilities or [], "tasks_completed": a.tasks_completed, "tasks_failed": a.tasks_failed, "output_summary": a.output_summary, "spawned_at": a.spawned_at.isoformat() if a.spawned_at else None, "sub_agent_count": sc or 0})
        msg_list = []
        for m in messages:
            msg_list.append({"id": m.id, "sender_name": names.get(m.sender_agent_id, "System"), "message_type": m.message_type, "content": m.content, "metadata": m.metadata or {}, "created_at": m.created_at.isoformat() if m.created_at else None})
        status["agents"] = agent_list
        status["recent_messages"] = msg_list
        return status


agent_orchestrator = AgentOrchestrator()
