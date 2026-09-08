"""
DOAJ (Directory of Open Access Journals) API client using the standardized BaseExternalClient.
Provides access to open access journals and articles.
"""

import httpx
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("doaj")


class DOAJService(BaseExternalClient):
    """
    DOAJ API client.
    No API key required for basic usage.
    Provides access to high-quality open access journals and articles.
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url=settings.DOAJ_API_URL,
            service_name="DOAJ",
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
    
    def _parse_article(self, item: Dict[str, Any]) -> Optional[PaperBase]:
        """Parse DOAJ article to PaperBase."""
        bibjson = item.get("bibjson", {})
        title = bibjson.get("title", "").strip()
        doi = bibjson.get("identifier", [{}])[0].get("id", "") if bibjson.get("identifier") else ""
        
        if not title:
            return None
        
        abstract = bibjson.get("abstract", "")[:1500]
        
        # Authors
        authors = []
        for author in bibjson.get("author", [])[:5]:
            name = author.get("name", "")
            if name:
                authors.append(name)
        
        # Year
        year = None
        year_str = bibjson.get("year")
        if year_str:
            try:
                year = int(str(year_str)[:4])
            except ValueError:
                logger.debug(f"Failed to parse year: {year_str}")
        
        # Use DOI as ID if available, otherwise use internal ID
        paper_id = doi if doi else item.get("id", "")
        
        return PaperBase(
            id=f"doaj:{paper_id}",
            title=title,
            year=year,
            citations=0,  # DOAJ doesn't provide citation counts
            abstract=abstract,
            authors=authors,
        )
    
    async def search_papers(
        self,
        query: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Search DOAJ for articles matching query.
        
        Args:
            query: Search query string
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "q": query,
            "pageSize": min(limit, 100),
            "searchFields": "title,abstract,author"
        }
        
        try:
            data = await self.get(
                "search/articles",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = []
            for item in data.get("results", []):
                bibjson = item.get("bibjson", {})
                if bibjson.get("title"):  # Only include items with titles
                    paper = self._parse_article(item)
                    if paper:
                        papers.append(paper)
            
            logger.info(f"DOAJ '{query}': {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"DOAJ search failed for '{query}': {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in DOAJ search: {e}")
            return []
    
    async def get_journals(
        self,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get list of open access journals from DOAJ.
        
        Args:
            limit: Maximum number of results
        
        Returns:
            List of journal information
        """
        params = {
            "pageSize": min(limit, 100)
        }
        
        try:
            data = await self.get(
                "journals",
                params=params,
                use_cache=True,
                cache_ttl=7200  # Cache journals longer
            )
            
            journals = data.get("results", [])
            logger.info(f"DOAJ journals: {len(journals)} retrieved")
            return journals
            
        except ExternalAPIError as e:
            logger.warning(f"DOAJ get_journals failed: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching journals: {e}")
            return []
    
    async def get_journal_articles(
        self,
        journal_id: str,
        limit: int = 20
    ) -> List[PaperBase]:
        """
        Get articles from a specific journal.
        
        Args:
            journal_id: DOAJ journal ID
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "pageSize": min(limit, 100)
        }
        
        try:
            data = await self.get(
                f"journals/{journal_id}/articles",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = []
            for item in data.get("results", []):
                paper = self._parse_article(item)
                if paper:
                    papers.append(paper)
            
            logger.info(f"DOAJ journal {journal_id}: {len(papers)} articles")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"DOAJ get_journal_articles failed for {journal_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching journal articles: {e}")
            return []


# Singleton pattern for service instance
_doaj_singleton: Optional[DOAJService] = None

def get_doaj_service(client: Optional[httpx.AsyncClient] = None) -> DOAJService:
    """Get or create DOAJ service instance."""
    global _doaj_singleton
    if client is not None:
        return DOAJService(client=client)
    if _doaj_singleton is None:
        _doaj_singleton = DOAJService()
    return _doaj_singleton
