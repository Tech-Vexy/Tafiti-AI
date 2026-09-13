"""
Subscription / trial enforcement dependency.

Usage in router:
    from app.core.subscription import require_trial_or_active

    @router.post("/synthesize/stream")
    async def endpoint(
        ...,
        _: dict = Depends(require_trial_or_active),
    ):
"""
from datetime import timedelta

from app.core.timeutil import utcnow
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.database import User
from app.core.logger import get_logger

logger = get_logger("subscription")

# HTTP 402 Payment Required — used for trial/subscription gates
PAYMENT_REQUIRED = status.HTTP_402_PAYMENT_REQUIRED


async def require_trial_or_active(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Allows access only when the user meets ONE of:
      • is_superuser  → always allowed (admin bypass)
      • subscription_status == 'active'  → paid subscriber
      • subscription_status == 'trialing' AND trial_ends_at > utcnow()  → active trial

    Raises HTTP 402 otherwise so the frontend can show a specific upgrade prompt.
    """
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()

    if not user:
        now = utcnow()
        user = User(
            id=current_user["user_id"],
            username=current_user.get("username") or current_user.get("email") or f"Researcher_{current_user['user_id'][:8]}",
            email=current_user.get("email"),
            created_at=now,
            subscription_status="trialing",
            trial_ends_at=now + timedelta(days=7),
            is_superuser=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return current_user

    # ── Admin bypass ──────────────────────────────────────────────────────────
    if user.is_superuser:
        logger.debug(f"Admin bypass for user {user.id}")
        return current_user

    # ── Active paid subscription ───────────────────────────────────────────────
    if user.subscription_status == "active":
        return current_user

    # ── Valid trial period ────────────────────────────────────────────────────
    if (
        user.subscription_status == "trialing"
        and user.trial_ends_at is not None
        and user.trial_ends_at > utcnow()
    ):
        return current_user

    # ── Trial expired ─────────────────────────────────────────────────────────
    if user.subscription_status == "trialing" and (
        user.trial_ends_at is None or user.trial_ends_at <= utcnow()
    ):
        logger.info(f"Trial expired for user {user.id} — blocking premium feature")
        raise HTTPException(
            status_code=PAYMENT_REQUIRED,
            detail=(
                "Your 7-day free trial has expired. "
                "Subscribe to continue using synthesis and gap analysis."
            ),
        )

    # ── Trial not started / inactive account ──────────────────────────────────
    logger.info(f"No active trial/subscription for user {user.id} (status={user.subscription_status})")
    raise HTTPException(
        status_code=PAYMENT_REQUIRED,
        detail="Start your free 7-day trial to access this feature.",
    )
