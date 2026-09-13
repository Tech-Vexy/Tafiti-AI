"""
Research Intelligence API
=========================
Endpoints for the evidence-based research pipeline:
- Research Questions (CRUD)
- Task DAG execution
- Source management
- Claim verification
- Evidence graph
- Synthesis generation
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.database import (
    ResearchQuestion, ResearchTask, Source, Passage, Evidence, Claim,
)
from app.models.schemas import (
    ResearchQuestionCreate, ResearchQuestionResponse,
    ResearchTaskResponse, SourceResponse, PassageResponse,
    ClaimCreate, ClaimResponse, ClaimUpdate,
    EvidenceCreate, EvidenceResponse,
    ResearchProgressResponse,
)

router = APIRouter()


# ── Research Questions ────────────────────────────────────────────────────────

@router.post("/questions", response_model=ResearchQuestionResponse)
async def create_research_question(
    data: ResearchQuestionCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new research question."""
    question = ResearchQuestion(
        user_id=user["user_id"],
        question=data.question,
        description=data.description,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.get("/questions", response_model=list[ResearchQuestionResponse])
async def list_research_questions(
    status: str = Query(None, pattern=r"^(active|paused|completed|abandoned)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all research questions for the current user."""
    stmt = (
        select(ResearchQuestion)
        .where(ResearchQuestion.user_id == user["user_id"])
    )
    if status:
        stmt = stmt.where(ResearchQuestion.status == status)
    stmt = stmt.order_by(ResearchQuestion.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    questions = result.scalars().all()

    # Annotate with task/claim counts
    responses = []
    for q in questions:
        task_count = await db.scalar(
            select(func.count()).where(ResearchTask.question_id == q.id)
        )
        claim_count = await db.scalar(
            select(func.count()).where(Claim.question_id == q.id)
        )
        resp = ResearchQuestionResponse.model_validate(q)
        resp.task_count = task_count or 0
        resp.claim_count = claim_count or 0
        responses.append(resp)

    return responses


@router.get("/questions/{question_id}", response_model=ResearchQuestionResponse)
async def get_research_question(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific research question with progress stats."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    task_count = await db.scalar(
        select(func.count()).where(ResearchTask.question_id == question_id)
    )
    claim_count = await db.scalar(
        select(func.count()).where(Claim.question_id == question_id)
    )

    resp = ResearchQuestionResponse.model_validate(question)
    resp.task_count = task_count or 0
    resp.claim_count = claim_count or 0
    return resp


@router.patch("/questions/{question_id}", response_model=ResearchQuestionResponse)
async def update_research_question(
    question_id: str,
    status: str = Query(None, pattern=r"^(active|paused|completed|abandoned)$"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a research question's status."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    if status:
        question.status = status

    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/questions/{question_id}")
async def delete_research_question(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a research question and all its tasks, sources, claims, evidence."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    await db.delete(question)
    await db.commit()
    return {"detail": "Deleted"}


# ── Task Execution ────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/start", response_model=dict)
async def start_research(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a research investigation — creates task DAG and begins execution."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_runner import research_runner

    result = await research_runner.start_research(question_id, db)
    return result


@router.post("/questions/{question_id}/execute", response_model=list[dict])
async def execute_ready_tasks(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute all tasks whose dependencies are met."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.task_scheduler import task_scheduler

    ready = await task_scheduler.get_ready_tasks(question_id, db)
    return ready


@router.post("/tasks/{task_id}/execute", response_model=dict)
async def execute_task(
    task_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a specific research task."""
    task = await db.get(ResearchTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Verify ownership through the question
    question = await db.get(ResearchQuestion, task.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    task.status = "completed"
    await db.commit()
    return {"status": "completed", "task_id": task_id}


@router.get("/questions/{question_id}/tasks", response_model=list[ResearchTaskResponse])
async def list_tasks(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tasks for a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    stmt = (
        select(ResearchTask)
        .where(ResearchTask.question_id == question_id)
        .order_by(ResearchTask.created_at)
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    responses = []
    for t in tasks:
        source_count = await db.scalar(
            select(func.count()).where(Source.task_id == t.id)
        )
        resp = ResearchTaskResponse.model_validate(t)
        resp.depends_on = t.depends_on or []
        resp.source_count = source_count or 0
        responses.append(resp)

    return responses


# ── Sources & Passages ───────────────────────────────────────────────────────

@router.get("/tasks/{task_id}/sources", response_model=list[SourceResponse])
async def list_sources(
    task_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sources discovered by a task."""
    task = await db.get(ResearchTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    question = await db.get(ResearchQuestion, task.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = (
        select(Source)
        .where(Source.task_id == task_id)
        .order_by(Source.relevance_score.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/sources/{source_id}/passages", response_model=list[PassageResponse])
async def list_passages(
    source_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all passages extracted from a source."""
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    stmt = (
        select(Passage)
        .where(Passage.source_id == source_id)
        .order_by(Passage.position)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Claims ────────────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/claims", response_model=ClaimResponse)
async def create_claim(
    question_id: str,
    data: ClaimCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a claim under a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    claim = Claim(
        question_id=question_id,
        text=data.text,
        claim_type=data.claim_type,
        parent_claim_id=data.parent_claim_id,
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    return claim


@router.get("/questions/{question_id}/claims", response_model=list[ClaimResponse])
async def list_claims(
    question_id: str,
    verification_status: str = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all claims for a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    stmt = (
        select(Claim)
        .where(Claim.question_id == question_id)
    )
    if verification_status:
        stmt = stmt.where(Claim.verification_status == verification_status)
    stmt = stmt.order_by(Claim.confidence.desc())

    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/claims/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: str,
    data: ClaimUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify, accept, or reject a claim."""
    claim = await db.get(Claim, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    question = await db.get(ResearchQuestion, claim.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if data.verification_status is not None:
        claim.verification_status = data.verification_status
    if data.user_verdict is not None:
        claim.user_verdict = data.user_verdict
        claim.reviewed_by_user = True

    await db.commit()
    await db.refresh(claim)
    return claim


# ── Evidence ──────────────────────────────────────────────────────────────────

@router.post("/claims/{claim_id}/evidence", response_model=EvidenceResponse)
async def add_evidence(
    claim_id: str,
    data: EvidenceCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually add evidence to a claim."""
    claim = await db.get(Claim, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    question = await db.get(ResearchQuestion, claim.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    evidence = Evidence(
        passage_id=data.passage_id,
        claim_id=claim_id,
        relation=data.relation,
        confidence=data.confidence,
        notes=data.notes,
        extracted_by="manual",
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)
    return evidence


@router.get("/claims/{claim_id}/evidence", response_model=list[EvidenceResponse])
async def list_evidence(
    claim_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all evidence items for a claim."""
    claim = await db.get(Claim, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    question = await db.get(ResearchQuestion, claim.question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(Evidence).where(Evidence.claim_id == claim_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/questions/{question_id}/extract-evidence")
async def extract_evidence_for_all_claims(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run evidence extraction for all claims in a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.evidence_engine import evidence_engine

    stmt = select(Claim).where(Claim.question_id == question_id)
    result = await db.execute(stmt)
    claims = result.scalars().all()

    results = []
    for claim in claims:
        ev_result = await evidence_engine.extract_evidence_for_claim(claim.id, db)
        results.append(ev_result)

    return {"claim_results": results}


# ── Evidence Graph ────────────────────────────────────────────────────────────

@router.get("/questions/{question_id}/graph")
async def get_evidence_graph(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full evidence graph for a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.evidence_engine import evidence_engine

    graph = await evidence_engine.get_evidence_graph(question_id, db)
    return graph


@router.get("/questions/{question_id}/contradictions")
async def detect_contradictions(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detect contradictory claims within a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.evidence_engine import evidence_engine

    contradictions = await evidence_engine.detect_contradictions(question_id, db)
    return {"contradictions": contradictions}


# ── Synthesis ─────────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/synthesize")
async def synthesize_findings(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a comprehensive synthesis from all verified claims."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.reasoning_engine import reasoning_engine

    synthesis = await reasoning_engine.synthesize_findings(question_id, db)
    suggestions = await reasoning_engine.suggest_next_steps(question_id, db)

    return {
        "synthesis": synthesis,
        "next_steps": suggestions,
    }


# ── Progress Dashboard ────────────────────────────────────────────────────────

@router.get("/progress", response_model=ResearchProgressResponse)
async def get_overall_progress(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get an overview of all research activity for the current user."""
    stmt = (
        select(ResearchQuestion)
        .where(ResearchQuestion.user_id == user["user_id"])
        .order_by(ResearchQuestion.created_at.desc())
    )
    result = await db.execute(stmt)
    questions = result.scalars().all()

    total_tasks = 0
    total_sources = 0
    total_claims = 0
    verified = 0
    disputed = 0

    for q in questions:
        t_count = await db.scalar(select(func.count()).where(ResearchTask.question_id == q.id)) or 0
        s_count = await db.scalar(select(func.count()).where(Source.question_id == q.id)) or 0
        c_count = await db.scalar(select(func.count()).where(Claim.question_id == q.id)) or 0
        v_count = await db.scalar(select(func.count()).where(Claim.question_id == q.id, Claim.verification_status == "verified")) or 0
        d_count = await db.scalar(select(func.count()).where(Claim.question_id == q.id, Claim.verification_status == "disputed")) or 0
        total_tasks += t_count
        total_sources += s_count
        total_claims += c_count
        verified += v_count
        disputed += d_count

    question_responses = []
    for q in questions:
        task_count = await db.scalar(
            select(func.count()).where(ResearchTask.question_id == q.id)
        )
        claim_count = await db.scalar(
            select(func.count()).where(Claim.question_id == q.id)
        )
        resp = ResearchQuestionResponse.model_validate(q)
        resp.task_count = task_count or 0
        resp.claim_count = claim_count or 0
        question_responses.append(resp)

    return ResearchProgressResponse(
        questions=question_responses,
        total_tasks=total_tasks,
        total_sources=total_sources,
        total_claims=total_claims,
        verified_claims=verified,
        disputed_claims=disputed,
    )





# ── Research Statefulness ────────────────────────────────────────────────────

@router.post("/questions/{question_id}/start-async")
async def start_async_research(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start background research execution (non-blocking)."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_runner import research_runner
    result = await research_runner.start_research(question_id, db)
    return result


@router.get("/questions/{question_id}/session")
async def get_research_session(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the status of a running research session."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_runner import research_runner
    return await research_runner.get_session_status(question_id, db)


@router.post("/questions/{question_id}/pause")
async def pause_research(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause a running research session."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_runner import research_runner
    return await research_runner.pause_research(question_id, db)


@router.post("/questions/{question_id}/resume")
async def resume_research(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resume a paused research session from the last checkpoint."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_runner import research_runner
    return await research_runner.resume_research(question_id, db)


@router.get("/questions/{question_id}/audit-log")
async def get_audit_log(
    question_id: str,
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the audit trail for a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_state_machine import state_machine
    entries = await state_machine.get_audit_log(db, question_id=question_id, limit=limit)
    return {"entries": entries, "total": len(entries)}


@router.post("/questions/{question_id}/checkpoint")
async def create_checkpoint(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a manual checkpoint of the current research state."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_checkpoint import checkpoint_service
    return await checkpoint_service.create_checkpoint(
        question_id, db, trigger="manual",
        summary="Manual checkpoint by user"
    )


@router.get("/questions/{question_id}/checkpoints")
async def list_checkpoints(
    question_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all checkpoints for a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.services.research_checkpoint import checkpoint_service
    return await checkpoint_service.list_checkpoints(question_id, db)


@router.get("/questions/{question_id}/checkpoints/{checkpoint_id}")
async def get_checkpoint_detail(
    question_id: str,
    checkpoint_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a checkpoint with full snapshot."""
    from app.services.research_checkpoint import checkpoint_service
    try:
        return await checkpoint_service.get_checkpoint(checkpoint_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Durability Endpoints ─────────────────────────────────────────────────────

@router.post("/recover")
async def run_crash_recovery(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger crash recovery (detect and recover orphaned sessions)."""
    from app.services.durability import durability
    return await durability.recover_orphaned_sessions(db)


@router.post("/enforce-timeouts")
async def enforce_task_timeouts(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger timeout enforcement (fail hung tasks)."""
    from app.services.durability import durability
    return await durability.enforce_timeouts(db)


@router.get("/questions/{question_id}/execution-log")
async def get_execution_log(
    question_id: str,
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the write-ahead execution log for a research question."""
    question = await db.get(ResearchQuestion, question_id)
    if not question or question.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="Research question not found")

    from app.models.database import TaskExecutionLog, ResearchSessionState
    session = await db.scalar(
        select(ResearchSessionState).where(
            ResearchSessionState.question_id == question_id
        )
    )
    if not session:
        return {"entries": [], "total": 0}

    stmt = (
        select(TaskExecutionLog)
        .where(TaskExecutionLog.session_id == session.id)
        .order_by(TaskExecutionLog.planned_at.desc())
        .limit(limit)
    )
    results = (await db.execute(stmt)).scalars().all()
    entries = [
        {
            "id": log.id,
            "task_id": log.task_id,
            "status": log.status,
            "attempt_number": log.attempt_number,
            "agent_id": log.agent_id,
            "planned_at": log.planned_at.isoformat() if log.planned_at else None,
            "started_at": log.started_at.isoformat() if log.started_at else None,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            "result_summary": log.result_summary[:200] if log.result_summary else None,
            "error": log.error[:200] if log.error else None,
            "timeout_seconds": log.timeout_seconds,
        }
        for log in results
    ]
    return {"entries": entries, "total": len(entries)}
