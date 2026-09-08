"""
Elsevier/Scopus API client using the standardized BaseExternalClient.
Provides access to Scopus-indexed papers with comprehensive metadata.
"""

import httpx
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError, AuthenticationError
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("elsevier")


class ElsevierService(BaseExternalClient):
    """
    Elsevier Scopus Search API client.
    Requires API key from https://dev.elsevier.com.
    Rate limit: 20,000 req/week (free institutional key).
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url=settings.SCOPUS_API_URL,
            service_name="Elsevier/Scopus",
            timeout=15.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=settings.ELSEVIER_API_KEY,
            rate_limit_per_minute=50,  # Conservative rate limit
        )
        self._shared_client = client
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Use shared client if provided, otherwise use base client."""
        if self._shared_client:
            return self._shared_client
        return super().client
    
    def _build_headers(self, additional_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Build headers with Elsevier-specific requirements."""
        headers = super()._build_headers(additional_headers)
        # Elsevier uses X-ELS-APIKey header
        if self.api_key:
            headers["X-ELS-APIKey"] = self.api_key
        if settings.ELSEVIER_INST_TOKEN:
            headers["X-ELS-Insttoken"] = settings.ELSEVIER_INST_TOKEN
        headers["Accept"] = "application/json"
        return headers
    
    def _parse_entry(self, entry: Dict[str, Any]) -> Optional[PaperBase]:
        """Parse Scopus entry to PaperBase."""
        title = (entry.get("dc:title") or "").strip()
        scopus_id = entry.get("dc:identifier", "").replace("SCOPUS_ID:", "")
        if not title or not scopus_id:
            return None
        
        abstract = (entry.get("dc:description") or "")[:1500]
        
        # Authors: "authname" is a semicolon-separated string
        raw_authors = entry.get("dc:creator") or ""
        authors = [a.strip() for a in raw_authors.split(";") if a.strip()][:5]
        
        year = None
        cover_date = entry.get("prism:coverDate") or ""
        if cover_date and len(cover_date) >= 4:
            try:
                year = int(cover_date[:4])
            except ValueError:
                logger.debug(f"Failed to parse year from cover_date: {cover_date}")
        
        citations = 0
        try:
            citations = int(entry.get("citedby-count") or 0)
        except (ValueError, TypeError) as e:
            logger.debug(f"Failed to parse citations: {e}")
        
        return PaperBase(
            id=f"scopus:{scopus_id}",
            title=title,
            year=year,
            citations=citations,
            abstract=abstract,
            authors=authors,
        )
    
    async def search_papers(
        self,
        query: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Search Scopus for papers matching query.
        
        Args:
            query: Search query string
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        if not self.api_key:
            logger.warning("ELSEVIER_API_KEY not set — skipping Scopus search")
            return []
        
        params = {
            "query": query,
            "count": min(limit, 25),
            "field": "dc:identifier,dc:title,dc:creator,dc:description,prism:coverDate,citedby-count",
        }
        
        try:
            data = await self.get(
                "",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            entries = data.get("search-results", {}).get("entry") or []
            papers = [
                p for entry in entries
                if (p := self._parse_entry(entry))
            ]
            
            logger.info(f"Scopus '{query}': {len(papers)} papers")
            return papers
            
        except AuthenticationError as e:
            logger.error(f"Elsevier authentication failed: {e.message}")
            return []
        except ExternalAPIError as e:
            logger.warning(f"Scopus search failed for '{query}': {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in Scopus search: {e}")
            return []
    
    async def get_paper_details(
        self,
        scopus_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific paper.
        
        Args:
            scopus_id: Scopus paper ID
        
        Returns:
            Paper details or None if failed
        """
        params = {
            "field": "*"
        }
        
        try:
            return await self.get(
                f"abstracts/{scopus_id}",
                params=params,
                use_cache=True,
                cache_ttl=7200
            )
        except ExternalAPIError as e:
            logger.error(f"Scopus get_paper_details failed for {scopus_id}: {e.message}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching paper details: {e}")
            return None
    
    async def get_citations(
        self,
        scopus_id: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Get papers that cite the given paper.
        
        Args:
            scopus_id: Scopus paper ID
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "query": f"REF({scopus_id})",
            "count": min(limit, 25),
            "field": "dc:identifier,dc:title,dc:creator,dc:description,prism:coverDate,citedby-count",
        }
        
        try:
            data = await self.get(
                "",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            entries = data.get("search-results", {}).get("entry") or []
            papers = [
                p for entry in entries
                if (p := self._parse_entry(entry))
            ]
            
            logger.info(f"Scopus citations for {scopus_id}: {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"Scopus get_citations failed for {scopus_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching citations: {e}")
            return []


# Singleton pattern for service instance
_elsevier_singleton: Optional[ElsevierService] = None

def get_elsevier_service(client: Optional[httpx.AsyncClient] = None) -> ElsevierService:
    """Get or create Elsevier service instance."""
    global _elsevier_singleton
    if client is not None:
        return ElsevierService(client=client)
    if _elsevier_singleton is None:
        _elsevier_singleton = ElsevierService()
    return _elsevier_singleton
