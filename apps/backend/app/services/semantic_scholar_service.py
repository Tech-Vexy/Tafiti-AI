"""
Semantic Scholar API client using the standardized BaseExternalClient.
Provides complementary coverage to OpenAlex, especially strong for CS/AI papers.
"""

import httpx
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("semantic_scholar")


class SemanticScholarService(BaseExternalClient):
    """
    Semantic Scholar Academic Graph API client.
    Free-tier provides 100 req/5 min without API key.
    Strong coverage for computer science and AI papers.
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url="https://api.semanticscholar.org/graph/v1",
            service_name="Semantic Scholar",
            timeout=15.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=None,  # Optional API key for higher rate limits
            rate_limit_per_minute=20,  # Conservative rate limit for free tier
        )
        self._shared_client = client
        self.FIELDS = "paperId,title,year,citationCount,abstract,authors"
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Use shared client if provided, otherwise use base client."""
        if self._shared_client:
            return self._shared_client
        return super().client
    
    def _parse_s2_paper(self, paper: Dict[str, Any]) -> Optional[PaperBase]:
        """Convert a Semantic Scholar paper dict to PaperBase."""
        title = paper.get("title")
        paper_id = paper.get("paperId")
        if not title or not paper_id:
            return None
        
        authors = [
            a["name"] for a in (paper.get("authors") or [])[:5]
            if a.get("name")
        ]
        abstract = (paper.get("abstract") or "")[:1500]
        
        return PaperBase(
            id=f"s2:{paper_id}",
            title=title,
            year=paper.get("year"),
            citations=paper.get("citationCount", 0),
            abstract=abstract,
            authors=authors,
        )
    
    async def search_papers(
        self,
        query: str,
        limit: int = 10,
        fields: Optional[str] = None
    ) -> List[PaperBase]:
        """
        Search Semantic Scholar for papers matching query.
        
        Args:
            query: Search query string
            limit: Maximum number of results
            fields: Custom fields to retrieve (default uses standard fields)
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "query": query,
            "limit": min(limit, 50),
            "fields": fields or self.FIELDS,
        }
        
        try:
            data = await self.get(
                "paper/search",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = [
                p for item in data.get("data", [])
                if (p := self._parse_s2_paper(item))
            ]
            
            logger.info(f"Semantic Scholar '{query}': {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"Semantic Scholar search failed for '{query}': {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in Semantic Scholar search: {e}")
            return []
    
    async def get_paper_details(
        self,
        paper_id: str,
        fields: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific paper.
        
        Args:
            paper_id: Semantic Scholar paper ID
            fields: Custom fields to retrieve
        
        Returns:
            Paper details or None if failed
        """
        params = {}
        if fields:
            params["fields"] = fields
        
        try:
            return await self.get(
                f"paper/{paper_id}",
                params=params,
                use_cache=True,
                cache_ttl=7200
            )
        except ExternalAPIError as e:
            logger.error(f"Semantic Scholar get_paper_details failed for {paper_id}: {e.message}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching paper details: {e}")
            return None
    
    async def get_citations(
        self,
        paper_id: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Get papers that cite the given paper.
        
        Args:
            paper_id: Semantic Scholar paper ID
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "limit": min(limit, 50),
            "fields": self.FIELDS,
        }
        
        try:
            data = await self.get(
                f"paper/{paper_id}/citations",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = [
                p for item in data.get("data", [])
                if (p := self._parse_s2_paper(item.get("citingPaper", {})))
            ]
            
            logger.info(f"Semantic Scholar citations for {paper_id}: {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"Semantic Scholar get_citations failed for {paper_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching citations: {e}")
            return []
    
    async def get_references(
        self,
        paper_id: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Get papers referenced by the given paper.
        
        Args:
            paper_id: Semantic Scholar paper ID
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "limit": min(limit, 50),
            "fields": self.FIELDS,
        }
        
        try:
            data = await self.get(
                f"paper/{paper_id}/references",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = [
                p for item in data.get("data", [])
                if (p := self._parse_s2_paper(item.get("citedPaper", {})))
            ]
            
            logger.info(f"Semantic Scholar references for {paper_id}: {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"Semantic Scholar get_references failed for {paper_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching references: {e}")
            return []
    
    async def get_related_papers(
        self,
        paper_id: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Get papers related to the given paper.
        
        Args:
            paper_id: Semantic Scholar paper ID
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "limit": min(limit, 50),
            "fields": self.FIELDS,
        }
        
        try:
            data = await self.get(
                f"paper/{paper_id}/related",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = [
                p for item in data.get("related", [])
                if (p := self._parse_s2_paper(item))
            ]
            
            logger.info(f"Semantic Scholar related papers for {paper_id}: {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"Semantic Scholar get_related_papers failed for {paper_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching related papers: {e}")
            return []
    
    async def get_author_papers(
        self,
        author_id: str,
        limit: int = 20
    ) -> List[PaperBase]:
        """
        Get papers by a specific author.
        
        Args:
            author_id: Semantic Scholar author ID
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "limit": min(limit, 100),
            "fields": self.FIELDS,
        }
        
        try:
            data = await self.get(
                f"author/{author_id}/papers",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = [
                p for item in data.get("data", [])
                if (p := self._parse_s2_paper(item))
            ]
            
            logger.info(f"Semantic Scholar papers for author {author_id}: {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"Semantic Scholar get_author_papers failed for {author_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching author papers: {e}")
            return []


# Singleton pattern for service instance
_s2_singleton: Optional[SemanticScholarService] = None

def get_semantic_scholar_service(client: Optional[httpx.AsyncClient] = None) -> SemanticScholarService:
    """Get or create Semantic Scholar service instance."""
    global _s2_singleton
    if client is not None:
        return SemanticScholarService(client=client)
    if _s2_singleton is None:
        _s2_singleton = SemanticScholarService()
    return _s2_singleton
