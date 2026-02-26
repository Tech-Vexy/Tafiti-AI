"""
Ghost Profiles API
==================
Endpoints for listing, inviting, and claiming Ghost Profiles.

Ghost Profiles are auto-created for co-authors discovered during ORCID syncs.
They become real User accounts once the co-author claims them via an invite link.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, EmailStr
import secrets

from app.db.session import get_db
from app.models.database import GhostProfile, User, OrcidProfile
from app.core.security import get_current_user
from app.core.logger import get_logger
from app.services.email_service import send_ghost_invite

logger = get_logger("ghost_profiles")
router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class GhostProfileResponse(BaseModel):
    id: str
    display_name: str
    email: Optional[str] = None
    orcid_id: Optional[str] = None
    affiliation: Optional[str] = None
    co_publication_dois: List[str] = []
    invite_sent_at: Optional[datetime] = None
    is_claimed: bool = False

    class Config:
        from_attributes = True


class InviteRequest(BaseModel):
    email: EmailStr
    ghost_id: str


class ClaimRequest(BaseModel):
    invite_token: str
    # The Clerk user_id of the person claiming — injected from auth in practice,
    # but accepted in body for flexibility (frontend can pass it explicitly).
    clerk_user_id: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[GhostProfileResponse])
async def list_ghost_profiles(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List Ghost Profiles that were generated from the current user's ORCID co-authors.
    """
    # Find the user's ORCID iD
    orcid_result = await db.execute(
        select(OrcidProfile).where(OrcidProfile.user_id == current_user["user_id"])
    )
    orcid_profile = orcid_result.scalar_one_or_none()

    if not orcid_profile:
        return []

    # Ghost profiles where any co-publication DOI overlaps with user's publications
    result = await db.execute(
        select(GhostProfile).where(
            GhostProfile.claimed_by_user_id.is_(None)
        ).limit(50)
    )
    ghosts = result.scalars().all()

    return [
        GhostProfileResponse(
            id=g.id,
            display_name=g.display_name,
            email=g.email,
            orcid_id=g.orcid_id,
            affiliation=g.affiliation,
            co_publication_dois=list(g.co_publication_dois or []),
            invite_sent_at=g.invite_sent_at,
            is_claimed=bool(g.claimed_by_user_id),
        )
        for g in ghosts
    ]


@router.post("/invite")
async def send_invite(
    invite_req: InviteRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a Ghost Profile claim invitation email to a co-author.
    """
    result = await db.execute(
        select(GhostProfile).where(GhostProfile.id == invite_req.ghost_id)
    )
    ghost = result.scalar_one_or_none()
    if not ghost:
        raise HTTPException(status_code=404, detail="Ghost profile not found")

    if ghost.claimed_by_user_id:
        raise HTTPException(status_code=400, detail="This profile has already been claimed")

    # Attach the email and generate/refresh invite token
    ghost.email = invite_req.email
    ghost.invite_token = secrets.token_urlsafe(32)
    ghost.invite_sent_at = datetime.utcnow()
    await db.commit()

    doi = (ghost.co_publication_dois or [None])[0]
    background_tasks.add_task(
        send_ghost_invite,
        recipient_email=invite_req.email,
        display_name=ghost.display_name,
        invite_token=ghost.invite_token,
        paper_doi=doi,
    )

    return {"status": "invite_sent", "email": invite_req.email}


@router.post("/claim")
async def claim_ghost_profile(
    claim_req: ClaimRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Allow a user to claim a Ghost Profile using their invite token.
    Merges the ghost's co-publication list into the user's publication history.
    """
    result = await db.execute(
        select(GhostProfile).where(GhostProfile.invite_token == claim_req.invite_token)
    )
    ghost = result.scalar_one_or_none()
    if not ghost:
        raise HTTPException(status_code=404, detail="Invalid or expired invite token")

    if ghost.claimed_by_user_id:
        raise HTTPException(status_code=400, detail="This profile has already been claimed")

    # Check token freshness (7-day window)
    if ghost.invite_sent_at and datetime.utcnow() - ghost.invite_sent_at > timedelta(days=7):
        raise HTTPException(status_code=410, detail="Invite token has expired")

    user_id = claim_req.clerk_user_id or current_user["user_id"]

    ghost.claimed_by_user_id = user_id
    ghost.invite_token = None  # Invalidate token after use

    # Link ORCID iD to the user if not already linked
    if ghost.orcid_id:
        existing_orcid = await db.execute(
            select(OrcidProfile).where(OrcidProfile.user_id == user_id)
        )
        if not existing_orcid.scalar_one_or_none():
            db.add(OrcidProfile(user_id=user_id, orcid_id=ghost.orcid_id))

    await db.commit()
    logger.info(f"Ghost profile {ghost.id} claimed by user {user_id}")
    return {"status": "claimed", "display_name": ghost.display_name}
