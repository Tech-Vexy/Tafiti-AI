"""
Refactored OpenAlex service using the standardized BaseExternalClient.
This provides consistent error handling, retry logic, rate limiting, and caching.
"""

import httpx
from typing import List, Dict, Any, Optional
import asyncio
import xml.etree.ElementTree as ET

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError
from app.core.cache import cache
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("openalex")


class OpenAlexService(BaseExternalClient):
    """
    OpenAlex API client for academic paper search and citation analysis.
    Provides comprehensive coverage of global research output with free API access.
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url=settings.OPENALEX_API_URL,
            service_name="OpenAlex",
            timeout=15.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=settings.OPENALEX_API_KEY,
            rate_limit_per_minute=None,  # OpenAlex has generous limits
            client=client,  # inject the shared app-level httpx client when available
        )
        self.email = settings.OPENALEX_EMAIL

    def _build_headers(self, additional_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Build headers with OpenAlex-specific requirements."""
        headers = super()._build_headers(additional_headers)
        # OpenAlex doesn't use Bearer auth, uses api_key param instead
        if "Authorization" in headers:
            del headers["Authorization"]
        return headers
    
    def _reconstruct_abstract(self, inverted_index: Dict[str, List[int]]) -> Optional[str]:
        """Reconstruct abstract from OpenAlex inverted index format."""
        if not inverted_index:
            return None
        
        word_positions = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_positions.append((pos, word))
        
        word_positions.sort(key=lambda x: x[0])
        return " ".join([word for _, word in word_positions])
    
    def _extract_authors(self, authorships: List[Dict]) -> List[str]:
        """Extract author names from authorships data."""
        authors = []
        for authorship in authorships[:5]:
            if 'author' in authorship and 'display_name' in authorship['author']:
                authors.append(authorship['author']['display_name'])
        return authors
    
    def _parse_work_to_paper(self, work: Dict[str, Any]) -> Optional[PaperBase]:
        """Parse OpenAlex work to PaperBase, requiring abstract."""
        abstract = self._reconstruct_abstract(work.get('abstract_inverted_index'))
        if not abstract:
            return None
        
        authors = self._extract_authors(work.get('authorships', []))
        paper_id = work['id'].split('/')[-1]
        
        doi = work.get('doi')
        if doi and doi.startswith('https://doi.org/'):
            doi = doi.replace('https://doi.org/', '')
            
        primary_loc = work.get('primary_location') or {}
        source_obj = primary_loc.get('source') or {}
        source_name = source_obj.get('display_name') or 'OpenAlex'
        landing_url = primary_loc.get('landing_page_url') or (f"https://doi.org/{doi}" if doi else f"https://openalex.org/{paper_id}")
        pdf_url = primary_loc.get('pdf_url') or (work.get('open_access') or {}).get('oa_url')
        
        return PaperBase(
            id=paper_id,
            title=work['title'],
            year=work['publication_year'],
            citations=work['cited_by_count'],
            abstract=abstract[:1500],
            authors=authors,
            doi=doi,
            url=landing_url,
            pdf_url=pdf_url,
            source=source_name,
            publisher=source_obj.get('publisher') or source_name,
        )
    
    def _parse_work_minimal(self, work: Dict[str, Any]) -> Optional[PaperBase]:
        """Parse OpenAlex work to PaperBase without requiring abstract."""
        if not work.get('title'):
            return None
        abstract = self._reconstruct_abstract(work.get('abstract_inverted_index')) or ''
        authors = self._extract_authors(work.get('authorships', []))
        paper_id = work['id'].split('/')[-1]
        
        doi = work.get('doi')
        if doi and doi.startswith('https://doi.org/'):
            doi = doi.replace('https://doi.org/', '')
            
        primary_loc = work.get('primary_location') or {}
        source_obj = primary_loc.get('source') or {}
        source_name = source_obj.get('display_name') or 'OpenAlex'
        landing_url = primary_loc.get('landing_page_url') or (f"https://doi.org/{doi}" if doi else f"https://openalex.org/{paper_id}")
        pdf_url = primary_loc.get('pdf_url') or (work.get('open_access') or {}).get('oa_url')

        return PaperBase(
            id=paper_id,
            title=work['title'],
            year=work.get('publication_year'),
            citations=work.get('cited_by_count', 0),
            abstract=abstract[:1500],
            authors=authors,
            doi=doi,
            url=landing_url,
            pdf_url=pdf_url,
            source=source_name,
            publisher=source_obj.get('publisher') or source_name,
        )
    
    async def search_papers(
        self,
        query: str,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None
    ) -> List[PaperBase]:
        """
        Search for papers matching the query.
        
        Args:
            query: Search query string
            limit: Maximum number of results
            filters: Optional filters (min_year, max_year, min_citations, require_abstract)
            sort: Sort order (e.g., "cited_by_count:desc")
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "search": query,
            "per_page": min(limit, settings.MAX_PAPERS_PER_QUERY),
            "select": "id,title,publication_year,cited_by_count,abstract_inverted_index,authorships,doi,primary_location,open_access",
            "mailto": self.email
        }
        
        if sort:
            params["sort"] = sort
        
        if self.api_key:
            params["api_key"] = self.api_key
        
        # Build filter string
        filter_parts = []
        if filters:
            if filters.get('require_abstract', True):
                filter_parts.append("has_abstract:true")
            if 'min_year' in filters:
                filter_parts.append(f"publication_year:>{filters['min_year']}")
            if 'max_year' in filters:
                filter_parts.append(f"publication_year:<{filters['max_year']}")
            if 'min_citations' in filters:
                filter_parts.append(f"cited_by_count:>{filters['min_citations']}")
        else:
            filter_parts.append("has_abstract:true")
        
        if filter_parts:
            params["filter"] = ",".join(filter_parts)
        
        try:
            data = await self.get(
                "works",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = []
            for work in data.get('results', []):
                paper = self._parse_work_minimal(work)
                if paper:
                    papers.append(paper)
            
            logger.info(f"OpenAlex search for '{query}' returned {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.error(f"OpenAlex search failed: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in OpenAlex search: {e}")
            return []
    
    async def get_paper_details(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific paper."""
        params = {"mailto": self.email}
        if self.api_key:
            params["api_key"] = self.api_key
        
        try:
            return await self.get(
                f"works/{paper_id}",
                params=params,
                use_cache=True,
                cache_ttl=7200  # Cache details longer
            )
        except ExternalAPIError as e:
            logger.error(f"OpenAlex get_paper_details failed for {paper_id}: {e.message}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching paper details: {e}")
            return None
    
    async def get_referenced_works(self, paper_id: str, limit: int = 8) -> List[PaperBase]:
        """Get papers that the seed paper cites (bibliography/ancestors)."""
        detail = await self.get_paper_details(paper_id)
        if not detail:
            return []
        
        ref_urls: List[str] = detail.get('referenced_works', [])[:limit]
        if not ref_urls:
            return []
        
        # Strip URL prefix to get bare IDs and join for batch filter
        ids = [r.split('/')[-1] for r in ref_urls]
        filter_str = '|'.join(ids)
        
        params = {
            'filter': f'ids.openalex:{filter_str}',
            'per_page': limit,
            'select': 'id,title,publication_year,cited_by_count,abstract_inverted_index,authorships',
            'mailto': self.email,
        }
        if self.api_key:
            params['api_key'] = self.api_key
        
        try:
            data = await self.get(
                "works",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            papers = [p for work in data.get('results', []) if (p := self._parse_work_minimal(work))]
            logger.info(f"OpenAlex referenced_works for {paper_id}: {len(papers)} fetched")
            return papers
        except ExternalAPIError as e:
            logger.error(f"get_referenced_works failed for {paper_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching referenced works: {e}")
            return []
    
    async def get_citing_papers(self, paper_id: str, limit: int = 8) -> List[PaperBase]:
        """Get papers that cite the seed paper (descendants/future impact)."""
        params = {
            'filter': f'cites:{paper_id}',
            'per_page': limit,
            'sort': 'cited_by_count:desc',
            'select': 'id,title,publication_year,cited_by_count,abstract_inverted_index,authorships',
            'mailto': self.email,
        }
        if self.api_key:
            params['api_key'] = self.api_key
        
        try:
            data = await self.get(
                "works",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            papers = [p for work in data.get('results', []) if (p := self._parse_work_minimal(work))]
            logger.info(f"OpenAlex citing_papers for {paper_id}: {len(papers)} fetched")
            return papers
        except ExternalAPIError as e:
            logger.error(f"get_citing_papers failed for {paper_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching citing papers: {e}")
            return []
    
    async def get_citation_graph(
        self,
        paper_id: str,
        refs_limit: int = 8,
        citing_limit: int = 8,
    ) -> Dict[str, Any]:
        """Parallel fetch of seed details + referenced works + citing papers."""
        detail_task = self.get_paper_details(paper_id)
        refs_task = self.get_referenced_works(paper_id, limit=refs_limit)
        citing_task = self.get_citing_papers(paper_id, limit=citing_limit)
        
        detail, references, cited_by = await asyncio.gather(
            detail_task, refs_task, citing_task,
            return_exceptions=True
        )
        
        seed = None
        total_cited_by_count = 0
        total_references_count = 0
        
        if isinstance(detail, dict):
            authors = self._extract_authors(detail.get('authorships', []))
            abstract = self._reconstruct_abstract(detail.get('abstract_inverted_index')) or ''
            paper_id_clean = detail['id'].split('/')[-1]
            seed = PaperBase(
                id=paper_id_clean,
                title=detail.get('title', 'Unknown'),
                year=detail.get('publication_year'),
                citations=detail.get('cited_by_count', 0),
                abstract=abstract[:1500],
                authors=authors,
            )
            total_cited_by_count = detail.get('cited_by_count', 0)
            total_references_count = len(detail.get('referenced_works', []))
        
        return {
            'seed': seed,
            'references': references if isinstance(references, list) else [],
            'cited_by': cited_by if isinstance(cited_by, list) else [],
            'total_cited_by_count': total_cited_by_count,
            'total_references_count': total_references_count,
        }
    
    async def get_related_papers(self, paper_id: str, limit: int = 5) -> List[PaperBase]:
        """Get papers related to the given paper."""
        params = {
            "per_page": limit,
            "mailto": self.email
        }
        if self.api_key:
            params["api_key"] = self.api_key
        
        try:
            data = await self.get(
                f"works/{paper_id}/related_works",
                params=params,
                use_cache=True,
                cache_ttl=3600
            )
            
            papers = []
            for work in data.get('results', []):
                paper = self._parse_work_to_paper(work)
                if paper:
                    papers.append(paper)
            
            logger.info(f"OpenAlex related papers for {paper_id} returned {len(papers)} results")
            return papers
        except ExternalAPIError as e:
            logger.error(f"OpenAlex get_related_papers failed for {paper_id}: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching related papers: {e}")
            return []
    
    async def get_citation_graph_abstract(self, paper_id: str) -> str:
        """Return abstract[:1500] for the seed paper in the citation graph view."""
        detail = await self.get_paper_details(paper_id)
        if detail:
            return self._reconstruct_abstract(detail.get('abstract_inverted_index')) or ''
        return ''


# Singleton pattern for service instance
_openalex_singleton: Optional[OpenAlexService] = None

def get_openalex_service(client: Optional[httpx.AsyncClient] = None) -> OpenAlexService:
    """Get or create OpenAlex service instance."""
    global _openalex_singleton
    if client is not None:
        # Called with a shared app client — return a fresh wrapper each time
        return OpenAlexService(client=client)
    if _openalex_singleton is None:
        _openalex_singleton = OpenAlexService()
    return _openalex_singleton


# ─── arXiv Service ────────────────────────────────────────────────────────────

arxiv_logger = get_logger("arxiv")


class ArxivService:
    """
    arXiv API client using the public Atom feed endpoint.
    No API key required. Best for CS, Physics, Math, and quantitative biology.
    Rate limit: be polite — 1 request every 3 seconds per arXiv guidelines.
    """
    SEARCH_URL = "https://export.arxiv.org/api/query"

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=15.0)
        return self._client

    def _parse_atom_entry(self, entry: Dict[str, Any]) -> Optional[PaperBase]:
        title = entry.get("title", "").replace("\n", " ").strip()
        arxiv_id_url = entry.get("id", "")
        arxiv_id = arxiv_id_url.split("/abs/")[-1].replace("/", "_") if arxiv_id_url else None
        if not title or not arxiv_id:
            return None

        abstract = entry.get("summary", "").replace("\n", " ").strip()
        authors = [a.get("name", "") for a in entry.get("authors", []) if a.get("name")][:5]

        published = entry.get("published", "")
        year = None
        if published and len(published) >= 4:
            try:
                year = int(published[:4])
            except ValueError:
                pass

        clean_arxiv_id = arxiv_id.replace("_", "/")
        return PaperBase(
            id=f"arxiv:{arxiv_id}",
            title=title,
            year=year,
            citations=0,
            abstract=abstract[:1500],
            authors=authors,
            url=f"https://arxiv.org/abs/{clean_arxiv_id}",
            pdf_url=f"https://arxiv.org/pdf/{clean_arxiv_id}.pdf",
            source="arXiv.org",
            publisher="arXiv Preprints",
        )

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        cache_key = f"arxiv:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": min(limit, 25),
            "sortBy": "relevance",
            "sortOrder": "descending",
        }
        try:
            response = await self.client.get(self.SEARCH_URL, params=params)
            response.raise_for_status()

            ns = {
                "atom": "http://www.w3.org/2005/Atom",
                "arxiv": "http://arxiv.org/schemas/atom",
            }
            root = ET.fromstring(response.text)
            papers: List[PaperBase] = []
            for entry_el in root.findall("atom:entry", ns):
                entry: Dict[str, Any] = {
                    "id": (entry_el.find("atom:id", ns) or {}).text or "",
                    "title": (entry_el.find("atom:title", ns) or {}).text or "",
                    "summary": (entry_el.find("atom:summary", ns) or {}).text or "",
                    "published": (entry_el.find("atom:published", ns) or {}).text or "",
                    "authors": [
                        {"name": (a.find("atom:name", ns) or {}).text or ""}
                        for a in entry_el.findall("atom:author", ns)
                    ],
                }
                paper = self._parse_atom_entry(entry)
                if paper:
                    papers.append(paper)

            arxiv_logger.info(f"arXiv '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.model_dump() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            arxiv_logger.warning(f"arXiv search failed for '{query}': {e}")
            return []


_arxiv_singleton: Optional[ArxivService] = None


def get_arxiv_service(client: Optional[httpx.AsyncClient] = None) -> ArxivService:
    global _arxiv_singleton
    if client is not None:
        return ArxivService(client=client)
    if _arxiv_singleton is None:
        _arxiv_singleton = ArxivService()
    return _arxiv_singleton
