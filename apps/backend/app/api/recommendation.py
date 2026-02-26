from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.services.recommendation_service import recommendation_service
from app.services.discovery_service import discovery_service
from app.core.security import get_current_user
from app.core.logger import logger
from app.models.schemas import PaperBase, UserDiscoveryResponse
from app.models.database import User
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter()

class RecommendationRequest(BaseModel):
    interests: List[str]
    career_field: str

class TopicResponse(BaseModel):
    title: str
    description: str

@router.post("/recommendations", response_model=List[TopicResponse])
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

@router.get("/recommendations/papers", response_model=List[PaperBase])
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

@router.get("/discovery/trending", response_model=List[PaperBase])
async def get_trending(
    field: Optional[str] = None,
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

@router.get("/recommendations/researchers", response_model=List[UserDiscoveryResponse])
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
