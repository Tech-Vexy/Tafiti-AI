"""
Parallel Web Systems SDK Integration (https://parallel.ai)
Provides:
1. Natural language web search returning LLM-optimized excerpts (Parallel Search API)
2. OpenAI-compatible tool definition for agent function calling (search_web)
3. Agno Toolkit (ParallelTools) for seamless research agent integration
4. Multi-hop deep research agent execution (Parallel Task API)
5. Web page extraction into clean markdown (Parallel Extract API)
"""

from typing import List, Dict, Any, Optional, Union
import hashlib
from urllib.parse import urlparse

from parallel import Parallel, AsyncParallel
from parallel.types import SearchResult
from parallel.types.task_run_result import TaskRunResult

from agno.tools.toolkit import Toolkit

from app.core.config import settings
from app.core.logger import get_logger
from app.core.cache import cache
from app.models.schemas import PaperBase

logger = get_logger("parallel_service")

# Exact OpenAI function-calling tool definition for Parallel Search
PARALLEL_SEARCH_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "search_web",
        "description": (
            "Searches the live web using a natural-language objective plus keyword queries, "
            "returning LLM-optimized excerpts (pre-compressed, citation-aware) ready to feed "
            "into model context. Use whenever the model needs current facts, specific named entities, "
            "recent events, or information that likely isn't in training data. Prefer over repeated "
            "keyword searches — one call covers the ground of 2-3 traditional queries with better relevance."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "objective": {
                    "type": "string",
                    "description": (
                        "A concise, self-contained search query. Must include the key entity or topic being searched for."
                    ),
                },
                "search_queries": {
                    "type": "array",
                    "description": (
                        "2-3 diverse keyword search queries, each 3-6 words. Must be diverse — vary entity names, "
                        "synonyms, and angles. Each query must include the key entity or topic. "
                        "NEVER write sentences, instructions, or use site: operators."
                    ),
                    "items": {"type": "string"},
                    "minItems": 2,
                    "maxItems": 3,
                },
            },
            "required": ["objective", "search_queries"],
        },
    },
}


class ParallelService:
    """
    Parallel Web Systems client wrapping Search, Task (Deep Research), and Extract APIs.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.PARALLEL_API_KEY
        self._sync_client: Optional[Parallel] = None
        self._async_client: Optional[AsyncParallel] = None
        if self.api_key:
            self._sync_client = Parallel(api_key=self.api_key)
            self._async_client = AsyncParallel(api_key=self.api_key)

    @property
    def is_configured(self) -> bool:
        """Check whether PARALLEL_API_KEY is available."""
        return bool(self.api_key)

    @property
    def sync_client(self) -> Parallel:
        if not self._sync_client:
            key = self.api_key or settings.PARALLEL_API_KEY
            if not key:
                raise ValueError("PARALLEL_API_KEY is not configured in settings or environment.")
            self._sync_client = Parallel(api_key=key)
        return self._sync_client

    @property
    def async_client(self) -> AsyncParallel:
        if not self._async_client:
            key = self.api_key or settings.PARALLEL_API_KEY
            if not key:
                raise ValueError("PARALLEL_API_KEY is not configured in settings or environment.")
            self._async_client = AsyncParallel(api_key=key)
        return self._async_client

    def _normalize_queries(self, search_queries: Union[List[str], str]) -> List[str]:
        if isinstance(search_queries, str):
            return [search_queries.strip()]
        return [q.strip() for q in search_queries if q and q.strip()]

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Parallel Search API
    # ──────────────────────────────────────────────────────────────────────────

    async def search(
        self,
        search_queries: Union[List[str], str],
        objective: Optional[str] = None,
        mode: str = "advanced",
        advanced_settings: Optional[Dict[str, Any]] = None,
        max_results: int = 10,
        use_cache: bool = True,
        cache_ttl: int = 3600,
    ) -> Dict[str, Any]:
        """
        Execute an AI-driven web search using the Parallel Search API.

        Args:
            search_queries: 2-3 diverse keyword search queries (3-6 words each).
            objective: Natural-language research goal or context.
            mode: Handler-side tuning: 'turbo' (lowest latency ~200ms),
                  'basic' (balanced context), or 'advanced' (default high-depth).
            advanced_settings: Optional fine-grained controls (e.g. max_results).
            max_results: Fallback limit if not in advanced_settings.
            use_cache: Enable Redis caching.
            cache_ttl: Cache expiration in seconds.
        """
        queries = self._normalize_queries(search_queries)
        if not queries:
            return {"results": [], "search_id": None, "session_id": None, "warnings": []}

        # If objective wasn't provided, use the combined queries as objective context
        eff_objective = objective or ("Find comprehensive research evidence regarding: " + ", ".join(queries))

        settings_payload = dict(advanced_settings or {})
        if "max_results" not in settings_payload:
            settings_payload["max_results"] = max_results

        # Check Cache
        cache_key = None
        if use_cache:
            cache_key = cache.make_key(
                "parallel:search",
                {
                    "queries": queries,
                    "objective": eff_objective,
                    "mode": mode,
                    "settings": settings_payload,
                }
            )
            cached = await cache.get(cache_key)
            if cached:
                logger.debug(f"Parallel search cache hit: {queries}")
                return cached

        if not self.is_configured:
            logger.warning("Parallel search skipped: PARALLEL_API_KEY is not configured.")
            return {
                "results": [],
                "search_id": None,
                "session_id": None,
                "usage": None,
                "warnings": ["PARALLEL_API_KEY is not configured"],
            }

        try:
            kwargs: Dict[str, Any] = {
                "search_queries": queries,
                "objective": eff_objective,
                "mode": mode,
                "advanced_settings": settings_payload,
            }

            logger.info(f"Parallel search request: queries={queries}, mode={mode}")
            response: SearchResult = await self.async_client.search(**kwargs)

            formatted_results = []
            for item in (response.results or []):
                formatted_results.append({
                    "title": item.title or "",
                    "url": item.url or "",
                    "publish_date": item.publish_date,
                    "excerpts": item.excerpts or [],
                })

            output: Dict[str, Any] = {
                "search_id": response.search_id,
                "session_id": response.session_id,
                "results": formatted_results,
                "usage": [u.model_dump() for u in response.usage] if response.usage else None,
                "warnings": [w.model_dump() for w in response.warnings] if response.warnings else [],
            }

            if use_cache and cache_key:
                await cache.set(cache_key, output, ttl=cache_ttl)

            return output

        except Exception as e:
            logger.error(f"Parallel search failed for {queries}: {e}")
            return {
                "results": [],
                "search_id": None,
                "session_id": None,
                "usage": None,
                "warnings": [str(e)],
            }

    def search_sync(
        self,
        search_queries: Union[List[str], str],
        objective: Optional[str] = None,
        mode: str = "advanced",
        advanced_settings: Optional[Dict[str, Any]] = None,
        max_results: int = 10,
    ) -> Dict[str, Any]:
        """Synchronous search using client.search."""
        queries = self._normalize_queries(search_queries)
        if not queries:
            return {"results": [], "search_id": None}

        eff_objective = objective or ("Research: " + ", ".join(queries))
        settings_payload = dict(advanced_settings or {})
        if "max_results" not in settings_payload:
            settings_payload["max_results"] = max_results

        kwargs: Dict[str, Any] = {
            "search_queries": queries,
            "objective": eff_objective,
            "mode": mode,
            "advanced_settings": settings_payload,
        }

        response: SearchResult = self.sync_client.search(**kwargs)
        formatted_results = [
            {
                "title": item.title or "",
                "url": item.url or "",
                "publish_date": item.publish_date,
                "excerpts": item.excerpts or [],
            }
            for item in (response.results or [])
        ]
        return {
            "search_id": response.search_id,
            "session_id": response.session_id,
            "results": formatted_results,
        }

    async def search_web(self, objective: str, search_queries: List[str]) -> str:
        """
        Agent tool implementation for search_web.
        Returns LLM-optimized excerpts formatted with citations for direct injection into context.
        """
        res = await self.search(
            search_queries=search_queries,
            objective=objective,
            mode="advanced",
            max_results=8,
        )
        results = res.get("results", [])
        if not results:
            warnings = res.get("warnings", [])
            warn_msg = f" (Warning: {warnings[0]})" if warnings else ""
            return f"No web findings retrieved for objective: '{objective}'.{warn_msg}"

        formatted_lines = [f"### Web Evidence for: {objective}\n"]
        for idx, item in enumerate(results, 1):
            title = item.get("title") or "Web Finding"
            url = item.get("url") or ""
            pub_date = item.get("publish_date")
            date_str = f" ({pub_date})" if pub_date else ""
            formatted_lines.append(f"[{idx}] [{title}]({url}){date_str}")
            for excerpt in item.get("excerpts", []):
                clean_excerpt = excerpt.strip().replace("\n", " ")
                formatted_lines.append(f"> {clean_excerpt}\n")
            formatted_lines.append("")

        return "\n".join(formatted_lines)

    async def search_papers(
        self,
        query: str,
        limit: int = 10,
        objective: Optional[str] = None,
    ) -> List[PaperBase]:
        """
        Adapts web results into normalized PaperBase instances for Tafiti's discovery engine.
        """
        # Formulate 2-3 query variations for optimal Parallel Search coverage
        queries = [
            f"{query} empirical research",
            f"{query} review findings",
        ]
        eff_objective = objective or f"Identify authoritative academic and technical findings regarding {query}"

        res = await self.search(
            search_queries=queries,
            objective=eff_objective,
            mode="advanced",
            max_results=limit,
        )

        papers: List[PaperBase] = []
        for r in res.get("results", []):
            url = r.get("url") or ""
            title = r.get("title") or "Web Research Finding"
            excerpts = r.get("excerpts") or []
            abstract = "\n\n".join(excerpts)[:2000] if excerpts else ""

            pub_date = r.get("publish_date")
            year = None
            if pub_date and len(str(pub_date)) >= 4:
                try:
                    year = int(str(pub_date)[:4])
                except (ValueError, TypeError):
                    year = None

            domain = ""
            if url:
                try:
                    domain = urlparse(url).netloc
                except Exception:
                    domain = "Web"

            url_hash = hashlib.md5((url or title).encode("utf-8")).hexdigest()[:12]
            paper_id = f"parallel:{url_hash}"

            papers.append(PaperBase(
                id=paper_id,
                title=title,
                year=year,
                citations=0,
                abstract=abstract,
                authors=[domain or "Web Source"],
                doi=None,
                url=url,
                publisher=domain,
                source="parallel",
            ))

        return papers

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Parallel Task API (Deep Research)
    # ──────────────────────────────────────────────────────────────────────────

    async def create_deep_research(
        self,
        input_prompt: str,
        processor: str = "pro",
    ) -> Dict[str, Any]:
        """
        Launch a multi-hop deep research run using the Parallel Task API.

        Args:
            input_prompt: Plain-language research question or thesis topic.
            processor: 'pro' (~10 min deep research) or 'ultra' / 'ultra8x'.

        Returns:
            Dictionary with run_id, processor, and initial status.
        """
        if not self.is_configured:
            raise ValueError("PARALLEL_API_KEY is not configured.")

        logger.info(f"Creating Parallel Deep Research Task (processor={processor}): {input_prompt[:80]}...")
        task_run = await self.async_client.task_run.create(
            input=input_prompt,
            processor=processor,
        )
        return {
            "run_id": task_run.run_id,
            "processor": processor,
            "status": "created",
        }

    async def get_deep_research_result(
        self,
        run_id: str,
        api_timeout: int = 3600,
    ) -> Dict[str, Any]:
        """
        Retrieve results of a deep research task run, including synthesis and citations.

        Returns:
            Dictionary with content, basis citations, and status.
        """
        if not self.is_configured:
            raise ValueError("PARALLEL_API_KEY is not configured.")

        logger.info(f"Fetching Parallel Task result for run_id={run_id} (timeout={api_timeout}s)")
        result: TaskRunResult = await self.async_client.task_run.result(
            run_id=run_id,
            api_timeout=api_timeout,
        )

        output_content = getattr(result.output, "content", "") or ""
        basis_list = []
        raw_basis = getattr(result.output, "basis", []) or []
        for field in raw_basis:
            field_name = getattr(field, "field", "")
            citations = []
            for c in getattr(field, "citations", []):
                citations.append({
                    "url": getattr(c, "url", ""),
                    "title": getattr(c, "title", ""),
                    "excerpt": getattr(c, "excerpt", ""),
                })
            basis_list.append({
                "field": field_name,
                "citations": citations,
            })

        return {
            "run_id": run_id,
            "content": output_content,
            "basis": basis_list,
            "status": "completed",
        }

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Parallel Extract API
    # ──────────────────────────────────────────────────────────────────────────

    async def extract(self, urls: Union[str, List[str]]) -> Dict[str, Any]:
        """
        Extract clean markdown from one or more URLs (handles JS-rendered pages and PDFs).
        """
        if not self.is_configured:
            raise ValueError("PARALLEL_API_KEY is not configured.")

        target_urls = [urls] if isinstance(urls, str) else urls
        logger.info(f"Extracting web pages with Parallel Extract: {target_urls}")
        res = await self.async_client.extract(urls=target_urls)
        return {
            "results": [
                {
                    "url": getattr(item, "url", ""),
                    "title": getattr(item, "title", ""),
                    "text": getattr(item, "text", ""),
                }
                for item in (getattr(res, "results", []) or [])
            ]
        }


# ──────────────────────────────────────────────────────────────────────────────
# Agno Toolkit for Research Agents
# ──────────────────────────────────────────────────────────────────────────────

class ParallelTools(Toolkit):
    """
    Agno Toolkit exposing Parallel's search_web tool to AI agents.
    """

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(name="parallel_tools")
        self.service = get_parallel_service(api_key=api_key)
        self.register(self.search_web)

    def search_web(self, objective: str, search_queries: List[str]) -> str:
        """Searches the live web using a natural-language objective plus keyword queries, returning LLM-optimized excerpts (pre-compressed, citation-aware) ready to feed into model context. Use whenever the model needs current facts, specific named entities, recent events, or information that likely isn't in training data. Prefer over repeated keyword searches — one call covers the ground of 2-3 traditional queries with better relevance.

        Args:
            objective: A concise, self-contained search query. Must include the key entity or topic being searched for.
            search_queries: 2-3 diverse keyword search queries, each 3-6 words. Must be diverse — vary entity names, synonyms, and angles. Each query must include the key entity or topic. NEVER write sentences, instructions, or use site: operators.

        Returns:
            Pre-compressed, citation-aware excerpts ready for reasoning.
        """
        try:
            # Synchronous runner for agent loops
            res = self.service.search_sync(
                search_queries=search_queries,
                objective=objective,
                mode="advanced",
                max_results=8,
            )
            results = res.get("results", [])
            if not results:
                return f"No web evidence found for '{objective}'."

            formatted = [f"### Web Evidence: {objective}\n"]
            for idx, r in enumerate(results, 1):
                title = r.get("title", "Source")
                url = r.get("url", "")
                date_str = f" ({r.get('publish_date')})" if r.get("publish_date") else ""
                formatted.append(f"[{idx}] {title} - {url}{date_str}")
                for ex in r.get("excerpts", []):
                    formatted.append(f"  * {ex.strip()}")
                formatted.append("")

            return "\n".join(formatted)

        except Exception as e:
            logger.warning(f"ParallelTools.search_web failed: {e}")
            return f"Error executing web search: {e}"


# Singleton instance
_parallel_singleton: Optional[ParallelService] = None

def get_parallel_service(api_key: Optional[str] = None) -> ParallelService:
    """Get or create singleton ParallelService instance."""
    global _parallel_singleton
    if api_key:
        return ParallelService(api_key=api_key)
    if _parallel_singleton is None:
        _parallel_singleton = ParallelService()
    return _parallel_singleton
