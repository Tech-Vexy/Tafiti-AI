from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.database import User, UserSettings
from app.models.schemas import (
    UserResponse, UserUpdate, 
    UserSettingsResponse, UserSettingsUpdate
)
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
                now = datetime.utcnow()
                trial_days = 7
                email = current_user.get("email") or ""
                # Admin auto-assignment: known admin email always gets superuser on first login
                ADMIN_EMAILS = {"eveliaveldrine@gmail.com"}
                is_admin = email.lower() in ADMIN_EMAILS

                # New users start as "inactive" (no trial yet).
                # They must explicitly click "Start Trial" to begin the 7-day period.
                user = User(
                    id=current_user["user_id"],
                    username=current_user.get("username") or email or f"Researcher_{current_user['user_id'][:8]}",
                    email=email or None,
                    created_at=now,
                    subscription_status="inactive",
                    trial_ends_at=None,
                    is_superuser=is_admin,
                )
                db.add(user)
                settings = UserSettings(user_id=user.id)
                db.add(settings)
                await db.commit()
                await db.refresh(user)
                logger.info(f"User {user.id} created successfully.")
            except Exception as create_error:
                logger.error(f"Failed to create user record: {create_error}")
                await db.rollback()
                raise create_error
        
        # Calculate real-time metrics
        try:
            from sqlalchemy import func
            from app.models.database import SavedPaper, Note, SavedQuery
            
            # Citations and Publications count
            papers_result = await db.execute(
                select(func.count(SavedPaper.id), func.sum(SavedPaper.citations))
                .where(SavedPaper.user_id == user.id)
            )
            row = papers_result.fetchone()
            publications_count = row[0] if row and row[0] is not None else 0
            total_citations = row[1] if row and row[1] is not None else 0
            
            # Interest score
            queries_count = await db.scalar(select(func.count(SavedQuery.id)).where(SavedQuery.user_id == user.id))
            notes_count = await db.scalar(select(func.count(Note.id)).where(Note.user_id == user.id))
            
            # Unread notifications
            from app.models.database import Notification
            unread_count = await db.scalar(
                select(func.count(Notification.id))
                .where(Notification.user_id == user.id, Notification.is_read == False)
            )
            
            user.citation_count = int(total_citations)
            user.publications_count = int(publications_count)
            user.interest_score = (queries_count or 0) + (notes_count or 0)
            user.notification_count = unread_count or 0
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
            detail=f"Error retrieving user profile: {str(e)}"
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
    now = datetime.utcnow()
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
    
    update_data = settings_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    
    await db.commit()
    await db.refresh(settings)
    return settings
