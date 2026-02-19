from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.database import User, TrialFeedback
from app.models.schemas import FeedbackCreate, UserResponse
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("feedback_api")

router = APIRouter()


@router.post("/trial", response_model=UserResponse)
async def submit_trial_feedback(
    payload: FeedbackCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.has_given_feedback:
        return user

    feedback = TrialFeedback(
        user_id=user.id,
        rating=payload.rating,
        favorite_feature=payload.favorite_feature,
        improvement_text=payload.improvement_text,
        would_recommend=payload.would_recommend,
    )
    db.add(feedback)

    user.has_given_feedback = True
    await db.commit()
    await db.refresh(user)

    logger.info(f"Trial feedback submitted by user {user.id} — rating={payload.rating}")
    return user
