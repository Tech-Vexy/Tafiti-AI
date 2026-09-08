"""
AfricArXiv API client using the standardized BaseExternalClient.
Provides access to African preprints via DataCite REST API.
"""

import httpx
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("africarxiv")


class AfricArXivService(BaseExternalClient):
    """
    AfricArXiv client via DataCite REST API.
    No API key required.
    Provides access to African preprints and research outputs.
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url=settings.AFRICARXIV_API_URL,
            service_name="AfricArXiv",
            timeout=15.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=None,  # No API key required
            rate_limit_per_minute=30,  # Conservative rate limit
        )
        self._shared_client = client
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Use shared client if provided, otherwise use base client."""
        if self._shared_client:
            return self._shared_client
        return super().client
    
    def _parse_datacite_paper(self, item: Dict[str, Any]) -> Optional[PaperBase]:
        """Parse DataCite record to PaperBase."""
        attributes = item.get("attributes", {})
        title = attributes.get("title", "").strip()
        doi = attributes.get("doi", "")
        
        if not title:
            return None
        
        # Use DOI as ID if available, otherwise use internal ID
        paper_id = doi if doi else item.get("id", "")
        
        # Abstract
        abstract = attributes.get("description", "")[:1500]
        
        # Authors
        authors = []
        for author in attributes.get("creators", [])[:5]:
            name = author.get("name", "")
            if name:
                authors.append(name)
        
        # Year
        year = None
        published = attributes.get("published")
        if published:
            try:
                year = int(str(published)[:4])
            except ValueError:
                logger.debug(f"Failed to parse year from published: {published}")
        
        return PaperBase(
            id=f"africarxiv:{paper_id}",
            title=title,
            year=year,
            citations=0,  # DataCite doesn't provide citation counts
            abstract=abstract,
            authors=authors,
        )
    
    async def search_papers(
        self,
        query: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Search AfricArXiv for papers matching query.
        
        Args:
            query: Search query string
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "query": f"client_id:africarxiv AND ({query})",
            "page[size]": min(limit, 100),
            "page[number]": 1
        }
        
        try:
            data = await self.get(
                "dois",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = []
            for item in data.get("data", []):
                paper = self._parse_datacite_paper(item)
                if paper:
                    papers.append(paper)
            
            logger.info(f"AfricArXiv '{query}': {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"AfricArXiv search failed for '{query}': {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in AfricArXiv search: {e}")
            return []
    
    async def get_recent_papers(
        self,
        limit: int = 20
    ) -> List[PaperBase]:
        """
        Get recent papers from AfricArXiv.
        
        Args:
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "query": "client_id:africarxiv",
            "page[size]": min(limit, 100),
            "page[number]": 1,
            "sort": "published"
        }
        
        try:
            data = await self.get(
                "dois",
                params=params,
                use_cache=True,
                cache_ttl=1800  # Cache recent papers for shorter time
            )
            
            papers = []
            for item in data.get("data", []):
                paper = self._parse_datacite_paper(item)
                if paper:
                    papers.append(paper)
            
            logger.info(f"AfricArXiv recent papers: {len(papers)} retrieved")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"AfricArXiv get_recent_papers failed: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching recent papers: {e}")
            return []
    
    async def get_paper_details(
        self,
        doi: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific paper.
        
        Args:
            doi: DOI identifier
        
        Returns:
            Paper details or None if failed
        """
        try:
            data = await self.get(
                f"dois/{doi}",
                use_cache=True,
                cache_ttl=7200
            )
            return data.get("data", {}).get("attributes", {})
        except ExternalAPIError as e:
            logger.error(f"AfricArXiv get_paper_details failed for {doi}: {e.message}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching paper details: {e}")
            return None


# Singleton pattern for service instance
_africarxiv_singleton: Optional[AfricArXivService] = None

def get_africarxiv_service(client: Optional[httpx.AsyncClient] = None) -> AfricArXivService:
    """Get or create AfricArXiv service instance."""
    global _africarxiv_singleton
    if client is not None:
        return AfricArXivService(client=client)
    if _africarxiv_singleton is None:
        _africarxiv_singleton = AfricArXivService()
    return _africarxiv_singleton
