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
from sqlalchemy import select, func
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy import select, func
from sqlalchemy.orm import aliased
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
    # Performance Optimization: Single query replacing 1+2N queries for sandboxes and member counts.
    subq = (
        select(func.count())
        .select_from(SandboxMember)
    # ⚡ Bolt: Fix N+1 query issue for counting sandbox members
    subq = (
        select(func.count(SandboxMember.user_id))
    # Bolt Optimization: Fetch all sandboxes for user along with member count using single query + subquery
    SandboxMemberAlias = aliased(SandboxMember)
    member_count_subq = (
        select(func.count(SandboxMemberAlias.id))
        .where(SandboxMemberAlias.sandbox_id == InstitutionalSandbox.id)
        .correlate(InstitutionalSandbox)
        .scalar_subquery()
    )

    result = await db.execute(
        select(InstitutionalSandbox, member_count_subq.label("member_count"))
    # ⚡ Bolt Optimization: Removed N+1 query loop for fetching sandboxes and member counts.
    # Uses scalar_subquery to fetch member_count and fetches all sandboxes in a single query.
    member_count_subquery = (
        select(func.count(SandboxMember.user_id))
    # BOLT: Replaced N+1 loop with a single joined query using scalar_subquery to compute the member count.
    # Impact: Reduces queries from 1 + 2N to a single query, significantly improving list load times.
    subquery = (
        select(func.count())
        .select_from(SandboxMember)
        .where(SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .correlate(InstitutionalSandbox)
        .scalar_subquery()
    )
    result = await db.execute(
        select(InstitutionalSandbox, subquery)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    rows = result.all()
    out = [SandboxResponse(**sb.__dict__, member_count=count) for sb, count in rows]
    # ⚡ Bolt: optimized N+1 query and memory usage by using scalar_subquery
    subq = (
        select(func.count(SandboxMember.user_id))
    # Performance Optimization: eliminate N+1 queries. We calculate the member count
    # via a scalar subquery and join so we don't have to repeatedly query inside the loop.
    member_alias = aliased(SandboxMember)
    member_count_sq = (
        select(func.count(member_alias.id))
        .where(member_alias.sandbox_id == InstitutionalSandbox.id)
        .scalar_subquery()
        .correlate(InstitutionalSandbox)
    )

    result = await db.execute(
        select(InstitutionalSandbox, member_count_sq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    rows = result.all()

    out = []
    for sb, count in rows:
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))
    # Optimized: Join SandboxMember and InstitutionalSandbox to avoid N+1 queries,
    # and use a scalar subquery to get the member count.
    sub_count_query = (
        select(func.count())
        .select_from(SandboxMember)
    from sqlalchemy import func
    from sqlalchemy.orm import aliased
    # ⚡ Bolt Optimization: Resolved N+1 query for sandboxes and member counts
    # Replaced loop with a single query using an inner join and correlated subquery
    member_alias = aliased(SandboxMember)
    subq = (
        select(func.count(member_alias.id))
        .where(member_alias.sandbox_id == InstitutionalSandbox.id)
    # ⚡ Bolt Optimization: Fix N+1 query by computing member counts in a scalar subquery
    subq = (
        select(func.count(SandboxMember.id))
    # ⚡ Bolt: Optimize N+1 queries by fetching sandboxes and member counts in a single query
    from sqlalchemy.orm import aliased
    MemberAlias = aliased(SandboxMember)
    subq = (
        select(func.count())
        .select_from(MemberAlias)
        .where(MemberAlias.sandbox_id == InstitutionalSandbox.id)
        .correlate(InstitutionalSandbox)
        .scalar_subquery()
    )
    result = await db.execute(
        select(InstitutionalSandbox, subq)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    rows = result.all()
    return [SandboxResponse(**sb.__dict__, member_count=count or 0) for sb, count in rows]
    # ⚡ Bolt: Mitigation of N+1 queries. Used scalar_subquery with func.count and .correlate()
    # to combine the loop fetching sandboxes and member counts into a single query.
    subq = (
        select(func.count())
        .select_from(SandboxMember)
    # BOLT OPTIMIZATION: Replaced multiple scalar queries and len(scalars().all())
    # with a single JOIN query containing a scalar subquery for member counts to fix N+1 issue.
    subq = (
        select(func.count(SandboxMember.id))
    # ⚡ Bolt Optimization: Use a single query with scalar_subquery to fetch sandboxes and count members, preventing N+1 queries.
    subq = (
        select(func.count(SandboxMember.id))
    # ⚡ Bolt: Optimize N+1 and len() count query using scalar subqueries
    subq = (
        select(func.count(SandboxMember.sandbox_id))

    # ⚡ BOLT OPTIMIZATION:
    # Replaced an inefficient Python loop generating multiple N+1 queries
    # (one to get sandbox info, another to get `len(result.scalars().all())` count)
    # with a single batched query using JOIN and correlated scalar subquery.
    member_alias = aliased(SandboxMember)
    count_subq = (
        select(func.count(member_alias.id))
        .where(member_alias.sandbox_id == InstitutionalSandbox.id)
    # ⚡ Bolt: Optimized N+1 query. Replaced per-sandbox scalar count query inside loop
    # with a single join and correlated scalar subquery for member counting.
    member_alias = aliased(SandboxMember)
    member_count_subquery = (
        select(func.count())
        .select_from(member_alias)
        .where(member_alias.sandbox_id == InstitutionalSandbox.id)
    # ⚡ Bolt: Use scalar_subquery to batch sandbox member counts and prevent N+1 queries.
    member_count_query = (
        select(func.count())
        .select_from(SandboxMember)
    # Bolt: optimized by resolving N+1 with a join and correlated scalar subquery for member counts
    subq = (
        select(func.count(SandboxMember.id))
    # Performance optimization: Replace nested loop N+1 queries fetching
    # individual sandboxes and then their members count using `len(result.scalars().all())`
    # with a single SQL statement.
    SandboxMemberAlias = aliased(SandboxMember)
    member_count_subq = (
        select(func.count(SandboxMemberAlias.id))
        .where(SandboxMemberAlias.sandbox_id == InstitutionalSandbox.id)
    # ⚡ BOLT OPTIMIZATION: Replaced N+1 queries in loop with a single query using scalar_subquery
    # Expected impact: Reduces database queries from O(N) to O(1), improving response time significantly.
    member_count_subq = (
        select(func.count(SandboxMember.id))
    # OPTIMIZATION: Resolves N+1 queries. Uses `func.count()` with `scalar_subquery()`
    # and `.correlate(InstitutionalSandbox)` to retrieve sandboxes and member counts in a single query.
    # This prevents auto-correlation issues and replaces iterating with DB queries inside a loop.
    member_count_subq = (
        select(func.count(SandboxMember.id))
    # PERFORMANCE OPTIMIZATION: Resolves N+1 query and memory inefficiency.
    # Previously, this executed 1 query for memberships, and then 2 queries
    # per sandbox (one to fetch sandbox, one to fetch ALL members to count them).
    # Using a scalar_subquery with func.count() allows us to fetch everything
    # in a single query and prevents loading entire objects into memory just for a count.
    sm_count_alias = aliased(SandboxMember)
    subquery = (
        select(func.count(sm_count_alias.id))
        .where(sm_count_alias.sandbox_id == InstitutionalSandbox.id)
    # ⚡ Bolt Optimization: Use scalar_subquery with func.count() to avoid N+1 query loops.
    # Prevents executing a separate `len(count_result.scalars().all())` count query for every sandbox.
    member_count_subq = (
        select(func.count(SandboxMember.id))
    # Bolt Optimization: Batch queries to avoid N+1 and memory bloat
    subq = (
        select(func.count())
        .where(SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .correlate(InstitutionalSandbox)
        .scalar_subquery()
    )
    result = await db.execute(
        select(InstitutionalSandbox, subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    rows = result.all()
    out = []
    for sb, count in rows:
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))
    sb_result = await db.execute(
        select(InstitutionalSandbox, subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    results = sb_result.all()

    out = [SandboxResponse(**sb.__dict__, member_count=count) for sb, count in results]

    result = await db.execute(
        select(InstitutionalSandbox, member_count_subquery)
        .join(SandboxMember, InstitutionalSandbox.id == SandboxMember.sandbox_id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    stmt = (
        select(InstitutionalSandbox, subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for sb, count in rows:
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))
    result = await db.execute(
        select(InstitutionalSandbox, sub_count_query)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    sandboxes_with_counts = result.all()
    result = await db.execute(
        select(InstitutionalSandbox, subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    rows = result.all()

    rows = result.all()
    out = []
    result = await db.execute(
        select(InstitutionalSandbox, subq.label("member_count"))
    result = await db.execute(
        select(InstitutionalSandbox, subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    result = await db.execute(
        select(InstitutionalSandbox, subq)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    rows = result.all()
    out = []
    for sb, count in rows:
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))

    result = await db.execute(
        select(InstitutionalSandbox, subq)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    out = []
    for sb, count in result.all():
        select(InstitutionalSandbox, subq.label("member_count"))
        select(InstitutionalSandbox, count_subq.label('member_count'))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    rows = result.all()

    out = []
    for sb, count in rows:
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))
    query = (
        select(InstitutionalSandbox, member_count_subquery)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    result = await db.execute(query)

    out = []
    for sb, count in result.all():
    # ⚡ Bolt: Also join with the target tables to fetch all at once instead of individual fetches in a loop.
    result = await db.execute(
        select(InstitutionalSandbox, member_count_query.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    out = []
    for row in result.all():
        sb, count = row
    # We need to find sandboxes the user is a member of
    user_memberships_subq = (
        select(SandboxMember.sandbox_id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    result = await db.execute(
        select(InstitutionalSandbox, subq.label("member_count"))
        .where(InstitutionalSandbox.id.in_(user_memberships_subq))
    )
    result = await db.execute(
        select(InstitutionalSandbox, member_count_subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    sandboxes_with_counts = result.all()

    out = []
    for sb, count in sandboxes_with_counts:

    rows = result.all()

    rows = result.all()
    out = []
    for sb, count in sandboxes_with_counts:
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))
    for m in memberships:
        sb_result = await db.execute(
            select(InstitutionalSandbox).where(InstitutionalSandbox.id == m.sandbox_id)
        )
        sb = sb_result.scalar_one_or_none()
        if not sb:
            continue
        # ⚡ Bolt: Optimize member count query to avoid fetching all records into memory
        count_result = await db.execute(
            select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sb.id)
        )
        count = count_result.scalar() or 0
        # ⚡ Bolt Optimization: Use explicit func.count() instead of len(result.scalars().all()) to avoid loading all rows into memory (N+1 query issue).
        count = await db.scalar(
            select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sb.id)
        )
        # ⚡ Bolt: Use func.count() to avoid loading all member objects into memory
        count_result = await db.execute(
            select(func.count(SandboxMember.user_id)).where(SandboxMember.sandbox_id == sb.id)
        )
        count = count_result.scalar() or 0
        # ⚡ Bolt Optimization: Use SQL COUNT instead of loading all members into Python memory to count them
        # Expected Impact: Eliminates N+1 query memory bloat for large sandboxes
        count = await db.scalar(
            select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sb.id)
        )
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))
    stmt = (
        select(InstitutionalSandbox, member_count_subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    query = (
        select(InstitutionalSandbox, subquery.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    result = await db.execute(query)
    rows = result.all()

    out = []
    result = await db.execute(
        select(InstitutionalSandbox, member_count_subq)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    rows = result.all()

    out = []
        select(InstitutionalSandbox, subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    out = []
    for sb, count in result.all():
    # ⚡ Bolt: Optimized N+1 query and memory bloat.
    # Replaced loop-based queries and `len(result.scalars().all())` with a scalar subquery
    # and func.count() to compute member counts directly in the database.
    subq = (
        select(func.count(SandboxMember.user_id))
        .where(SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .scalar_subquery()
        .label("member_count")
    )

    result = await db.execute(
        select(InstitutionalSandbox, subq)
        .where(
            InstitutionalSandbox.id.in_(
                select(SandboxMember.sandbox_id).where(SandboxMember.user_id == current_user["user_id"])
            )
        )
    )

    out = []
    for row in result.all():
        sb = row.InstitutionalSandbox
        count = row.member_count
    # Performance Optimization:
    # Use a single query with a scalar subquery for member count, eliminating the
    # N+1 queries previously done inside a python loop.
    count_subquery = (
        select(func.count(SandboxMember.user_id))
        .where(SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .correlate(InstitutionalSandbox)
    # Optimization: Replaced N+1 queries using scalar_subquery to batch member count calculation
    # Expected impact: Reduced database roundtrips and memory bloat from looping over memberships
    subq = (
        select(func.count(SandboxMember.id))
        .where(SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .scalar_subquery()
    )

    stmt = (
        select(InstitutionalSandbox, count_subquery.label("member_count"))
        select(InstitutionalSandbox, subq.label("member_count"))
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )

    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for sb, count in rows:
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

    # Performance Optimization: Calculate count without loading all records into memory
    # ⚡ Bolt: Fix N+1 issue for fetching sandbox member count
    count = await db.scalar(
        select(func.count(SandboxMember.user_id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    return SandboxResponse(**sandbox.__dict__, member_count=count or 0)
    # Bolt Optimization: Use scalar to count members without fetching all to memory
    count = await db.scalar(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    return SandboxResponse(**sandbox.__dict__, member_count=count or 0)
    # ⚡ Bolt Optimization: Replaced fetching all objects into memory to count them
    # with explicit aggregation via func.count() at the DB level.
    count_result = await db.execute(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar()
    # ⚡ Bolt: optimized member count by using explicit aggregation
    count_result = await db.execute(
        select(func.count(SandboxMember.user_id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0
    # Performance Optimization: Explicit aggregation instead of counting ORM objects length
    count = await db.scalar(
        select(func.count(SandboxMember.id))
        .where(SandboxMember.sandbox_id == sandbox.id)
    )
    return SandboxResponse(**sandbox.__dict__, member_count=count or 0)
    # Optimized: Explicit aggregation with func.count()
    count_result = await db.execute(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0
    from sqlalchemy import func
    # ⚡ Bolt Optimization: Replaced fetching all objects just to count them with an aggregate count query
    count = await db.scalar(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    # ⚡ Bolt Optimization: Replace len(all()) with scalar func.count()
    count = await db.scalar(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    # ⚡ Bolt: Optimize single count query using database aggregation instead of fetching all records
    count_result = await db.execute(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0
    # ⚡ Bolt: Avoid loading all SandboxMember rows into memory just for a count.
    # Replaced len(result.scalars().all()) with explicit count query using func.count().
    # ⚡ Bolt: Optimize member count query to avoid fetching all records into memory
    count_result = await db.execute(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0
    # BOLT OPTIMIZATION: Replaced len(result.scalars().all()) with func.count()
    # for faster singular querying that does not pull rows into memory
    count_result = await db.execute(
        select(func.count(SandboxMember.id))
        .where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0
    # ⚡ Bolt Optimization: Use explicit func.count() to calculate count efficiently in database rather than fetching all rows into memory.
    count = await db.scalar(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    # ⚡ Bolt Optimization: Use func.count() and .scalar() for singular count queries instead of fetching all records.
    count = await db.execute(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count.scalar() or 0
    # ⚡ Bolt: Use explicitly aggregated select scalar over len(all())
    count = await db.scalar(
        select(func.count(SandboxMember.sandbox_id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    # ⚡ BOLT OPTIMIZATION:
    # Replaced inefficient `len(result.scalars().all())` which materializes all records
    # with `select(func.count())` which only executes logic at database level.
    count = await db.execute(
        select(func.count(SandboxMember.id))
        .where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count.scalar() or 0
    # ⚡ Bolt: Fixed unoptimized record count. Replaced len(result.scalars().all())
    # with explicit aggregation via func.count() to reduce memory usage and query payload.
    count = (await db.execute(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )).scalar()
    # ⚡ Bolt: Use func.count() to avoid loading all member objects into memory
    count_result = await db.execute(
        select(func.count(SandboxMember.user_id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0
    # ⚡ Bolt: Optimize row count query.
    count_result = await db.execute(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0
    # Bolt: optimized by replacing 'len(all())' with explicit database aggregation (func.count)
    count = await db.scalar(
        select(func.count())
        .select_from(SandboxMember)
        .where(SandboxMember.sandbox_id == sandbox.id)
    )
    return SandboxResponse(**sandbox.__dict__, member_count=count or 0)
    )
    )
    # Performance optimization: Used explicit DB count instead of loading all models into memory to count list
    count_result = await db.execute(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar()
    # ⚡ Bolt Optimization: Calculate count in database to prevent loading all members into memory
    # Expected Impact: O(1) memory usage instead of O(N) when joining
    count = await db.scalar(
        select(func.count()).select_from(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    return SandboxResponse(**sandbox.__dict__, member_count=count or 0)
    # ⚡ BOLT OPTIMIZATION: Avoid loading all members into memory just to count them.
    # Expected impact: Reduced memory usage and faster single scalar query execution.
    count = await db.scalar(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    # OPTIMIZATION: Resolves inefficient record count query by using `func.count(...)`
    # and `.scalar_one()` directly instead of fetching all records and using `len(...)`
    # PERFORMANCE OPTIMIZATION: Replaced len(result.scalars().all()) with
    # direct func.count() query to prevent loading all SandboxMember
    # objects into memory just to get the count.
    # ⚡ Bolt Optimization: Use func.count() directly instead of loading all objects just to count them
    # Bolt Optimization: Prevent memory bloat from loading all records to count
    count_result = await db.execute(
        select(func.count()).where(SandboxMember.sandbox_id == sandbox.id)
    # ⚡ Bolt: Optimized in-memory counting.
    # Replaced `len(result.scalars().all())` with an efficient DB-level COUNT.
    count_result = await db.execute(
        select(func.count(SandboxMember.user_id))
        .where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar()
    # Performance Optimization:
    # Get the count directly via func.count() instead of pulling all rows into python memory.
    count_result = await db.execute(
        select(func.count(SandboxMember.user_id)).where(SandboxMember.sandbox_id == sandbox.id)
    # Optimization: Replaced len(result.scalars().all()) with select(func.count())
    # Expected impact: Faster execution time by avoiding fetching all rows into memory to count them
    count_result = await db.execute(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar_one()
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

    # ⚡ Bolt Optimization: Use joinedload to fetch associated users in a single query,
    # preventing an N+1 query problem when iterating over members.
    result = await db.execute(
        select(SandboxMember)
        .options(joinedload(SandboxMember.user))
        .where(SandboxMember.sandbox_id == sandbox_id)
    )
    members = result.scalars().all()

    out = []
    for m in members:
        user = m.user
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
