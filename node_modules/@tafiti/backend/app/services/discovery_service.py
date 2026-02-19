from typing import List, Optional
from datetime import datetime
from app.services.openalex_service import get_openalex_service
from app.models.schemas import PaperBase, UserDiscoveryResponse
from app.models.database import User
from app.core.logger import get_logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = get_logger("discovery")

class DiscoveryService:
    def __init__(self):
        self.openalex = get_openalex_service()

    async def find_similar_users(
        self, 
        db: AsyncSession, 
        current_user_id: str, 
        expertise: List[str], 
        limit: int = 5
    ) -> List[UserDiscoveryResponse]:
        """
        Find other researchers with similar expertise areas.
        """
        if not expertise:
            return []
            
        try:
            # Query all active users except the current one
            query = select(User).where(User.id != current_user_id, User.is_active == True)
            result = await db.execute(query)
            all_users = result.scalars().all()
            
            similar_users = []
            expertise_set = set(e.lower() for e in expertise)
            
            for user in all_users:
                if not user.expertise_areas:
                    continue
                
                other_expertise_set = set(e.lower() for e in user.expertise_areas)
                intersection = expertise_set.intersection(other_expertise_set)
                
                if intersection:
                    score = len(intersection) / len(expertise_set.union(other_expertise_set))
                    similar_users.append(UserDiscoveryResponse(
                        id=user.id,
                        username=user.username,
                        university=user.university,
                        expertise_areas=user.expertise_areas,
                        bio=user.bio,
                        similarity_score=round(score * 100, 2)
                    ))
            
            # Sort by score and limit
            similar_users.sort(key=lambda x: x.similarity_score, reverse=True)
            return similar_users[:limit]
            
        except Exception as e:
            logger.error(f"Failed to find similar users: {e}")
            return []

    async def get_trending_research(self, career_field: str, limit: int = 5) -> List[PaperBase]:
        """
        Fetch trending papers in a specific field.
        Trending = High citation count in the last 2 years.
        """
        current_year = datetime.now().year
        filters = {
            "min_year": current_year - 2,
            "min_citations": 10
        }
        
        try:
            # We search for the career field and sort by citations if OpenAlex supports it, 
            # or just filter heavily as we do here.
            query = career_field
            papers = await self.openalex.search_papers(
                query=query,
                limit=limit * 2, # Fetch more to sort/filter
                filters=filters
            )
            
            # Sort by citations descending
            sorted_papers = sorted(papers, key=lambda x: x.citations, reverse=True)
            return sorted_papers[:limit]
        except Exception as e:
            logger.error(f"Discovery failed for {career_field}: {e}")
            return []

    async def get_recommended_discovery(self, expertise: List[str], limit: int = 5) -> List[PaperBase]:
        """
        Fetch papers based on specific expertise areas.
        """
        if not expertise:
            return []
            
        # Combine expertise into search or fetch for the primary one
        query = " ".join(expertise[:2])
        try:
            return await self.openalex.search_papers(query=query, limit=limit)
        except Exception as e:
            logger.error(f"Expertise discovery failed: {e}")
            return []

discovery_service = DiscoveryService()
