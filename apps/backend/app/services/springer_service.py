"""
Springer Nature service using the standardized BaseExternalClient.

Integrates two Springer Nature APIs from https://dev.springernature.com:
  * Meta API          (https://api.springernature.com/meta/v2/json) — versioned
    metadata for 16M+ documents (journal articles, book chapters, protocols).
  * Open Access API   (https://api.springernature.com/openaccess/json) — metadata
    and full-text open access articles/chapters.

Both share the same response shape (`records`, `result[0].total`, `facets`) and
authenticate via an `api_key` query parameter.
Rate limits: Free tier 100 requests/minute, standard 5 requests/second.
"""

import httpx
import hashlib
import re
from typing import List, Dict, Any, Optional
import asyncio

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("springer")

# Springer APIs cap page size at 100 and default to 10.
SPRINGER_MAX_PAGE_SIZE = 100


class SpringerService(BaseExternalClient):
    """
    Springer Nature Meta + Open Access API client.

    Supports both SPRINGER_META_API_KEY and SPRINGER_OPEN_ACCESS_API_KEY
    from https://dev.springernature.com.
    """

    def __init__(
        self,
        client: Optional[httpx.AsyncClient] = None,
        meta_api_key: Optional[str] = None,
        open_access_api_key: Optional[str] = None,
    ):
        self.meta_api_key = meta_api_key or settings.springer_meta_key
        self.open_access_api_key = open_access_api_key or settings.springer_oa_key
        primary_key = self.meta_api_key or self.open_access_api_key or settings.SPRINGER_API_KEY
        super().__init__(
            base_url=settings.SPRINGER_API_URL,
            service_name="Springer Nature",
            timeout=15.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=primary_key,
            rate_limit_per_minute=settings.SPRINGER_RATE_LIMIT_PER_MINUTE,
            client=client,  # inject the shared app-level httpx client when available
        )

    @property
    def is_configured(self) -> bool:
        """Whether at least one Springer API key is configured."""
        return bool(self.meta_api_key or self.open_access_api_key or self.api_key)

    @property
    def is_meta_configured(self) -> bool:
        """Whether Meta API key is configured."""
        return bool(self.meta_api_key)

    @property
    def is_oa_configured(self) -> bool:
        """Whether Open Access API key is configured."""
        return bool(self.open_access_api_key)

    def _build_headers(self, additional_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Springer uses an api_key query parameter instead of Authorization header."""
        headers = super()._build_headers(additional_headers)
        if "Authorization" in headers:
            del headers["Authorization"]
        return headers

    @staticmethod
    def _parse_abstract(abstract: Any, max_chars: int = 1500) -> str:
        """Abstract may be a plain string or a dict like {"p": ["paragraph", ...]}."""
        if not abstract:
            return ""
        if isinstance(abstract, str):
            text = abstract
        elif isinstance(abstract, dict):
            # Medline- or PAM-style structured abstract with a "p" (paragraphs) list
            paragraphs = abstract.get("p")
            if isinstance(paragraphs, list):
                text = " ".join(str(p) for p in paragraphs)
            elif isinstance(paragraphs, (str, int, float)):
                text = str(paragraphs)
            else:
                text = " ".join(
                    f"{k}: {v}" for k, v in abstract.items()
                    if isinstance(v, (str, int, float))
                )
        else:
            text = str(abstract)

        cleaned = re.sub(r"<[^>]+>", "", text).strip()
        return cleaned[:max_chars]

    @staticmethod
    def _parse_authors(creators: Any) -> List[str]:
        """Authors arrive as [{"creator": "Mishra, Mitali"}, ...]."""
        if not isinstance(creators, list):
            return []
        authors = []
        for item in creators[:5]:
            if isinstance(item, dict) and item.get("creator"):
                authors.append(str(item["creator"]).strip())
        return authors

    @staticmethod
    def _parse_year(record: Dict[str, Any]) -> Optional[int]:
        for key in ("publicationDate", "onlineDate", "printDate", "copyrightYear"):
            value = record.get(key)
            if not value:
                continue
            if isinstance(value, int):
                return value
            text = str(value)
            match = re.match(r"(\d{4})", text)
            if match:
                return int(match.group(1))
        return None

    def _parse_record(self, record: Dict[str, Any], source: str) -> Optional[PaperBase]:
        """Parse a Springer record into PaperBase. Requires a title."""
        title = (record.get("title") or "").strip()
        if not title:
            return None

        # Clean DOI
        doi = (record.get("doi") or "").strip()
        if not doi and isinstance(record.get("identifier"), list):
            for ident in record["identifier"]:
                if isinstance(ident, dict):
                    id_val = str(ident.get("id", "")).strip()
                    if id_val.lower().startswith("doi:"):
                        doi = id_val[4:].strip()
                        break
                elif isinstance(ident, str) and ident.lower().startswith("doi:"):
                    doi = ident[4:].strip()
                    break

        # Extract URLs (HTML web URL and PDF URL)
        web_url = None
        pdf_url = record.get("pdfUrl") or None
        raw_url = record.get("url")
        if isinstance(raw_url, list):
            for item in raw_url:
                if isinstance(item, dict):
                    fmt = str(item.get("format", "")).lower()
                    val = item.get("value")
                    if fmt == "html" and not web_url:
                        web_url = val
                    elif fmt == "pdf" and not pdf_url:
                        pdf_url = val
                    elif not web_url and val:
                        web_url = val
                elif isinstance(item, str) and not web_url:
                    web_url = item
        elif isinstance(raw_url, str):
            web_url = raw_url

        if doi:
            paper_id = f"springer:{doi}"
            url = web_url or f"https://doi.org/{doi}"
        else:
            ref_val = web_url or title
            paper_id = f"springer:{hashlib.sha1(str(ref_val).encode()).hexdigest()[:10]}"
            url = web_url or None

        # Determine open access status
        oa_val = record.get("openaccess")
        if oa_val is None:
            oa_val = record.get("openAccess")
        is_oa = str(oa_val).lower() in ("true", "1") or (source == "SpringerOpen")

        if not pdf_url and is_oa and doi:
            pdf_url = f"https://link.springer.com/content/pdf/{doi}.pdf"

        return PaperBase(
            id=paper_id,
            title=title,
            year=self._parse_year(record),
            citations=0,
            abstract=self._parse_abstract(record.get("abstract")),
            authors=self._parse_authors(record.get("creators")),
            doi=doi or None,
            url=url,
            pdf_url=pdf_url,
            publisher=record.get("publicationName") or record.get("publisher") or "Springer Nature",
            source=source,
        )

    async def search_meta(
        self,
        query: str,
        limit: int = 10,
        start: int = 1,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[PaperBase]:
        """
        Query the Meta API (/meta/v2/json) for versioned metadata records.
        Uses SPRINGER_META_API_KEY.
        """
        if not self.is_meta_configured:
            logger.warning("SPRINGER_META_API_KEY not set — skipping Springer Meta search")
            return []

        return await self._search(
            endpoint="meta/v2/json",
            query=query,
            limit=limit,
            start=start,
            filters=filters,
            source="Springer Meta",
            api_key=self.meta_api_key,
        )

    async def search_openaccess(
        self,
        query: str,
        limit: int = 10,
        start: int = 1,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[PaperBase]:
        """
        Query the Open Access API (/openaccess/json) for OA records + full-text URLs.
        Uses SPRINGER_OPEN_ACCESS_API_KEY.
        """
        if not self.is_oa_configured:
            logger.warning("SPRINGER_OPEN_ACCESS_API_KEY not set — skipping Springer Open Access search")
            return []

        return await self._search(
            endpoint="openaccess/json",
            query=query,
            limit=limit,
            start=start,
            filters=filters,
            source="SpringerOpen",
            api_key=self.open_access_api_key,
        )

    async def _search(
        self,
        endpoint: str,
        query: str,
        limit: int,
        start: int = 1,
        filters: Optional[Dict[str, Any]] = None,
        source: str = "Springer",
        api_key: Optional[str] = None,
    ) -> List[PaperBase]:
        key = api_key or self.api_key
        if not key:
            logger.warning(f"No API key provided for {source} — skipping search")
            return []

        params: Dict[str, Any] = {
            "q": self._build_query(query, filters),
            "p": min(max(1, limit), SPRINGER_MAX_PAGE_SIZE),
            "s": max(1, start),
            "api_key": key,
        }

        try:
            data = await self.get(
                endpoint,
                params=params,
                use_cache=True,
                cache_ttl=3600,
            )
            records = data.get("records") or []
            papers = [
                p for record in records
                if (p := self._parse_record(record, source))
            ]
            logger.info(f"Springer {source} '{query}': {len(papers)} papers")
            return papers
        except ExternalAPIError as e:
            logger.warning(f"Springer {source} search failed for '{query}': {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in Springer {source} search: {e}")
            return []

    @staticmethod
    def _build_query(query: str, filters: Optional[Dict[str, Any]] = None) -> str:
        """Compose a Springer q string from the raw query plus optional filters."""
        # `q` uses Solr-style syntax; wrap bare multi-word text in quotes unless already syntax-qualified.
        q = f'"{query}"' if (" " in query and ":" not in query and '"' not in query) else query
        clauses = [q]
        if filters:
            if filters.get("year"):
                clauses.append(f"year:{filters['year']}")
            if filters.get("min_year"):
                clauses.append(f"year:[{filters['min_year']} TO *]")
            if filters.get("max_year"):
                clauses.append(f"year:[* TO {filters['max_year']}]")
            if filters.get("type"):
                clauses.append(f'type:"{filters["type"]}"')
            if filters.get("journal"):
                clauses.append(f'journal:"{filters["journal"]}"')
            if filters.get("subject"):
                clauses.append(f'subject:"{filters["subject"]}"')
            if filters.get("doi"):
                clauses.append(f'doi:{filters["doi"]}')
        return " AND ".join(clauses)

    async def search_papers(
        self,
        query: str,
        limit: int = 10,
        open_access_only: bool = False,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[PaperBase]:
        """
        Search papers across Springer APIs.
        If open_access_only=True, only calls Open Access API.
        Otherwise fans out to Meta API and Open Access API concurrently,
        deduplicating by DOI/ID.
        """
        if not self.is_configured:
            return []

        if open_access_only:
            return await self.search_openaccess(query=query, limit=limit, filters=filters)

        per_source = max(5, limit // 2)
        tasks = []
        if self.is_meta_configured:
            tasks.append(self.search_meta(query, limit=per_source, filters=filters))
        if self.is_oa_configured:
            tasks.append(self.search_openaccess(query, limit=per_source, filters=filters))

        if not tasks:
            return []

        results = await asyncio.gather(*tasks, return_exceptions=True)

        papers: List[PaperBase] = []
        seen_ids = set()
        for batch in results:
            if isinstance(batch, list):
                for p in batch:
                    if p.id not in seen_ids:
                        papers.append(p)
                        seen_ids.add(p.id)
        return papers

    async def get_paper_by_doi(self, doi: str) -> Optional[PaperBase]:
        """
        Lookup a single paper by DOI across Springer Open Access and Meta APIs.
        Prioritizes Open Access API to acquire open access PDF URL if available.
        """
        clean_doi = doi.strip()
        for prefix in ("doi:", "https://doi.org/", "http://dx.doi.org/", "http://doi.org/"):
            if clean_doi.lower().startswith(prefix):
                clean_doi = clean_doi[len(prefix):]
                break

        query = f"doi:{clean_doi}"

        # 1. Try Open Access API first
        if self.is_oa_configured:
            oa_results = await self.search_openaccess(query=query, limit=1)
            for p in oa_results:
                if p.doi and p.doi.lower() == clean_doi.lower():
                    return p

        # 2. Try Meta API
        if self.is_meta_configured:
            meta_results = await self.search_meta(query=query, limit=1)
            for p in meta_results:
                if p.doi and p.doi.lower() == clean_doi.lower():
                    return p

        return None


# Singleton pattern for service instance
_springer_singleton: Optional[SpringerService] = None


def get_springer_service(client: Optional[httpx.AsyncClient] = None) -> SpringerService:
    """Get or create Springer Nature service instance."""
    global _springer_singleton
    if client is not None:
        return SpringerService(client=client)
    if _springer_singleton is None:
        _springer_singleton = SpringerService()
    return _springer_singleton