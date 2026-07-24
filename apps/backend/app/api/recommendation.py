
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.database import User
from app.models.schemas import PaperBase, UserDiscoveryResponse
from app.services.discovery_service import discovery_service
from app.services.recommendation_service import recommendation_service

router = APIRouter()

class RecommendationRequest(BaseModel):
    interests: list[str]
    career_field: str

class TopicResponse(BaseModel):
    title: str
    description: str

@router.post("/recommendations", response_model=list[TopicResponse])
async def get_recommendations(
    request: RecommendationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Get personalized research topic recommendations.
    """
    try:
        topics = await recommendation_service.generate_topics(
            interests=request.interests,
            career_field=request.career_field
        )
        return topics
    except Exception as e:
        logger.error(f"Failed to fetch recommendations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while generating recommendations")

@router.get("/recommendations/papers", response_model=list[PaperBase])
async def get_recommended_papers(
    limit: int = 30,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get personalized paper recommendations based on the user's career field,
    expertise areas, and recent search history.
    """
    try:
        # Fetch full user profile from DB
        result = await db.execute(
            select(User).where(User.id == current_user["user_id"])
        )
        user = result.scalar_one_or_none()

        career_field = user.career_field if user else None
        expertise_areas = user.expertise_areas if user and user.expertise_areas else []

        papers = await discovery_service.get_personalized_feed(
            db=db,
            user_id=current_user["user_id"],
            career_field=career_field,
            expertise_areas=expertise_areas,
            limit=limit
        )
        return papers
    except Exception as e:
        logger.error(f"Failed to fetch recommended papers: {e}")
        return []

@router.get("/discovery/trending", response_model=list[PaperBase])
async def get_trending(
    field: str | None = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get trending research papers.
    """
    search_field = field or current_user.get("career_field") or "AI Research"
    try:
        return await discovery_service.get_trending_research(search_field)
    except Exception as e:
        logger.error(f"Failed to fetch trending: {e}")
        return []

@router.get("/recommendations/researchers", response_model=list[UserDiscoveryResponse])
async def get_similar_researchers(
    limit: int = 5,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get suggested researchers with similar expertise.
    """
    try:
        # Fetch expertise from DB since JWT doesn't include it
        result = await db.execute(
            select(User).where(User.id == current_user["user_id"])
        )
        user = result.scalar_one_or_none()
        expertise = user.expertise_areas if user and user.expertise_areas else []

        return await discovery_service.find_similar_users(
            db=db,
            current_user_id=current_user["user_id"],
            expertise=expertise,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Failed to fetch similar researchers: {e}")
        return []
