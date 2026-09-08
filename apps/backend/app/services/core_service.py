"""
CORE API client using the standardized BaseExternalClient.
Aggregates open-access papers from thousands of repositories worldwide,
including many African institutional repositories.
"""

import httpx
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError, AuthenticationError
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("core_api")


class COREService(BaseExternalClient):
    """
    CORE Aggregator API v3 client.
    Aggregates open-access papers from thousands of repositories worldwide.
    Requires API key from https://core.ac.uk/register.
    Rate limit: 10 req/min (free), 150 req/min (premium).
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url=settings.CORE_API_URL,
            service_name="CORE",
            timeout=15.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=settings.CORE_API_KEY,
            rate_limit_per_minute=10,  # Free tier rate limit
        )
        self._shared_client = client
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Use shared client if provided, otherwise use base client."""
        if self._shared_client:
            return self._shared_client
        return super().client
    
    def _build_headers(self, additional_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Build headers with CORE-specific requirements."""
        headers = super()._build_headers(additional_headers)
        # CORE uses Bearer auth
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    def _parse_paper(self, item: Dict[str, Any]) -> Optional[PaperBase]:
        """Parse CORE API v3 response to PaperBase."""
        title = (item.get("title") or "").strip()
        core_id = str(item.get("id") or "")
        if not title or not core_id:
            return None
        
        abstract = (item.get("abstract") or "")[:2500]
        authors = [
            a.get("name", "") if isinstance(a, dict) else str(a)
            for a in (item.get("authors") or [])[:10]
        ]
        authors = [a for a in authors if a]
        
        year = item.get("yearPublished")
        if not year:
            pub_date = item.get("publishedDate")
            if pub_date:
                try:
                    year = int(str(pub_date)[:4])
                except ValueError:
                    logger.debug(f"Failed to parse year from pub_date: {pub_date}")
        
        citations = item.get("citationCount") or 0
        doi = item.get("doi")
        download_url = item.get("downloadUrl")
        publisher = item.get("publisher")
        
        paper_url = download_url or (f"https://doi.org/{doi}" if doi else f"https://core.ac.uk/works/{core_id}")
        
        return PaperBase(
            id=f"core:{core_id}",
            title=title,
            year=year,
            citations=citations,
            abstract=abstract,
            authors=authors,
            doi=doi,
            url=paper_url,
            pdf_url=download_url,
            publisher=publisher,
            source="core",
        )
    
    async def search_papers(
        self,
        query: str,
        limit: int = 10,
        offset: int = 0,
    ) -> List[PaperBase]:
        """
        Search CORE API v3 for papers matching query.
        
        Args:
            query: Search query string (supports boolean / field lookups e.g. title:..., abstract:...)
            limit: Maximum number of results (up to 100)
            offset: Pagination offset
        
        Returns:
            List of PaperBase objects with full v3 metadata
        """
        if not self.api_key:
            logger.warning("CORE_API_KEY not set — skipping CORE search")
            return []
        
        limit_val = min(max(1, limit), 100)
        payload = {
            "q": query,
            "limit": limit_val,
            "offset": offset,
        }
        
        # 1. Primary: POST /search/works
        try:
            data = await self.post(
                "search/works",
                json=payload,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = [
                p for item in data.get("results", [])
                if (p := self._parse_paper(item))
            ]
            
            logger.info(f"CORE API v3 '{query}': {len(papers)} papers found")
            return papers
            
        except AuthenticationError as e:
            logger.error(f"CORE authentication failed: {e.message}")
            return []
        except ExternalAPIError as e:
            logger.warning(f"CORE POST search failed for '{query}': {e.message}, falling back to GET")
            # 2. Fallback: GET /search/works
            try:
                get_params = {
                    "q": query,
                    "limit": limit_val,
                    "offset": offset,
                }
                data = await self.get(
                    "search/works",
                    params=get_params,
                    use_cache=True,
                    cache_ttl=3600
                )
                papers = [
                    p for item in data.get("results", [])
                    if (p := self._parse_paper(item))
                ]
                return papers
            except Exception as get_err:
                logger.error(f"CORE GET search fallback failed: {get_err}")
                return []
        except Exception as e:
            logger.error(f"Unexpected error in CORE search: {e}")
            return []
    
    async def get_paper_details(
        self,
        core_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific paper.
        
        Args:
            core_id: CORE paper ID
        
        Returns:
            Paper details or None if failed
        """
        try:
            return await self.get(
                f"works/{core_id}",
                use_cache=True,
                cache_ttl=7200
            )
        except ExternalAPIError as e:
            logger.error(f"CORE get_paper_details failed for {core_id}: {e.message}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching paper details: {e}")
            return None

    async def get_work_outputs(
        self,
        core_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get available document outputs (PDF, fulltext metadata) for a specific work.
        
        Args:
            core_id: CORE paper ID
            
        Returns:
            List of output objects
        """
        try:
            data = await self.get(
                f"works/{core_id}/outputs",
                use_cache=True,
                cache_ttl=7200
            )
            return data if isinstance(data, list) else data.get("results", [])
        except ExternalAPIError as e:
            logger.warning(f"CORE get_work_outputs failed for {core_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching work outputs for {core_id}: {e}")
            return []

    async def search_outputs(
        self,
        query: str,
        limit: int = 10,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Search document outputs across CORE.
        
        Args:
            query: Search query
            limit: Maximum items to return
            offset: Pagination offset
            
        Returns:
            List of output metadata dictionaries
        """
        payload = {
            "q": query,
            "limit": min(limit, 100),
            "offset": offset
        }
        try:
            data = await self.post(
                "search/outputs",
                json=payload,
                use_cache=True,
                cache_ttl=3600
            )
            return data.get("results", [])
        except ExternalAPIError as e:
            logger.warning(f"CORE search_outputs POST failed for '{query}': {e.message}")
            try:
                data = await self.get(
                    "search/outputs",
                    params=payload,
                    use_cache=True,
                    cache_ttl=3600
                )
                return data.get("results", [])
            except Exception as get_err:
                logger.error(f"CORE search_outputs fallback failed: {get_err}")
                return []
        except Exception as e:
            logger.error(f"Unexpected error searching outputs: {e}")
            return []
    
    async def get_repository_papers(
        self,
        repository_id: str,
        limit: int = 20
    ) -> List[PaperBase]:
        """
        Get papers from a specific repository.
        
        Args:
            repository_id: CORE repository ID
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "limit": min(limit, 50),
            "offset": 0
        }
        
        try:
            data = await self.get(
                f"repositories/{repository_id}/works",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = [
                p for item in data.get("results", [])
                if (p := self._parse_paper(item))
            ]
            
            logger.info(f"CORE repository {repository_id}: {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"CORE get_repository_papers failed for {repository_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching repository papers: {e}")
            return []
    
    async def get_journals(
        self,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get list of journals in CORE.
        
        Args:
            limit: Maximum number of results
        
        Returns:
            List of journal information
        """
        params = {
            "limit": min(limit, 100),
            "offset": 0
        }
        
        try:
            data = await self.get(
                "journals",
                params=params,
                use_cache=True,
                cache_ttl=7200  # Cache journals longer
            )
            
            journals = data.get("results", [])
            logger.info(f"CORE journals: {len(journals)} retrieved")
            return journals
            
        except ExternalAPIError as e:
            logger.warning(f"CORE get_journals failed: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching journals: {e}")
            return []


# Singleton pattern for service instance
_core_singleton: Optional[COREService] = None

def get_core_service(client: Optional[httpx.AsyncClient] = None) -> COREService:
    """Get or create CORE service instance."""
    global _core_singleton
    if client is not None:
        return COREService(client=client)
    if _core_singleton is None:
        _core_singleton = COREService()
    return _core_singleton
