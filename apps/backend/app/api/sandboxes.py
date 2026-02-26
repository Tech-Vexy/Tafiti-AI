"""
Institutional Sandboxes API
============================
Closed, branded workspaces scoped to a university or event.
All members share a private research space with role-based access.
Admins generate a short invite code; participants join using it.
"""

import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.models.database import InstitutionalSandbox, SandboxMember, User
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("sandboxes")
router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SandboxCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    institution: str = Field(..., min_length=3, max_length=300)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    is_public: bool = False
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None


class SandboxResponse(BaseModel):
    id: str
    name: str
    institution: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    invite_code: str
    is_public: bool
    admin_user_id: str
    event_start: Optional[datetime] = None
    event_end: Optional[datetime] = None
    created_at: datetime
    member_count: int = 0

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    user_id: str
    username: Optional[str] = None
    university: Optional[str] = None
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True


class JoinRequest(BaseModel):
    invite_code: str


class RoleUpdate(BaseModel):
    user_id: str
    role: str = Field(..., pattern="^(admin|mentor|participant)$")


# ─── Helper ───────────────────────────────────────────────────────────────────

def _generate_invite_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=SandboxResponse)
async def create_sandbox(
    body: SandboxCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Ensure invite code is unique
    for _ in range(5):
        code = _generate_invite_code()
        existing = await db.execute(
            select(InstitutionalSandbox).where(InstitutionalSandbox.invite_code == code)
        )
        if not existing.scalar_one_or_none():
            break

    sandbox = InstitutionalSandbox(
        name=body.name,
        institution=body.institution,
        description=body.description,
        logo_url=body.logo_url,
        admin_user_id=current_user["user_id"],
        invite_code=code,
        is_public=body.is_public,
        event_start=body.event_start,
        event_end=body.event_end,
    )
    db.add(sandbox)
    await db.flush()  # get sandbox.id before adding member

    # Admin is also a member with role "admin"
    db.add(SandboxMember(
        sandbox_id=sandbox.id,
        user_id=current_user["user_id"],
        role="admin",
    ))
    await db.commit()
    await db.refresh(sandbox)
    return SandboxResponse(**sandbox.__dict__, member_count=1)


@router.get("/", response_model=List[SandboxResponse])
async def list_my_sandboxes(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sandboxes the current user is a member of."""
    result = await db.execute(
        select(SandboxMember).where(SandboxMember.user_id == current_user["user_id"])
    )
    memberships = result.scalars().all()

    out = []
    for m in memberships:
        sb_result = await db.execute(
            select(InstitutionalSandbox).where(InstitutionalSandbox.id == m.sandbox_id)
        )
        sb = sb_result.scalar_one_or_none()
        if not sb:
            continue
        count_result = await db.execute(
            select(SandboxMember).where(SandboxMember.sandbox_id == sb.id)
        )
        count = len(count_result.scalars().all())
        out.append(SandboxResponse(**sb.__dict__, member_count=count))
    return out


@router.post("/join", response_model=SandboxResponse)
async def join_sandbox(
    body: JoinRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InstitutionalSandbox).where(
            InstitutionalSandbox.invite_code == body.invite_code.upper()
        )
    )
    sandbox = result.scalar_one_or_none()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    # Check if event window is still open
    if sandbox.event_end and datetime.utcnow() > sandbox.event_end:
        raise HTTPException(status_code=410, detail="This sandbox event has ended")

    # Check already a member
    existing = await db.execute(
        select(SandboxMember).where(
            SandboxMember.sandbox_id == sandbox.id,
            SandboxMember.user_id == current_user["user_id"],
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member of this sandbox")

    db.add(SandboxMember(
        sandbox_id=sandbox.id,
        user_id=current_user["user_id"],
        role="participant",
    ))
    await db.commit()

    count_result = await db.execute(
        select(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = len(count_result.scalars().all())
    return SandboxResponse(**sandbox.__dict__, member_count=count)


@router.get("/{sandbox_id}/members", response_model=List[MemberResponse])
async def get_members(
    sandbox_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify requester is a member
    check = await db.execute(
        select(SandboxMember).where(
            SandboxMember.sandbox_id == sandbox_id,
            SandboxMember.user_id == current_user["user_id"],
        )
    )
    if not check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this sandbox")

    result = await db.execute(
        select(SandboxMember).where(SandboxMember.sandbox_id == sandbox_id)
    )
    members = result.scalars().all()

    out = []
    for m in members:
        user_result = await db.execute(select(User).where(User.id == m.user_id))
        user = user_result.scalar_one_or_none()
        out.append(MemberResponse(
            user_id=m.user_id,
            username=user.username if user else None,
            university=user.university if user else None,
            role=m.role,
            joined_at=m.joined_at,
        ))
    return out


@router.patch("/{sandbox_id}/members/role")
async def update_member_role(
    sandbox_id: str,
    body: RoleUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: change a member's role."""
    check = await db.execute(
        select(SandboxMember).where(
            SandboxMember.sandbox_id == sandbox_id,
            SandboxMember.user_id == current_user["user_id"],
            SandboxMember.role == "admin",
        )
    )
    if not check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only sandbox admins can change roles")

    target = await db.execute(
        select(SandboxMember).where(
            SandboxMember.sandbox_id == sandbox_id,
            SandboxMember.user_id == body.user_id,
        )
    )
    member = target.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = body.role
    await db.commit()
    return {"status": "updated", "user_id": body.user_id, "role": body.role}
