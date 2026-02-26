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
            abstract=abstract[:1500],
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
            abstract=abstract[:1500],
            authors=authors
        )

    async def search_papers(
        self,
        query: str,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None
    ) -> List[PaperBase]:
        # Try to get from cache
        cache_key = cache.make_key("openalex:search", query, limit, filters=filters, sort=sort)
        cached_results = await cache.get(cache_key)
        if cached_results:
            logger.info(f"OpenAlex cache hit for '{query}'")
            return [PaperBase(**p) for p in cached_results]

        params = {
            "search": query,
            "per_page": min(limit, settings.MAX_PAPERS_PER_QUERY),
            "select": "id,title,publication_year,cited_by_count,abstract_inverted_index,authorships",
            "mailto": self.email
        }

        if sort:
            params["sort"] = sort

        if self.api_key:
            params["api_key"] = self.api_key

        # Build filter string — only require abstracts when no explicit filters given
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
            response = await self.client.get(f"{self.base_url}/works", params=params)
            response.raise_for_status()
            data = response.json()

            papers = []
            for work in data.get('results', []):
                # Use minimal parser to avoid dropping papers without abstracts
                paper = self._parse_work_minimal(work)
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
                abstract=abstract[:1500],
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

    async def get_citation_graph_abstract(self, paper_id: str) -> str:
        """Return abstract[:1500] for the seed paper in the citation graph view."""
        detail = await self.get_paper_details(paper_id)
        if detail:
            return self._reconstruct_abstract(detail.get('abstract_inverted_index')) or ''
        return ''


# ─── Factory — no lru_cache because AsyncClient is not hashable and causes stale-client bugs
_openalex_singleton: Optional[OpenAlexService] = None

def get_openalex_service(client: Optional[httpx.AsyncClient] = None) -> OpenAlexService:
    global _openalex_singleton
    if client is not None:
        # Called with a shared app client — return a fresh wrapper each time
        return OpenAlexService(client=client)
    if _openalex_singleton is None:
        _openalex_singleton = OpenAlexService()
    return _openalex_singleton


# ─── Semantic Scholar Service ─────────────────────────────────────────────────

s2_logger = get_logger("semantic_scholar")

class SemanticScholarService:
    """
    Free-tier Semantic Scholar Academic Graph API.
    No API key required for basic usage (100 req/5 min).
    Provides complementary coverage to OpenAlex, especially strong for CS/AI papers.
    """
    BASE_URL = "https://api.semanticscholar.org/graph/v1"
    FIELDS = "paperId,title,year,citationCount,abstract,authors"

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=15.0)
        return self._client

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
    ) -> List[PaperBase]:
        """Search Semantic Scholar for papers matching query."""
        cache_key = f"s2:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        params = {
            "query": query,
            "limit": min(limit, 50),
            "fields": self.FIELDS,
        }
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/paper/search",
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            papers = [
                p for item in data.get("data", [])
                if (p := self._parse_s2_paper(item))
            ]
            s2_logger.info(f"Semantic Scholar '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            s2_logger.warning(f"Semantic Scholar search failed for '{query}': {e}")
            return []


_s2_singleton: Optional[SemanticScholarService] = None

def get_semantic_scholar_service(client: Optional[httpx.AsyncClient] = None) -> SemanticScholarService:
    global _s2_singleton
    if client is not None:
        return SemanticScholarService(client=client)
    if _s2_singleton is None:
        _s2_singleton = SemanticScholarService()
    return _s2_singleton


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
        """Parse a single Atom feed <entry> element (already converted to dict)."""
        import xml.etree.ElementTree as ET
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

        return PaperBase(
            id=f"arxiv:{arxiv_id}",
            title=title,
            year=year,
            citations=0,  # arXiv feed doesn't provide citation counts
            abstract=abstract[:1500],
            authors=authors,
        )

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        """Search arXiv using the public query API."""
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

            import xml.etree.ElementTree as ET
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
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
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


# ─── CORE API Service ─────────────────────────────────────────────────────────

core_logger = get_logger("core_api")

class COREService:
    """
    CORE Aggregator API v3 (https://core.ac.uk/services/api).
    Aggregates open-access papers from thousands of repositories worldwide,
    including many African institutional repositories.
    Requires a free API key from https://core.ac.uk/register.
    Rate limit: 10 req/min (free), 150 req/min (premium).
    """

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=15.0)
        return self._client

    def _parse_paper(self, item: Dict[str, Any]) -> Optional[PaperBase]:
        title = (item.get("title") or "").strip()
        core_id = str(item.get("id") or "")
        if not title or not core_id:
            return None
        abstract = (item.get("abstract") or "")[:1500]
        authors = [
            a.get("name", "") for a in (item.get("authors") or [])[:5]
            if a.get("name")
        ]
        year = None
        pub_date = item.get("publishedDate") or item.get("yearPublished")
        if pub_date:
            try:
                year = int(str(pub_date)[:4])
            except ValueError:
                pass
        return PaperBase(
            id=f"core:{core_id}",
            title=title,
            year=year,
            citations=0,
            abstract=abstract,
            authors=authors,
        )

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        if not settings.CORE_API_KEY:
            core_logger.warning("CORE_API_KEY not set — skipping CORE search")
            return []

        cache_key = f"core:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        headers = {"Authorization": f"Bearer {settings.CORE_API_KEY}"}
        payload = {"q": query, "limit": min(limit, 25), "offset": 0}
        try:
            response = await self.client.post(
                f"{settings.CORE_API_URL}/search/works",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            papers = [
                p for item in data.get("results", [])
                if (p := self._parse_paper(item))
            ]
            core_logger.info(f"CORE '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            core_logger.warning(f"CORE search failed for '{query}': {e}")
            return []


_core_singleton: Optional[COREService] = None

def get_core_service(client: Optional[httpx.AsyncClient] = None) -> COREService:
    global _core_singleton
    if client is not None:
        return COREService(client=client)
    if _core_singleton is None:
        _core_singleton = COREService()
    return _core_singleton


# ─── Elsevier / Scopus Service ────────────────────────────────────────────────

elsevier_logger = get_logger("elsevier")

class ElsevierService:
    """
    Elsevier Scopus Search API (https://dev.elsevier.com/documentation/ScopusSearchAPI.wadl).
    Requires a free Elsevier Developer API key from https://dev.elsevier.com.
    Returns metadata (title, authors, abstract, citation count) for Scopus-indexed papers.
    Rate limit: 20,000 req/week (free institutional key).
    """

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=15.0)
        return self._client

    def _parse_entry(self, entry: Dict[str, Any]) -> Optional[PaperBase]:
        title = (entry.get("dc:title") or "").strip()
        scopus_id = entry.get("dc:identifier", "").replace("SCOPUS_ID:", "")
        if not title or not scopus_id:
            return None
        abstract = (entry.get("dc:description") or "")[:1500]
        # Authors: "authname" is a semicolon-separated string in some responses
        raw_authors = entry.get("dc:creator") or ""
        authors = [a.strip() for a in raw_authors.split(";") if a.strip()][:5]
        year = None
        cover_date = entry.get("prism:coverDate") or ""
        if cover_date and len(cover_date) >= 4:
            try:
                year = int(cover_date[:4])
            except ValueError:
                pass
        citations = 0
        try:
            citations = int(entry.get("citedby-count") or 0)
        except (ValueError, TypeError):
            pass
        return PaperBase(
            id=f"scopus:{scopus_id}",
            title=title,
            year=year,
            citations=citations,
            abstract=abstract,
            authors=authors,
        )

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        if not settings.ELSEVIER_API_KEY:
            elsevier_logger.warning("ELSEVIER_API_KEY not set — skipping Scopus search")
            return []

        cache_key = f"scopus:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        headers = {
            "X-ELS-APIKey": settings.ELSEVIER_API_KEY,
            "Accept": "application/json",
        }
        if settings.ELSEVIER_INST_TOKEN:
            headers["X-ELS-Insttoken"] = settings.ELSEVIER_INST_TOKEN

        params = {
            "query": query,
            "count": min(limit, 25),
            "field": "dc:identifier,dc:title,dc:creator,dc:description,prism:coverDate,citedby-count",
        }
        try:
            response = await self.client.get(
                settings.SCOPUS_API_URL,
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            entries = (
                data.get("search-results", {}).get("entry") or []
            )
            papers = [
                p for entry in entries
                if (p := self._parse_entry(entry))
            ]
            elsevier_logger.info(f"Scopus '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            elsevier_logger.warning(f"Scopus search failed for '{query}': {e}")
            return []


_elsevier_singleton: Optional[ElsevierService] = None

def get_elsevier_service(client: Optional[httpx.AsyncClient] = None) -> ElsevierService:
    global _elsevier_singleton
    if client is not None:
        return ElsevierService(client=client)
    if _elsevier_singleton is None:
        _elsevier_singleton = ElsevierService()
    return _elsevier_singleton


# ─── PubMed / NCBI E-utilities Service ────────────────────────────────────────

pubmed_logger = get_logger("pubmed")

class PubMedService:
    """
    NCBI E-utilities API for PubMed (https://www.ncbi.nlm.nih.gov/home/develop/api/).
    No API key required for basic use (3 req/s); provide PUBMED_API_KEY for 10 req/s.
    Excellent for biomedical, public health, and life sciences — highly relevant
    for African health research (malaria, HIV, maternal health, etc.).
    Two-step: esearch (get IDs) → efetch (get abstracts in XML).
    """

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=20.0)
        return self._client

    def _base_params(self) -> Dict[str, str]:
        params: Dict[str, str] = {"retmode": "json"}
        if settings.PUBMED_API_KEY:
            params["api_key"] = settings.PUBMED_API_KEY
        return params

    async def _esearch(self, query: str, limit: int) -> List[str]:
        """Return a list of PubMed IDs for the query."""
        params = {
            **self._base_params(),
            "db": "pubmed",
            "term": query,
            "retmax": min(limit, 25),
            "usehistory": "n",
        }
        response = await self.client.get(
            f"{settings.PUBMED_API_URL}/esearch.fcgi", params=params
        )
        response.raise_for_status()
        data = response.json()
        return data.get("esearchresult", {}).get("idlist", [])

    async def _efetch(self, pmids: List[str]) -> List[PaperBase]:
        """Fetch paper details for a list of PMIDs, parse XML."""
        import xml.etree.ElementTree as ET

        fetch_params = {
            **self._base_params(),
            "db": "pubmed",
            "id": ",".join(pmids),
            "rettype": "abstract",
            "retmode": "xml",
        }
        response = await self.client.get(
            f"{settings.PUBMED_API_URL}/efetch.fcgi", params=fetch_params
        )
        response.raise_for_status()

        papers: List[PaperBase] = []
        root = ET.fromstring(response.text)
        for article_el in root.findall(".//PubmedArticle"):
            try:
                pmid_el = article_el.find(".//PMID")
                pmid = pmid_el.text if pmid_el is not None else None
                if not pmid:
                    continue

                title_el = article_el.find(".//ArticleTitle")
                title = "".join(title_el.itertext()).strip() if title_el is not None else ""
                if not title:
                    continue

                # Abstract (may have multiple AbstractText sections)
                abstract_parts = [
                    "".join(el.itertext())
                    for el in article_el.findall(".//AbstractText")
                ]
                abstract = " ".join(abstract_parts)[:1500]

                # Authors
                authors: List[str] = []
                for author_el in article_el.findall(".//Author")[:5]:
                    last = getattr(author_el.find("LastName"), "text", "") or ""
                    fore = getattr(author_el.find("ForeName"), "text", "") or ""
                    name = f"{fore} {last}".strip()
                    if name:
                        authors.append(name)

                # Year
                year_el = article_el.find(".//PubDate/Year")
                year = None
                if year_el is not None and year_el.text:
                    try:
                        year = int(year_el.text)
                    except ValueError:
                        pass

                papers.append(PaperBase(
                    id=f"pubmed:{pmid}",
                    title=title,
                    year=year,
                    citations=0,   # PubMed free tier doesn't expose citation counts
                    abstract=abstract,
                    authors=authors,
                ))
            except Exception as parse_err:
                pubmed_logger.debug(f"PubMed parse error for article: {parse_err}")
                continue
        return papers

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        cache_key = f"pubmed:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        try:
            pmids = await self._esearch(query, limit)
            if not pmids:
                return []
            papers = await self._efetch(pmids)
            pubmed_logger.info(f"PubMed '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            pubmed_logger.warning(f"PubMed search failed for '{query}': {e}")
            return []


_pubmed_singleton: Optional[PubMedService] = None

def get_pubmed_service(client: Optional[httpx.AsyncClient] = None) -> PubMedService:
    global _pubmed_singleton
    if client is not None:
        return PubMedService(client=client)
    if _pubmed_singleton is None:
        _pubmed_singleton = PubMedService()
    return _pubmed_singleton


# ─── DOAJ — Directory of Open Access Journals ─────────────────────────────────

doaj_logger = get_logger("doaj")

class DOAJService:
    """
    DOAJ Article Search API (https://doaj.org/api/docs).
    No API key required. Indexes thousands of open-access journals, including
    a strong representation of African and Global-South publishers.
    Rate limit: ~2 req/s (polite use).
    """

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=15.0)
        return self._client

    def _parse_result(self, result: Dict[str, Any]) -> Optional[PaperBase]:
        bibjson = result.get("bibjson") or {}
        title = (bibjson.get("title") or "").strip()
        doaj_id = result.get("id") or ""
        if not title or not doaj_id:
            return None

        # Abstract
        abstract = (bibjson.get("abstract") or "")[:1500]

        # Authors
        authors = [
            a.get("name", "") for a in (bibjson.get("author") or [])[:5]
            if a.get("name")
        ]

        # Year
        year = None
        year_raw = bibjson.get("year")
        if year_raw:
            try:
                year = int(str(year_raw)[:4])
            except ValueError:
                pass

        return PaperBase(
            id=f"doaj:{doaj_id}",
            title=title,
            year=year,
            citations=0,
            abstract=abstract,
            authors=authors,
        )

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        cache_key = f"doaj:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        params = {
            "q": query,
            "pageSize": min(limit, 25),
            "page": 1,
            "sort": "relevance",
        }
        try:
            response = await self.client.get(settings.DOAJ_API_URL, params=params)
            response.raise_for_status()
            data = response.json()
            papers = [
                p for result in data.get("results", [])
                if (p := self._parse_result(result))
            ]
            doaj_logger.info(f"DOAJ '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            doaj_logger.warning(f"DOAJ search failed for '{query}': {e}")
            return []


_doaj_singleton: Optional[DOAJService] = None

def get_doaj_service(client: Optional[httpx.AsyncClient] = None) -> DOAJService:
    global _doaj_singleton
    if client is not None:
        return DOAJService(client=client)
    if _doaj_singleton is None:
        _doaj_singleton = DOAJService()
    return _doaj_singleton


# ─── AJOL — African Journals Online (OAI-PMH) ─────────────────────────────────

ajol_logger = get_logger("ajol")

class AJOLService:
    """
    African Journals Online (https://www.ajol.info) via OAI-PMH 2.0 protocol.
    No API key required. The largest platform for African-published peer-reviewed
    journals covering agriculture, health, science, social sciences, and humanities.
    OAI-PMH ListRecords endpoint is used; results are filtered by keyword match.
    """

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=20.0)
        return self._client

    def _parse_oai_record(self, record_el: Any, ns: Dict[str, str]) -> Optional[PaperBase]:
        import xml.etree.ElementTree as ET

        header = record_el.find("oai:header", ns)
        if header is None:
            return None
        identifier = getattr(header.find("oai:identifier", ns), "text", "") or ""

        metadata_el = record_el.find("oai:metadata", ns)
        if metadata_el is None:
            return None
        dc = metadata_el.find("oai_dc:dc", ns)
        if dc is None:
            return None

        def _text(tag: str) -> str:
            el = dc.find(f"dc:{tag}", ns)
            return (el.text or "").strip() if el is not None else ""

        title = _text("title")
        if not title:
            return None

        abstract = _text("description")[:1500]
        authors = [
            el.text.strip()
            for el in dc.findall("dc:creator", ns)
            if el.text
        ][:5]

        year = None
        date_str = _text("date")
        if date_str and len(date_str) >= 4:
            try:
                year = int(date_str[:4])
            except ValueError:
                pass

        record_id = identifier.split(":")[-1].replace("/", "_") if identifier else str(hash(title))
        return PaperBase(
            id=f"ajol:{record_id}",
            title=title,
            year=year,
            citations=0,
            abstract=abstract,
            authors=authors,
        )

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        """
        AJOL does not support full-text search via OAI-PMH directly.
        We use ListRecords with a recent date range and filter by keyword in title/abstract.
        For precise topic search, this is best-effort.
        """
        cache_key = f"ajol:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        import xml.etree.ElementTree as ET

        ns = {
            "oai": "http://www.openarchives.org/OAI/2.0/",
            "oai_dc": "http://www.openarchives.org/OAI/2.0/oai_dc/",
            "dc": "http://purl.org/dc/elements/1.1/",
        }
        params = {
            "verb": "ListRecords",
            "metadataPrefix": "oai_dc",
            "from": "2020-01-01",  # Recent 5 years for relevance
        }
        try:
            response = await self.client.get(settings.AJOL_OAI_URL, params=params)
            response.raise_for_status()
            root = ET.fromstring(response.text)

            query_lower = query.lower()
            papers: List[PaperBase] = []
            for record_el in root.findall(".//oai:record", ns):
                paper = self._parse_oai_record(record_el, ns)
                if paper is None:
                    continue
                # Keyword filter — match query terms against title + abstract
                searchable = f"{paper.title} {paper.abstract}".lower()
                if any(term in searchable for term in query_lower.split()):
                    papers.append(paper)
                    if len(papers) >= limit:
                        break

            ajol_logger.info(f"AJOL '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            ajol_logger.warning(f"AJOL search failed for '{query}': {e}")
            return []


_ajol_singleton: Optional[AJOLService] = None

def get_ajol_service(client: Optional[httpx.AsyncClient] = None) -> AJOLService:
    global _ajol_singleton
    if client is not None:
        return AJOLService(client=client)
    if _ajol_singleton is None:
        _ajol_singleton = AJOLService()
    return _ajol_singleton


# ─── AfricArXiv via DataCite REST API ─────────────────────────────────────────

africarxiv_logger = get_logger("africarxiv")

class AfricArXivService:
    """
    AfricArXiv preprints via the DataCite REST API (https://api.datacite.org/dois).
    AfricArXiv is hosted on OSF and indexed by DataCite.
    No API key required. Covers African research across all disciplines,
    with a focus on open science and reproducibility.
    Filter: client-id=osf.africarxiv
    """

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._client = client

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            return httpx.AsyncClient(timeout=15.0)
        return self._client

    def _parse_doi(self, item: Dict[str, Any]) -> Optional[PaperBase]:
        attrs = item.get("attributes") or {}
        titles = attrs.get("titles") or []
        title = next(
            (t.get("title", "") for t in titles if t.get("title")), ""
        ).strip()
        doi = attrs.get("doi") or ""
        if not title or not doi:
            return None

        # Abstract
        descriptions = attrs.get("descriptions") or []
        abstract = next(
            (d.get("description", "") for d in descriptions if d.get("description")),
            "",
        )[:1500]

        # Authors
        creators = attrs.get("creators") or []
        authors = []
        for c in creators[:5]:
            name = c.get("name") or f"{c.get('givenName', '')} {c.get('familyName', '')}".strip()
            if name:
                authors.append(name)

        # Year
        year = None
        pub_year = attrs.get("publicationYear")
        if pub_year:
            try:
                year = int(pub_year)
            except (ValueError, TypeError):
                pass

        return PaperBase(
            id=f"africarxiv:{doi.replace('/', '_')}",
            title=title,
            year=year,
            citations=0,
            abstract=abstract,
            authors=authors,
        )

    async def search_papers(self, query: str, limit: int = 10) -> List[PaperBase]:
        cache_key = f"africarxiv:search:{query}:{limit}"
        cached = await cache.get(cache_key)
        if cached:
            return [PaperBase(**p) for p in cached]

        params = {
            "query": query,
            "client-id": "osf.africarxiv",
            "page[size]": min(limit, 25),
            "sort": "-relevance",
        }
        try:
            response = await self.client.get(settings.AFRICARXIV_API_URL, params=params)
            response.raise_for_status()
            data = response.json()
            papers = [
                p for item in data.get("data", [])
                if (p := self._parse_doi(item))
            ]
            africarxiv_logger.info(f"AfricArXiv '{query}': {len(papers)} papers")
            if papers:
                await cache.set(cache_key, [p.dict() for p in papers], ttl=3600)
            return papers
        except Exception as e:
            africarxiv_logger.warning(f"AfricArXiv search failed for '{query}': {e}")
            return []


_africarxiv_singleton: Optional[AfricArXivService] = None

def get_africarxiv_service(client: Optional[httpx.AsyncClient] = None) -> AfricArXivService:
    global _africarxiv_singleton
    if client is not None:
        return AfricArXivService(client=client)
    if _africarxiv_singleton is None:
        _africarxiv_singleton = AfricArXivService()
    return _africarxiv_singleton
