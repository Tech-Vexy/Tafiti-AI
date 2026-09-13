"""
Research Teams API
==================
Dynamic agent teams inspired by Google AntiGravity Teamwork.
- Form and activate research teams
- Spawn agents on-demand (including sub-agents)
- Collaborative planning (plan - review - approve - execute)
- Inter-agent message passing
- Real-time team status and progress
"""

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.database import (
    AgentTeam, Agent, ResearchQuestion,
)
from app.models.schemas import (
    TeamCreate, TeamDetailResponse, TeamPlanUpdate,
    AgentSpawnRequest, AgentResponse, AgentMessageCreate, CollaborativePlanRequest, SpawnSubagentRequest,
)

router = APIRouter()


# Team Lifecycle

@router.post("/teams", response_model=TeamDetailResponse)
async def create_team(
    data: TeamCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Form a new research team for a question."""
    question = await db.get(ResearchQuestion, data.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.agent_orchestrator import agent_orchestrator
    team = await agent_orchestrator.create_team(
        question_id=data.question_id, db=db,
        name=data.name, max_agents=data.max_agents,
        initial_plan=data.initial_plan,
    )
    detail = await agent_orchestrator.get_team_detail(team.id, db)
    return detail


@router.post("/teams/{team_id}/activate")
async def activate_team(
    team_id: str,
    data: TeamPlanUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate a team: approve plan and spawn initial agents."""
    team = await db.get(AgentTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    question = await db.get(ResearchQuestion, team.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.agent_orchestrator import agent_orchestrator
    result = await agent_orchestrator.activate_team(team_id, db, plan=data.plan)
    return result


@router.get("/teams/{team_id}", response_model=TeamDetailResponse)
async def get_team(
    team_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full team detail with agents and recent messages."""
    team = await db.get(AgentTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    question = await db.get(ResearchQuestion, team.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.agent_orchestrator import agent_orchestrator
    return await agent_orchestrator.get_team_detail(team_id, db)


@router.get("/teams")
async def list_teams(
    question_id: str = Query(None),
    limit: int = Query(20, ge=1, le=50),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all research teams for the current user."""
    stmt = select(AgentTeam)
    if question_id:
        stmt = stmt.where(AgentTeam.question_id == question_id)
    else:
        # Get all teams for user's questions
        user_question_ids = (
            await db.execute(
                select(ResearchQuestion.id).where(ResearchQuestion.user_id == user["user_id"])
            )
        ).scalars().all()
        stmt = stmt.where(AgentTeam.question_id.in_(user_question_ids))
    stmt = stmt.order_by(AgentTeam.created_at.desc()).limit(limit)
    teams = (await db.execute(stmt)).scalars().all()

    from app.services.agent_orchestrator import agent_orchestrator
    result = []
    for team in teams:
        status = await agent_orchestrator.get_team_status(team.id, db)
        result.append(status["team"])
    return result


# Agent Spawning

@router.post("/teams/{team_id}/agents", response_model=AgentResponse)
async def spawn_agent(
    team_id: str,
    data: AgentSpawnRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Spawn a new agent within a team."""
    team = await db.get(AgentTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    question = await db.get(ResearchQuestion, team.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.agent_orchestrator import agent_orchestrator
    agent = await agent_orchestrator.spawn_agent(
        team_id=team_id, role=data.role, db=db,
        name=data.name, description=data.description,
        parent_agent_id=data.parent_agent_id,
        capabilities=data.capabilities,
        agent_model=data.agent_model,
    )
    return agent


@router.post("/teams/{team_id}/agents/spawn-subagent", response_model=AgentResponse)
async def spawn_subagent(
    team_id: str,
    data: SpawnSubagentRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Spawn a sub-agent from within an existing agent (dynamic composition)."""
    parent = await db.get(Agent, data.parent_agent_id)
    if not parent or parent.team_id != team_id:
        raise HTTPException(status_code=404, detail="Parent agent not found in this team")

    from app.services.agent_orchestrator import agent_orchestrator
    agent = await agent_orchestrator.spawn_subagent(
        parent_agent_id=data.parent_agent_id,
        role=data.role,
        description=data.description,
        db=db,
        capabilities=data.capabilities,
    )
    return agent


@router.post("/teams/{team_id}/agents/{agent_id}/retire")
async def retire_agent(
    team_id: str,
    agent_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retire an agent after its work is done."""
    from app.services.agent_orchestrator import agent_orchestrator
    return await agent_orchestrator.retire_agent(agent_id, db)


# Task Assignment

@router.post("/teams/{team_id}/agents/{agent_id}/assign-task")
async def assign_task(
    team_id: str,
    agent_id: str,
    task_id: str = Query(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a research task to an agent."""
    from app.services.agent_orchestrator import agent_orchestrator
    return await agent_orchestrator.assign_task(agent_id, task_id, db)


@router.post("/teams/{team_id}/agents/{agent_id}/complete")
async def complete_task(
    team_id: str,
    agent_id: str,
    result_summary: str = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an agent task as complete."""
    from app.services.agent_orchestrator import agent_orchestrator
    return await agent_orchestrator.complete_task(agent_id, db, result_summary=result_summary)


@router.post("/teams/{team_id}/agents/{agent_id}/execute")
async def execute_agent_task(
    team_id: str,
    agent_id: str,
    task_id: str = Query(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a task for an agent using the execution engine."""
    from app.services.agent_orchestrator import agent_orchestrator
    from app.services.agent_execution import agent_execution_engine

    # Assign the task
    await agent_orchestrator.assign_task(agent_id, task_id, db)

    # Execute the task
    result = await agent_execution_engine.execute_agent_task(agent_id, task_id, db)

    # Mark complete
    summary = json.dumps(result)[:2000] if isinstance(result, dict) else str(result)[:2000]
    await agent_orchestrator.complete_task(agent_id, db, result_summary=summary)

    return {"agent_id": agent_id, "task_id": task_id, "result": result}


# Message Passing

@router.post("/teams/{team_id}/messages")
async def send_message(
    team_id: str,
    data: AgentMessageCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message within a team."""
    from app.services.agent_orchestrator import agent_orchestrator
    msg = await agent_orchestrator.send_message(
        team_id=team_id, message_type=data.message_type, content=data.content,
        db=db, sender_agent_id=data.sender_agent_id,
        receiver_agent_id=data.receiver_agent_id,
        metadata=data.metadata, priority=data.priority,
    )
    return {"id": msg.id, "message_type": msg.message_type, "content": msg.content}


@router.get("/teams/{team_id}/messages")
async def get_messages(
    team_id: str,
    message_type: str = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages for a team."""
    from app.services.agent_orchestrator import agent_orchestrator
    messages = await agent_orchestrator.get_team_messages(team_id, db, message_type=message_type, limit=limit)
    return [{"id": m.id, "sender_agent_id": m.sender_agent_id, "message_type": m.message_type, "content": m.content, "metadata": m.message_metadata or {}, "created_at": m.created_at.isoformat() if m.created_at else None} for m in messages]


@router.post("/plan")
async def generate_plan(data: CollaborativePlanRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Generate a collaborative research plan for review before execution."""
    question = await db.get(ResearchQuestion, data.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")
    from app.services.agent_orchestrator import agent_orchestrator
    return await agent_orchestrator.generate_plan(question_id=data.question_id, db=db, approach=data.approach, constraints=data.constraints)


@router.patch("/teams/{team_id}/plan")
async def update_plan(team_id: str, data: TeamPlanUpdate, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update the team's collaborative plan."""
    team = await db.get(AgentTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    question = await db.get(ResearchQuestion, team.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    team.team_plan = data.plan
    await db.commit()
    return {"team_id": team_id, "plan": data.plan}


@router.get("/teams/{team_id}/status")
async def get_status(team_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get team status summary."""
    from app.services.agent_orchestrator import agent_orchestrator
    return await agent_orchestrator.get_team_status(team_id, db)
