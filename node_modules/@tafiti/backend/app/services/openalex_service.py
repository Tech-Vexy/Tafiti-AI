import httpx
from typing import List, Dict, Any, Optional
from functools import lru_cache
import asyncio

from app.core.config import settings
from app.models.schemas import PaperBase
from app.core.logger import get_logger
from app.core.cache import cache

logger = get_logger("openalex")

class OpenAlexService:
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self.base_url = settings.OPENALEX_API_URL
        self.email = settings.OPENALEX_EMAIL
        self.api_key = settings.OPENALEX_API_KEY
        self.timeout = 15.0
        self._client = client
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            # Fallback if no shared client is provided (mostly for tests or CLI)
            return httpx.AsyncClient(timeout=self.timeout)
        return self._client

    def _reconstruct_abstract(self, inverted_index: Dict[str, List[int]]) -> Optional[str]:
        if not inverted_index:
            return None
        
        word_positions = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_positions.append((pos, word))
        
        word_positions.sort(key=lambda x: x[0])
        return " ".join([word for _, word in word_positions])
    
    def _extract_authors(self, authorships: List[Dict]) -> List[str]:
        authors = []
        for authorship in authorships[:5]:
            if 'author' in authorship and 'display_name' in authorship['author']:
                authors.append(authorship['author']['display_name'])
        return authors
    
    def _parse_work_to_paper(self, work: Dict[str, Any]) -> Optional[PaperBase]:
        abstract = self._reconstruct_abstract(work.get('abstract_inverted_index'))
        if not abstract:
            return None
        
        authors = self._extract_authors(work.get('authorships', []))
        paper_id = work['id'].split('/')[-1]
        
        return PaperBase(
            id=paper_id,
            title=work['title'],
            year=work['publication_year'],
            citations=work['cited_by_count'],
            abstract=abstract[:800],
            authors=authors
        )

    def _parse_work_minimal(self, work: Dict[str, Any]) -> Optional[PaperBase]:
        """Like _parse_work_to_paper but does not require an abstract."""
        if not work.get('title'):
            return None
        abstract = self._reconstruct_abstract(work.get('abstract_inverted_index')) or ''
        authors = self._extract_authors(work.get('authorships', []))
        paper_id = work['id'].split('/')[-1]
        return PaperBase(
            id=paper_id,
            title=work['title'],
            year=work.get('publication_year'),
            citations=work.get('cited_by_count', 0),
            abstract=abstract[:800],
            authors=authors
        )

    async def search_papers(
        self,
        query: str,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[PaperBase]:
        # Try to get from cache
        cache_key = cache.make_key("openalex:search", query, limit, filters=filters)
        cached_results = await cache.get(cache_key)
        if cached_results:
            logger.info(f"OpenAlex cache hit for '{query}'")
            return [PaperBase(**p) for p in cached_results]

        params = {
            "search": query,
            "per_page": min(limit, settings.MAX_PAPERS_PER_QUERY),
            "filter": "has_abstract:true",
            "select": "id,title,publication_year,cited_by_count,abstract_inverted_index,authorships",
            "mailto": self.email
        }
        
        if self.api_key:
            params["api_key"] = self.api_key
        
        if filters:
            if 'min_year' in filters:
                params['filter'] += f",publication_year:>{filters['min_year']}"
            if 'max_year' in filters:
                params['filter'] += f",publication_year:<{filters['max_year']}"
            if 'min_citations' in filters:
                params['filter'] += f",cited_by_count:>{filters['min_citations']}"
        
        try:
            response = await self.client.get(f"{self.base_url}/works", params=params)
            response.raise_for_status()
            data = response.json()
            
            papers = []
            for work in data.get('results', []):
                paper = self._parse_work_to_paper(work)
                if paper:
                    papers.append(paper)
            
            
            logger.info(f"OpenAlex search for '{query}' returned {len(papers)} papers")
            
            # Save to cache (TTL: 1 hour)
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
                
            return papers
        except Exception as e:
            logger.error(f"OpenAlex search failed: {str(e)}")
            raise

    async def get_paper_details(self, paper_id: str) -> Optional[Dict[str, Any]]:
        params = {"mailto": self.email}
        if self.api_key:
            params["api_key"] = self.api_key
            
        try:
            response = await self.client.get(
                f"{self.base_url}/works/{paper_id}",
                params=params
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"OpenAlex get_paper_details failed for {paper_id}: {str(e)}")
            return None
    
    async def get_referenced_works(self, paper_id: str, limit: int = 8) -> List[PaperBase]:
        """Papers that the seed paper cites (its bibliography / ancestors)."""
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
            response = await self.client.get(f"{self.base_url}/works", params=params)
            response.raise_for_status()
            data = response.json()
            papers = [p for work in data.get('results', []) if (p := self._parse_work_minimal(work))]
            logger.info(f"OpenAlex referenced_works for {paper_id}: {len(papers)} fetched")
            return papers
        except Exception as e:
            logger.error(f"get_referenced_works failed for {paper_id}: {e}")
            return []

    async def get_citing_papers(self, paper_id: str, limit: int = 8) -> List[PaperBase]:
        """Papers that cite the seed paper (its descendants / future impact)."""
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
            response = await self.client.get(f"{self.base_url}/works", params=params)
            response.raise_for_status()
            data = response.json()
            papers = [p for work in data.get('results', []) if (p := self._parse_work_minimal(work))]
            logger.info(f"OpenAlex citing_papers for {paper_id}: {len(papers)} fetched")
            return papers
        except Exception as e:
            logger.error(f"get_citing_papers failed for {paper_id}: {e}")
            return []

    async def get_citation_graph(
        self,
        paper_id: str,
        refs_limit: int = 8,
        citing_limit: int = 8,
    ) -> Dict[str, Any]:
        """Parallel fetch of seed details + referenced works + citing papers."""
        # Fetch all three concurrently
        detail_task = self.get_paper_details(paper_id)
        refs_task = self.get_referenced_works(paper_id, limit=refs_limit)
        citing_task = self.get_citing_papers(paper_id, limit=citing_limit)

        detail, references, cited_by = await asyncio.gather(
            detail_task, refs_task, citing_task
        )

        seed = None
        total_cited_by_count = 0
        total_references_count = 0

        if detail:
            authors = self._extract_authors(detail.get('authorships', []))
            abstract = self._reconstruct_abstract(detail.get('abstract_inverted_index')) or ''
            paper_id_clean = detail['id'].split('/')[-1]
            seed = PaperBase(
                id=paper_id_clean,
                title=detail.get('title', 'Unknown'),
                year=detail.get('publication_year'),
                citations=detail.get('cited_by_count', 0),
                abstract=abstract[:800],
                authors=authors,
            )
            total_cited_by_count = detail.get('cited_by_count', 0)
            total_references_count = len(detail.get('referenced_works', []))

        return {
            'seed': seed,
            'references': references,
            'cited_by': cited_by,
            'total_cited_by_count': total_cited_by_count,
            'total_references_count': total_references_count,
        }

    async def get_related_papers(self, paper_id: str, limit: int = 5) -> List[PaperBase]:
        params = {
            "per_page": limit,
            "mailto": self.email
        }
        if self.api_key:
            params["api_key"] = self.api_key
            
        try:
            response = await self.client.get(
                f"{self.base_url}/works/{paper_id}/related_works",
                params=params
            )
            response.raise_for_status()
            data = response.json()
            
            papers = []
            for work in data.get('results', []):
                paper = self._parse_work_to_paper(work)
                if paper:
                    papers.append(paper)
            
            logger.info(f"OpenAlex related papers for {paper_id} returned {len(papers)} results")
            return papers
        except Exception as e:
            logger.error(f"OpenAlex get_related_papers failed for {paper_id}: {str(e)}")
            return []

@lru_cache()
def get_openalex_service(client: Optional[httpx.AsyncClient] = None) -> OpenAlexService:
    return OpenAlexService(client=client)
