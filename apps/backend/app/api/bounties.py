"""
Micro-Bounties API
==================
Researchers post financial or reputation bounties on papers they want reviewed.
Other researchers submit reviews. The bounty creator awards the winner.
Payment is processed via Paystack (KES).
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import aliased
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field
import httpx

from app.db.session import get_db
from app.models.database import Bounty, BountySubmission, User, Notification
from app.core.security import get_current_user
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("bounties")
router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class BountyCreate(BaseModel):
    paper_id: Optional[str] = None
    paper_title: Optional[str] = None
    description: str = Field(..., min_length=20)
    amount_kes: int = Field(default=0, ge=0)
    reputation_points: int = Field(default=10, ge=0)
    expires_days: int = Field(default=14, ge=1, le=90)


class BountyResponse(BaseModel):
    id: str
    creator_id: str
    paper_id: Optional[str] = None
    paper_title: Optional[str] = None
    description: str
    amount_kes: int
    reputation_points: int
    status: str
    funded: bool
    expires_at: Optional[datetime] = None
    created_at: datetime
    submission_count: int = 0

    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    bounty_id: str
    review_text: str = Field(..., min_length=50)


class SubmissionResponse(BaseModel):
    id: str
    bounty_id: str
    submitter_id: str
    review_text: str
    is_winner: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AwardRequest(BaseModel):
    submission_id: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _initiate_paystack_payment(bounty: Bounty, user_email: str) -> Optional[str]:
    """
    Initialise a Paystack transaction to fund a bounty.
    Returns the authorisation_url to redirect the user to.
    """
    if not settings.PAYSTACK_SECRET_KEY or bounty.amount_kes <= 0:
        return None

    headers = {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": user_email,
        "amount": bounty.amount_kes * 100,  # Paystack uses kobo/pesewas (100 = 1 KES)
        "currency": "KES",
        "reference": f"bounty_{bounty.id}",
        "metadata": {"bounty_id": bounty.id, "type": "bounty_fund"},
        "callback_url": f"{settings.FRONTEND_URL}/bounties/{bounty.id}?funded=true",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.paystack.co/transaction/initialize",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status"):
                return data["data"]["authorization_url"]
    except Exception as e:
        logger.error(f"Paystack init failed for bounty {bounty.id}: {e}")
    return None


async def _notify_user(db: AsyncSession, user_id: str, content: str, link: str):
    notif = Notification(
        user_id=user_id,
        type="bounty",
        content=content,
        link=link,
    )
    db.add(notif)
    await db.commit()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=BountyResponse)
async def create_bounty(
    body: BountyCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bounty = Bounty(
        creator_id=current_user["user_id"],
        paper_id=body.paper_id,
        paper_title=body.paper_title,
        description=body.description,
        amount_kes=body.amount_kes,
        reputation_points=body.reputation_points,
        status="open",
        funded=body.amount_kes == 0,   # reputation-only bounties are auto-funded
        expires_at=datetime.utcnow() + timedelta(days=body.expires_days),
    )
    db.add(bounty)
    await db.commit()
    await db.refresh(bounty)
    return BountyResponse(**bounty.__dict__, submission_count=0)


@router.get("/fund/{bounty_id}")
async def fund_bounty(
    bounty_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initialise a Paystack payment to fund an existing bounty. Returns payment URL."""
    result = await db.execute(select(Bounty).where(Bounty.id == bounty_id))
    bounty = result.scalar_one_or_none()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    if bounty.creator_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the bounty creator can fund it")
    if bounty.funded:
        raise HTTPException(status_code=400, detail="Bounty is already funded")

    # Get user email for Paystack
    user_result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = user_result.scalar_one_or_none()
    email = user.email if user else current_user.get("email", "")

    pay_url = await _initiate_paystack_payment(bounty, email)
    if not pay_url:
        raise HTTPException(status_code=503, detail="Payment provider unavailable")

    bounty.paystack_reference = f"bounty_{bounty_id}"
    await db.commit()
    return {"payment_url": pay_url}


@router.post("/fund/{bounty_id}/verify")
async def verify_bounty_funding(
    bounty_id: str,
    reference: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify Paystack payment and mark bounty as funded."""
    if not settings.PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Paystack not configured")

    headers = {"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.paystack.co/transaction/verify/{reference}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Paystack verification failed: {e}")

    if not (data.get("status") and data["data"].get("status") == "success"):
        raise HTTPException(status_code=400, detail="Payment not successful")

    result = await db.execute(select(Bounty).where(Bounty.id == bounty_id))
    bounty = result.scalar_one_or_none()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    bounty.funded = True
    await db.commit()
    return {"status": "funded", "bounty_id": bounty_id}


@router.get("/", response_model=List[BountyResponse])
async def list_bounties(
    status: str = "open",
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ⚡ Bolt: Optimize N+1 query and memory usage by using a scalar subquery for counts
    subq = (
        select(func.count())
        .select_from(BountySubmission)
    # ⚡ Bolt: Mitigation of N+1 queries. Used scalar_subquery with func.count and .correlate()
    # to fetch bounties and their submission counts in a single query rather than a loop.
    subq = (
        select(func.count())
        .select_from(BountySubmission)
    # ⚡ Bolt: Optimize bounty list to use a correlated subquery for submission counts, eliminating N+1 queries
    subquery = (
        select(func.count())
        .select_from(BountySubmission)
    # BOLT OPTIMIZATION: Fix N+1 query issue by batching counts into a scalar subquery.
    subq = (
    # ⚡ Bolt Optimization: Use a single query with scalar_subquery to count submissions, preventing N+1 queries.
    subq = (
    # ⚡ Bolt: Optimize N+1 and len() count query using scalar subqueries
    subq = (
        select(func.count(BountySubmission.bounty_id))
    # ⚡ BOLT OPTIMIZATION:
    # Replaced N+1 queries calculating submission counts in a Python loop
    # `len(result.scalars().all())` with a single correlated subquery.
    # This executes everything on the database side and eliminates the N extra trips.
    count_subq = (
    # ⚡ Bolt: Optimized N+1 query. Replaced per-bounty scalar count query inside loop
    # with a single correlated scalar subquery for submission counting.
    submission_count_subquery = (
        select(func.count())
        .select_from(BountySubmission)
    # ⚡ Bolt: Use scalar_subquery to batch submission counts and prevent N+1 queries.
    sub_count_query = (
        select(func.count())
        .select_from(BountySubmission)
    # Bolt: optimized by replacing N+1 per-row length calculations with a correlated scalar subquery for submission counts
    subq = (
    # Performance optimization: Replace N+1 queries calculating submission counts
    # via fetching all objects (`len(res.scalars().all())`) with a single SQL
    # statement using `.scalar_subquery()`. Expected to significantly reduce
    # latency and DB load for the listing endpoint.
    BountySubmissionAlias = aliased(BountySubmission)
    count_subq = (
        select(func.count(BountySubmissionAlias.id))
        .where(BountySubmissionAlias.bounty_id == Bounty.id)
    # ⚡ BOLT OPTIMIZATION: Replaced N+1 queries in loop with a single query using scalar_subquery
    # Expected impact: Reduces database queries from O(N) to O(1), improving response time significantly.
    sub_count_subq = (
    # OPTIMIZATION: Resolves N+1 queries. Uses `func.count()` with `scalar_subquery()`
    # and `.correlate(Bounty)` to retrieve bounties and their submission counts in a single query.
    sub_count_subq = (
    # PERFORMANCE OPTIMIZATION: Resolves N+1 query and memory inefficiency.
    # Replaced loop fetching all BountySubmissions per bounty to count them
    # with a single scalar_subquery using func.count().
    subquery = (
    # ⚡ Bolt Optimization: Use scalar_subquery with func.count() to avoid N+1 query loops.
    # Prevents executing a separate `len(sub_count_res.scalars().all())` count query for every bounty.
    sub_count_subq = (
    # Bolt Optimization: Batch queries to avoid N+1 and memory bloat
    subq = (
        select(func.count())
    # ⚡ Bolt: Optimized N+1 query.
    # Replaced iterative queries and memory bloat from len(.all()) with a
    # scalar subquery that computes the submission count at the database level.
    # Performance Optimization:
    # Batch member counts using a scalar subquery instead of performing N+1
    # db queries inside the loop over bounties.
    count_subquery = (
        select(func.count(BountySubmission.id))
        .where(BountySubmission.bounty_id == Bounty.id)
        .correlate(Bounty)
        .scalar_subquery()
    )
    result = await db.execute(
        select(Bounty, subq)

    result = await db.execute(
    result = await db.execute(
        select(Bounty, subquery.label("submission_count"))
    result = await db.execute(
        select(Bounty, subq)

    result = await db.execute(
        select(Bounty, subq)
    result = await db.execute(
    result = await db.execute(
        select(Bounty, count_subq.label('submission_count'))
    query = (
        select(Bounty, submission_count_subquery)
    result = await db.execute(
        select(Bounty, sub_count_query.label("submission_count"))
    result = await db.execute(
    result = await db.execute(
        select(Bounty, count_subq.label("submission_count"))
    result = await db.execute(
        select(Bounty, sub_count_subq.label("submission_count"))
    stmt = (
        select(Bounty, sub_count_subq.label("submission_count"))
    query = (
        select(Bounty, subquery.label("submission_count"))
    result = await db.execute(
        select(Bounty, sub_count_subq)
    result = await db.execute(
    result = await db.execute(
        select(Bounty, count_subquery.label("submission_count"))
    # Optimization: Replaced N+1 queries using scalar_subquery to batch submission count calculation
    # Expected impact: Reduced database roundtrips and memory bloat from looping over bounties
    # Performance Optimization: Avoid N+1 queries and loading all submissions into memory.
    # Use scalar_subquery to retrieve the submission count alongside each Bounty in a single DB roundtrip.
    # ⚡ Bolt Optimization: Replacing N+1 query loop with a single scalar subquery
    # Expectation: Reduces number of queries from 1 + N to 1, significantly improving list endpoint performance
    subq = (
        select(func.count(BountySubmission.id))
        .where(BountySubmission.bounty_id == Bounty.id)
        .scalar_subquery()
        .label("submission_count")
    )

    result = await db.execute(
        select(Bounty, subq)
    )

    stmt = (
    result = await db.execute(
        select(Bounty, subq.label('submission_count'))
    result = await db.execute(
        select(Bounty, subq.label("submission_count"))
        .where(Bounty.status == status, Bounty.funded == True)  # noqa: E712
        .order_by(desc(Bounty.created_at))
        .limit(limit)
    )
    rows = result.all()
    return [BountyResponse(**b.__dict__, submission_count=count or 0) for b, count in rows]
    out = []
    for b, count in rows:
        out.append(BountyResponse(**b.__dict__, submission_count=count or 0))

    out = []
    for b, count in rows:
        out.append(BountyResponse(**b.__dict__, submission_count=count or 0))
    out = []
    for b, count in rows:
        out.append(BountyResponse(**b.__dict__, submission_count=count or 0))
    bounties = result.all()
    out = []
    for b, count in bounties:
    rows = result.all()
    out = []

    rows = result.all()
    out = []
    for b, count in rows:
        out.append(BountyResponse(**b.__dict__, submission_count=count or 0))
    result = await db.execute(query)

    out = []
    for b, count in result.all():
    out = []
    for row in result.all():
        bounty, count = row
    rows = result.all()
    out = []
    bounties_with_counts = result.all()

    out = []
    for b, count in bounties_with_counts:
    rows = result.all()

    out = []
    for b in bounties:
        # ⚡ Bolt Optimization: Use explicit func.count() instead of len(result.scalars().all()) to avoid loading all rows into memory in a loop.
        count = await db.scalar(
            select(func.count()).select_from(BountySubmission).where(BountySubmission.bounty_id == b.id)
        )
        # ⚡ Bolt: Use func.count() to avoid loading all submission objects into memory
        sub_count_res = await db.execute(
            select(func.count(BountySubmission.id)).where(BountySubmission.bounty_id == b.id)
        )
        count = sub_count_res.scalar() or 0
        # ⚡ Bolt Optimization: Calculate count natively in SQL to avoid loading submission records
        # Expected Impact: Prevents memory OOM for bounties with large numbers of submissions
        count = await db.scalar(
            select(func.count()).select_from(BountySubmission).where(BountySubmission.bounty_id == b.id)
        )
        out.append(BountyResponse(**b.__dict__, submission_count=count or 0))
    result = await db.execute(stmt)
    rows = result.all()

    out = []

    result = await db.execute(query)
    rows = result.all()

    out = []
    out = []
    for b, count in result.all():
    out = []
    for row in result.all():
        b = row.Bounty
        count = row.submission_count
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for b, count in rows:
        out.append(BountyResponse(**b.__dict__, submission_count=count))

    rows = result.all()
    out = []
    for b, sub_count in rows:
        out.append(BountyResponse(**b.__dict__, submission_count=sub_count or 0))
    out = []
    for bounty, count in result.all():
        out.append(BountyResponse(**bounty.__dict__, submission_count=count))
    return out


@router.post("/submit", response_model=SubmissionResponse)
async def submit_review(
    body: SubmissionCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Bounty).where(Bounty.id == body.bounty_id))
    bounty = result.scalar_one_or_none()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    if bounty.status != "open":
        raise HTTPException(status_code=400, detail="Bounty is not open")
    if bounty.creator_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot submit to your own bounty")

    submission = BountySubmission(
        bounty_id=body.bounty_id,
        submitter_id=current_user["user_id"],
        review_text=body.review_text,
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    background_tasks.add_task(
        _notify_user,
        db,
        bounty.creator_id,
        f"New review submission on your bounty: {bounty.paper_title or 'your paper'}",
        f"/bounties/{bounty.id}",
    )
    return submission


@router.post("/{bounty_id}/award")
async def award_bounty(
    bounty_id: str,
    body: AwardRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Award the bounty to a specific submission."""
    bounty_result = await db.execute(select(Bounty).where(Bounty.id == bounty_id))
    bounty = bounty_result.scalar_one_or_none()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    if bounty.creator_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the bounty creator can award it")
    if bounty.status != "open":
        raise HTTPException(status_code=400, detail="Bounty already closed")

    sub_result = await db.execute(
        select(BountySubmission).where(BountySubmission.id == body.submission_id)
    )
    submission = sub_result.scalar_one_or_none()
    if not submission or submission.bounty_id != bounty_id:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.is_winner = True
    bounty.status = "awarded"
    bounty.awarded_to_user_id = submission.submitter_id
    bounty.awarded_at = datetime.utcnow()
    await db.commit()

    background_tasks.add_task(
        _notify_user,
        db,
        submission.submitter_id,
        f"You won a bounty of {bounty.amount_kes} KES + {bounty.reputation_points} rep points!",
        f"/bounties/{bounty_id}",
    )
    return {"status": "awarded", "winner_id": submission.submitter_id}
