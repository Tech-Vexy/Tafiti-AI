from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.database import User, TrialFeedback
from app.models.schemas import FeedbackCreate, UserResponse, FeedbackPublicResponse
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
    logger.info(f"Trial feedback submitted by user {user.id} — rating={payload.rating}")
    return user


@router.get("/testimonials", response_model=list[FeedbackPublicResponse])
async def get_testimonials(
    limit: int = 3,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch public testimonials from trial feedback with high ratings (4 or 5).
    """
    query = (
        select(TrialFeedback, User)
        .join(User, TrialFeedback.user_id == User.id)
        .where(TrialFeedback.rating >= 4)
        .where(TrialFeedback.improvement_text != None)  # Ensure there is some text content
        .order_by(TrialFeedback.created_at.desc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    testimonials = []
    for feedback, user in rows:
        # Use improvement_text as the quote, or favorite_feature if text is too short
        quote = feedback.improvement_text if feedback.improvement_text and len(feedback.improvement_text) > 10 else f"I really like the {feedback.favorite_feature} feature!"
        
        testimonials.append(
            FeedbackPublicResponse(
                id=feedback.id,
                rating=feedback.rating,
                quote=quote,
                author=user.username or "Tafiti Researcher",
                role=user.career_field or "Researcher",
                avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={user.username or 'anonymous'}"
            )
        )
        
    return testimonials
