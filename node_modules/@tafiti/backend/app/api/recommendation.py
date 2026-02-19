from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.services.recommendation_service import recommendation_service
from app.services.discovery_service import discovery_service
from app.core.security import get_current_user
from app.core.logger import logger
from app.models.schemas import PaperBase, UserDiscoveryResponse
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession

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
        # expertise_areas might be in current_user dictionary (from JWT/Session)
        # or we might need to fetch from DB. 
        # Usually get_current_user returns a dict or model.
        expertise = current_user.get("expertise_areas", [])
        return await discovery_service.find_similar_users(
            db=db,
            current_user_id=current_user["user_id"],
            expertise=expertise,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Failed to fetch similar researchers: {e}")
        return []
