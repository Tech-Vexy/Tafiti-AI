import asyncio
from typing import List, Optional
from datetime import datetime
from app.services.openalex_service import get_openalex_service, get_semantic_scholar_service
from app.models.schemas import PaperBase, UserDiscoveryResponse
from app.models.database import User, SearchHistory
from app.core.logger import get_logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = get_logger("discovery")

class DiscoveryService:
    def __init__(self):
        self.openalex = get_openalex_service()
        self.s2 = get_semantic_scholar_service()

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

    async def get_trending_research(self, career_field: str, limit: int = 15) -> List[PaperBase]:
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
            papers = await self.openalex.search_papers(
                query=career_field,
                limit=limit * 2,
                filters=filters,
                sort="cited_by_count:desc"
            )
            return papers[:limit]
        except Exception as e:
            logger.error(f"Discovery failed for {career_field}: {e}")
            return []

    async def get_recommended_discovery(self, expertise: List[str], limit: int = 15) -> List[PaperBase]:
        """
        Fetch papers based on all expertise areas.
        """
        if not expertise:
            return []

        query = " ".join(expertise[:4])
        try:
            return await self.openalex.search_papers(query=query, limit=limit)
        except Exception as e:
            logger.error(f"Expertise discovery failed: {e}")
            return []

    async def get_personalized_feed(
        self,
        db: AsyncSession,
        user_id: str,
        career_field: Optional[str],
        expertise_areas: List[str],
        limit: int = 30
    ) -> List[PaperBase]:
        """
        Build a personalized paper feed using the user's career field,
        expertise areas, and recent search history. Runs multiple OpenAlex
        queries in parallel, deduplicates, and ranks by citation count.
        """
        per_query_limit = min(limit, 20)

        # Fetch recent search queries from DB
        recent_queries: List[str] = []
        try:
            result = await db.execute(
                select(SearchHistory.query)
                .where(SearchHistory.user_id == user_id)
                .order_by(SearchHistory.created_at.desc())
                .limit(5)
            )
            recent_queries = [row[0] for row in result.all()]
        except Exception as e:
            logger.error(f"Failed to fetch search history for user {user_id}: {e}")

        # Build parallel search tasks
        tasks = []

        # Query 1: OpenAlex — career field + primary expertise
        if career_field and expertise_areas:
            q1 = f"{career_field} {expertise_areas[0]}"
            tasks.append(self.openalex.search_papers(query=q1, limit=per_query_limit))
        elif career_field:
            tasks.append(self.openalex.search_papers(query=career_field, limit=per_query_limit))

        # Query 2: OpenAlex — secondary expertise areas
        if len(expertise_areas) > 1:
            q2 = " ".join(expertise_areas[1:4])
            tasks.append(self.openalex.search_papers(query=q2, limit=per_query_limit))

        # Query 3: Semantic Scholar — career field (complementary source, strong CS/AI coverage)
        s2_query = f"{career_field or ''} {expertise_areas[0] if expertise_areas else ''}".strip()
        if s2_query:
            tasks.append(self.s2.search_papers(query=s2_query, limit=per_query_limit))

        # Query 4: recent search history keywords
        if recent_queries:
            q3 = " ".join(recent_queries[:3])
            tasks.append(self.openalex.search_papers(
                query=q3,
                limit=per_query_limit,
                sort="publication_date:desc"
            ))

        if not tasks:
            # Fallback: no profile data, return general recent research
            return await self.openalex.search_papers(
                query="research",
                limit=per_query_limit,
                sort="publication_date:desc"
            )

        # Run all searches concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Merge and deduplicate
        seen_ids = set()
        all_papers: List[PaperBase] = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Personalized feed sub-query failed: {result}")
                continue
            for paper in result:
                if paper.id not in seen_ids:
                    seen_ids.add(paper.id)
                    all_papers.append(paper)

        # Rank: blend citation count with recency
        current_year = datetime.now().year
        def score(p: PaperBase) -> float:
            citations = p.citations or 0
            year = p.year or (current_year - 5)
            recency_bonus = max(0, (year - (current_year - 5))) * 5
            return citations + recency_bonus

        all_papers.sort(key=score, reverse=True)
        logger.info(f"Personalized feed for user {user_id}: {len(all_papers)} papers after dedup")
        return all_papers[:limit]

discovery_service = DiscoveryService()
