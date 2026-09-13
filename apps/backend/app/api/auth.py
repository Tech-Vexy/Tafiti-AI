from fastapi import APIRouter, Depends, HTTPException, status
from app.core.timeutil import utcnow
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

from app.db.session import get_db
from app.models.database import User, UserSettings
from app.models.schemas import (
    UserResponse, UserUpdate,
    UserSettingsResponse, UserSettingsUpdate
)
from app.core.config import settings as app_settings
from app.core.security import get_current_user
from app.core.logger import get_logger
import traceback

logger = get_logger("auth_api")

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        logger.info(f"Fetching profile for user: {current_user['user_id']}")
        result = await db.execute(select(User).where(User.id == current_user["user_id"]))
        user = result.scalar_one_or_none()
        
        if not user:
            logger.info(f"User {current_user['user_id']} not found, creating record...")
            logger.info(f"Current user data for creation: {current_user}")
            try:
                now = utcnow()
                email = current_user.get("email") or ""
                # Admin auto-assignment: known admin email always gets superuser on first login
                ADMIN_EMAILS = set(app_settings.ADMIN_EMAILS)
                is_admin = email.lower() in ADMIN_EMAILS

                # New users start with a 7-day trial recorded in the database
                user = User(
                    id=current_user["user_id"],
                    username=current_user.get("username") or email or f"Researcher_{current_user['user_id'][:8]}",
                    email=email or None,
                    created_at=now,
                    subscription_status="trialing",
                    trial_ends_at=now + timedelta(days=7),
                    is_superuser=is_admin,
                )
                db.add(user)
                settings = UserSettings(user_id=user.id)
                db.add(settings)
                await db.commit()
                await db.refresh(user)
                logger.info(f"User {user.id} created successfully with database trial ending {user.trial_ends_at}.")
            except Exception as create_error:
                logger.error(f"Failed to create user record: {create_error}")
                await db.rollback()
                raise create_error
        else:
            # Sync trial status against database timestamps
            now = utcnow()
            if not user.trial_ends_at and user.subscription_status != "active":
                user.subscription_status = "trialing"
                user.trial_ends_at = (user.created_at or now) + timedelta(days=7)
                await db.commit()
                await db.refresh(user)
            elif user.subscription_status == "trialing" and user.trial_ends_at and user.trial_ends_at < now:
                user.subscription_status = "expired"
                await db.commit()
                await db.refresh(user)
        
        # Calculate real-time metrics using a single batched query with scalar subqueries.
        try:
            from sqlalchemy import func
            from app.models.database import SavedPaper, Note, SavedQuery, Notification

            sq_publications = select(func.count(SavedPaper.id)).where(SavedPaper.user_id == user.id).scalar_subquery()
            sq_citations = select(func.sum(SavedPaper.citations)).where(SavedPaper.user_id == user.id).scalar_subquery()
            sq_queries = select(func.count(SavedQuery.id)).where(SavedQuery.user_id == user.id).scalar_subquery()
            sq_notes = select(func.count(Note.id)).where(Note.user_id == user.id).scalar_subquery()
            sq_notifications = select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.is_read.is_(False)).scalar_subquery()

            metrics_result = await db.execute(
                select(sq_publications, sq_citations, sq_queries, sq_notes, sq_notifications)
            )
            row = metrics_result.fetchone()

            if row:
                user.publications_count = int(row[0] or 0)
                user.citation_count = int(row[1] or 0)
                user.interest_score = int((row[2] or 0) + (row[3] or 0))
                user.notification_count = int(row[4] or 0)
            else:
                user.publications_count = 0
                user.citation_count = 0
                user.interest_score = 0
                user.notification_count = 0
        except Exception as metrics_error:
            logger.error(f"Error calculating metrics for user {user.id}: {metrics_error}")
            # Ensure attributes exist even if query fails
            user.citation_count = getattr(user, 'citation_count', 0)
            user.publications_count = 0
            user.interest_score = getattr(user, 'interest_score', 0)
            user.notification_count = 0
        
        return user
    except Exception as e:
        logger.error(f"Failed to fetch user profile: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving your profile"
        )


@router.put("/me", response_model=UserResponse)
async def update_user(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_update.bio:
        user.bio = user_update.bio
    if user_update.university:
        user.university = user_update.university
    if user_update.expertise_areas is not None:
        user.expertise_areas = user_update.expertise_areas
    if user_update.career_field:
        user.career_field = user_update.career_field
    
    # Note: Password updates handled by Clerk, removed here
    
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user["user_id"])
    )
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = UserSettings(user_id=current_user["user_id"])
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return settings


@router.post("/start-trial", response_model=UserResponse)
async def start_trial(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Starts the 7-day free trial for a user whose status is 'inactive'.
    Idempotent: calling it again while already trialing or active is a no-op.
    """
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Already on a paid plan — do nothing
    if user.subscription_status == "active":
        return user

    # Already trialing — return as-is (idempotent)
    if user.subscription_status == "trialing" and user.trial_ends_at:
        return user

    # Start the trial
    now = utcnow()
    user.subscription_status = "trialing"
    user.trial_ends_at = now + timedelta(days=7)
    await db.commit()
    await db.refresh(user)
    logger.info(f"Trial started for user {user.id} — ends {user.trial_ends_at}")
    return user


@router.put("/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    settings_update: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user["user_id"])
    )
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = UserSettings(user_id=current_user["user_id"])
        db.add(settings)
    
    update_data = settings_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings
