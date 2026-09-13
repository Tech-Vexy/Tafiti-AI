"""
Discovery Engine
===============
Orchestrates paper, dataset, and webpage discovery from multiple external APIs.
Feeds results into the Source → Passage → Evidence → Claim pipeline.

Responsibilities:
- Search across OpenAlex, Semantic Scholar, CORE, Scopus, DOAJ, AJOL, AfricArXiv
- Rank and deduplicate results by relevance
- Persist discovered sources as ResearchTask outputs
- Extract key passages from abstracts and full text
"""

import asyncio
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.database import Source, Passage

logger = get_logger("discovery_engine")


class DiscoveryEngine:
    """
    Searches multiple academic APIs in parallel, deduplicates results,
    and persists them as Source + Passage records in the evidence layer.
    """

    # API search methods mapped by service name (strictly configured in .env)
    _search_backends = {
        "openalex": "search_openalex",
        "core": "search_core",
        "elsevier": "search_elsevier",
        "springer": "search_springer",
        "parallel": "search_parallel",
    }

    async def search_all(
        self,
        query: str,
        task_id: str,
        db: AsyncSession,
        max_results: int = 30,
        backends: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Search all configured backends in parallel, deduplicate, and persist results.

        Returns a list of discovered source dicts (already persisted to DB).
        """
        backends = backends or list(self._search_backends.keys())
        tasks = []

        for backend in backends:
            method_name = self._search_backends.get(backend)
            if not method_name:
                continue
            # Import services lazily to avoid circular imports
            method = getattr(self, method_name, None)
            if method:
                tasks.append(self._safe_search(method, query, max_results // len(backends)))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Flatten and deduplicate by DOI or external_id
        all_papers = []
        seen_ids = set()

        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"search_backend_failed: {result}")
                continue
            for paper in result:
                # Deduplicate by DOI or external_id
                dedup_key = paper.get("doi") or paper.get("external_id", "")
                if dedup_key and dedup_key in seen_ids:
                    continue
                if dedup_key:
                    seen_ids.add(dedup_key)
                all_papers.append(paper)

        # Sort by citation count (descending) and limit
        all_papers.sort(key=lambda p: p.get("citation_count", 0) or 0, reverse=True)
        all_papers = all_papers[:max_results]

        # Persist to database
        persisted = await self._persist_sources(all_papers, task_id, db)

        logger.info(
            f"discovery_complete query='{query[:50]}' "
            f"results={len(persisted)} backends={backends}"
        )

        return persisted

    async def _safe_search(self, method, query: str, limit: int) -> list[dict]:
        """Run a search method with error handling."""
        try:
            return await method(query, limit)
        except Exception as e:
            logger.warning(f"search_method_failed: {e}")
            return []

    async def search_openalex(self, query: str, limit: int) -> list[dict]:
        """Search OpenAlex for papers."""
        try:
            from app.services.openalex_service import OpenAlexService
            service = OpenAlexService()
            results = await service.search_papers(query, limit=limit)
            return [
                {
                    "external_id": r.get("id", ""),
                    "source_type": "paper",
                    "title": r.get("title", ""),
                    "authors": [a.get("name", "") for a in r.get("authorships", [])],
                    "year": r.get("publication_year"),
                    "journal": r.get("primary_location", {}).get("source", {}).get("display_name") if r.get("primary_location") else None,
                    "doi": r.get("doi"),
                    "url": r.get("id"),
                    "abstract": r.get("abstract", ""),
                    "citation_count": r.get("cited_by_count", 0),
                    "relevance_score": min(100, (r.get("relevance_score", 0) or 0)),
                }
                for r in results
            ]
        except Exception as e:
            logger.warning(f"openalex_search_failed: {e}")
            return []

    async def search_elsevier(self, query: str, limit: int) -> list[dict]:
        """Search Elsevier / Scopus for papers."""
        try:
            from app.services.elsevier_service import get_elsevier_service
            service = get_elsevier_service()
            if not service.is_configured:
                return []
            results = await service.search_papers(query, limit=limit)
            return [
                {
                    "external_id": r.id,
                    "source_type": "paper",
                    "title": r.title,
                    "authors": r.authors,
                    "year": r.year,
                    "journal": getattr(r, "publisher", None),
                    "doi": getattr(r, "doi", None),
                    "url": getattr(r, "url", None),
                    "abstract": r.abstract or "",
                    "citation_count": r.citations or 0,
                    "relevance_score": 85,
                }
                for r in results
            ]
        except Exception as e:
            logger.warning(f"elsevier_search_failed: {e}")
            return []

    async def search_core(self, query: str, limit: int) -> list[dict]:
        """Search CORE Aggregator API v3 for papers."""
        try:
            from app.services.core_service import get_core_service
            service = get_core_service()
            if not service.is_configured:
                return []
            results = await service.search_papers(query, limit=limit)
            return [
                {
                    "external_id": r.id,
                    "source_type": "paper",
                    "title": r.title,
                    "authors": r.authors,
                    "year": r.year,
                    "journal": getattr(r, "publisher", None),
                    "doi": getattr(r, "doi", None),
                    "url": getattr(r, "url", None) or f"https://core.ac.uk/works/{r.id.replace('core:', '')}",
                    "abstract": r.abstract or "",
                    "citation_count": r.citations or 0,
                    "relevance_score": 75,
                }
                for r in results
            ]
        except Exception as e:
            logger.warning(f"core_search_failed: {e}")
            return []

    async def search_springer(self, query: str, limit: int) -> list[dict]:
        """Search Springer Nature Meta and Open Access APIs for papers."""
        try:
            from app.services.springer_service import get_springer_service
            service = get_springer_service()
            if not service.is_configured:
                return []
            results = await service.search_papers(query, limit=limit)
            return [
                {
                    "external_id": r.id,
                    "source_type": "paper",
                    "title": r.title,
                    "authors": r.authors,
                    "year": r.year,
                    "journal": getattr(r, "publisher", None),
                    "doi": getattr(r, "doi", None),
                    "url": getattr(r, "url", None),
                    "pdf_url": getattr(r, "pdf_url", None),
                    "abstract": r.abstract or "",
                    "citation_count": r.citations or 0,
                    "relevance_score": 85,
                }
                for r in results
            ]
        except Exception as e:
            logger.warning(f"springer_search_failed: {e}")
            return []

    async def search_parallel(self, query: str, limit: int) -> list[dict]:
        """Search Parallel Web Systems for citation-aware web evidence."""
        try:
            from app.services.parallel_service import get_parallel_service
            service = get_parallel_service()
            if not service.is_configured:
                return []
            results = await service.search_papers(query, limit=limit)
            return [
                {
                    "external_id": r.id,
                    "source_type": "webpage",
                    "title": r.title,
                    "authors": r.authors,
                    "year": r.year,
                    "journal": getattr(r, "publisher", None),
                    "doi": getattr(r, "doi", None),
                    "url": getattr(r, "url", None),
                    "abstract": r.abstract or "",
                    "citation_count": r.citations or 0,
                    "relevance_score": 80,
                }
                for r in results
            ]
        except Exception as e:
            logger.warning(f"parallel_search_failed: {e}")
            return []

    async def _persist_sources(
        self, papers: list[dict], task_id: str, db: AsyncSession
    ) -> list[dict]:
        """Persist discovered papers as Source records with extracted passages."""
        persisted = []

        for paper in papers:
            source = Source(
                task_id=task_id,
                external_id=paper.get("external_id"),
                source_type=paper.get("source_type", "paper"),
                title=paper.get("title", ""),
                authors=paper.get("authors", []),
                year=paper.get("year"),
                journal=paper.get("journal"),
                doi=paper.get("doi"),
                url=paper.get("url"),
                abstract=paper.get("abstract", ""),
                citation_count=paper.get("citation_count"),
                relevance_score=paper.get("relevance_score", 0),
                source_metadata=paper.get("metadata", {}),
            )
            db.add(source)
            await db.flush()  # get the ID

            # Extract passage from abstract if available
            abstract = paper.get("abstract", "")
            if abstract and len(abstract) > 50:
                passage = Passage(
                    source_id=source.id,
                    content=abstract[:2000],  # cap at 2000 chars
                    section="Abstract",
                    position=0,
                )
                db.add(passage)

            persisted.append({
                "id": source.id,
                "external_id": source.external_id,
                "source_type": source.source_type,
                "title": source.title,
                "authors": source.authors,
                "year": source.year,
                "journal": source.journal,
                "doi": source.doi,
                "url": source.url,
                "abstract": source.abstract,
                "citation_count": source.citation_count,
                "relevance_score": source.relevance_score,
            })

        await db.commit()
        return persisted


# Singleton
discovery_engine = DiscoveryEngine()
