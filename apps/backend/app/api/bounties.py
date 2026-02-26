"""
Micro-Bounties API
==================
Researchers post financial or reputation bounties on papers they want reviewed.
Other researchers submit reviews. The bounty creator awards the winner.
Payment is processed via Paystack (KES).
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
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
    result = await db.execute(
        select(Bounty)
        .where(Bounty.status == status, Bounty.funded == True)  # noqa: E712
        .order_by(desc(Bounty.created_at))
        .limit(limit)
    )
    bounties = result.scalars().all()
    out = []
    for b in bounties:
        sub_count_res = await db.execute(
            select(BountySubmission).where(BountySubmission.bounty_id == b.id)
        )
        count = len(sub_count_res.scalars().all())
        out.append(BountyResponse(**b.__dict__, submission_count=count))
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
