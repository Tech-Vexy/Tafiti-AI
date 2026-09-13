"""
Deep Research Agent — Gemini Interactions API via Agno
=====================================================
Uses Agno's GeminiInteractions model for deep research with streaming,
thinking summaries, visualization, and collaborative planning.

Preserves the start_research() / get_research_status() API surface
used by the research API endpoints.

Falls back to Parallel Web when Gemini is unavailable.
"""

import asyncio
import time
import uuid
from typing import Any, Awaitable, Callable, List, Optional

from agno.agent import Agent
from agno.models.google import GeminiInteractions

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("deep_research_agent")

ResearchCompletionCallback = Callable[[str, dict], Awaitable[None]]


class DeepResearchAgent:
    # Shared in-memory store for background research results keyed by interaction_id
    _results: dict[str, dict] = {}

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self._agent_id = settings.GEMINI_DEEP_RESEARCH_AGENT
        self._max_agent_id = settings.GEMINI_DEEP_RESEARCH_MAX_AGENT

    def _build_model(
        self,
        engine: str = "gemini",
        thinking_summaries: Optional[str] = None,
        visualization: Optional[str] = None,
        collaborative_planning: Optional[bool] = None,
        file_search_store_names: Optional[List[str]] = None,
        mcp_servers: Optional[List[dict]] = None,
        search: Optional[bool] = None,
        url_context: Optional[bool] = None,
    ) -> GeminiInteractions:
        """Build a GeminiInteractions model with the given configuration."""
        agent_id = self._agent_id if engine != "gemini-max" else self._max_agent_id

        kwargs: dict = {
            "agent": agent_id,
            "thinking_summaries": thinking_summaries or settings.GEMINI_DEEP_RESEARCH_THINKING_SUMMARIES,
            "visualization": visualization if visualization is not None else settings.GEMINI_DEEP_RESEARCH_VISUALIZATION,
            "collaborative_planning": (
                collaborative_planning
                if collaborative_planning is not None
                else settings.GEMINI_DEEP_RESEARCH_COLLABORATIVE_PLANNING
            ),
            "agent_poll_interval": 5.0,
        }
        if self.api_key:
            kwargs["api_key"] = self.api_key

        # Search and URL context flags (from config, overridable per-call)
        use_search = search if search is not None else settings.GEMINI_DEEP_RESEARCH_SEARCH
        use_url_ctx = url_context if url_context is not None else settings.GEMINI_DEEP_RESEARCH_URL_CONTEXT
        if use_search:
            kwargs["search"] = True
        if use_url_ctx:
            kwargs["url_context"] = True

        if file_search_store_names:
            kwargs["file_search_store_names"] = file_search_store_names

        if mcp_servers:
            # GeminiInteractions expects mcp_servers as a list of dicts
            # Each dict: {"name": ..., "url": ..., "headers": ..., "allowed_tools": ...}
            kwargs["mcp_servers"] = mcp_servers

        return GeminiInteractions(**kwargs)

    def _build_agent(
        self,
        engine: str = "gemini",
        thinking_summaries: Optional[str] = None,
        visualization: Optional[str] = None,
        collaborative_planning: Optional[bool] = None,
        file_search_store_names: Optional[List[str]] = None,
        mcp_servers: Optional[List[dict]] = None,
        search: Optional[bool] = None,
        url_context: Optional[bool] = None,
    ) -> Agent:
        """Build an Agno Agent with GeminiInteractions model."""
        model = self._build_model(
            engine=engine,
            thinking_summaries=thinking_summaries,
            visualization=visualization,
            collaborative_planning=collaborative_planning,
            file_search_store_names=file_search_store_names,
            mcp_servers=mcp_servers,
            search=search,
            url_context=url_context,
        )
        return Agent(model=model, markdown=True)

    async def stream_research(
        self,
        query: str,
        mcp_servers: Optional[List[Any]] = None,
        engine: str = "gemini",
        thinking_summaries: Optional[str] = None,
        visualization: Optional[str] = None,
        collaborative_planning: Optional[bool] = None,
        file_search_store_names: Optional[List[str]] = None,
        user_id: Optional[str] = None,
    ):
        """
        Streams deep research execution events in real time.
        Yields structured dicts matching the existing SSE contract:
        - {"type": "thought", "signature": str, "content": str}
        - {"type": "status", "status": str, "interaction_id": str}
        - {"type": "text", "content": str}
        - {"type": "completed", "output": str, "interaction_id": str}
        - {"type": "error", "error": str}
        """
        logger.info(f"Starting streaming deep research (engine={engine}) for query: {query[:100]}...")

        # Parallel Task API fallback
        if engine == "parallel" or (not self.api_key and settings.PARALLEL_API_KEY):
            async for event in self._stream_parallel(query):
                yield event
            return

        if not self.api_key:
            raise ValueError("GEMINI_API_KEY or PARALLEL_API_KEY must be configured for deep research")

        interaction_id = f"dr_{uuid.uuid4().hex[:12]}"
        yield {"type": "status", "status": "running", "interaction_id": interaction_id}

        # Build MCP server configs if provided
        mcp_configs = None
        if mcp_servers:
            mcp_configs = []
            for i, item in enumerate(mcp_servers):
                if isinstance(item, str):
                    mcp_configs.append({"name": f"mcp_{i}", "url": item})
                elif isinstance(item, dict):
                    mcp_configs.append(item)

        # Resolve user's persistent Gemini File Search Store if user_id is provided
        resolved_stores = list(file_search_store_names) if file_search_store_names else []
        if user_id:
            try:
                from app.services.gemini_file_store import get_gemini_file_store_service
                store_service = get_gemini_file_store_service()
                user_store = store_service.get_cached_store(user_id)
                if not user_store:
                    user_store = await store_service.get_or_create_user_store(user_id)
                if user_store and user_store not in resolved_stores:
                    resolved_stores.append(user_store)
            except Exception as e:
                logger.warning(f"Could not resolve Gemini file search store for user {user_id}: {e}")

        agent = self._build_agent(
            engine=engine,
            thinking_summaries=thinking_summaries,
            visualization=visualization,
            collaborative_planning=collaborative_planning,
            file_search_store_names=resolved_stores if resolved_stores else None,
            mcp_servers=mcp_configs,
        )

        full_output = []
        try:
            async for event in agent.arun(query, stream=True):
                event_type = getattr(event, "event", None)
                delta_type = getattr(event, "delta_type", None)

                # 1. Thinking / reasoning step (step.delta with delta_type="thought" or reasoning_content)
                reasoning = getattr(event, "reasoning_content", None)
                if (event_type == "step.delta" and delta_type == "thought") or reasoning:
                    thought_content = reasoning or getattr(event, "content", None)
                    if thought_content:
                        provider_data = getattr(event, "provider_data", None) or {}
                        sig = provider_data.get("thought_signature") or getattr(event, "signature", None) or "Thinking Process"
                        yield {"type": "thought", "signature": sig, "content": str(thought_content)}

                # 2. Server-side tool executions from Deep Research agent
                elif getattr(event, "tool_executions", None):
                    for tool in event.tool_executions:
                        tool_name = getattr(tool, "tool_name", "tool")
                        tool_res = getattr(tool, "result", "")
                        yield {
                            "type": "tool_call",
                            "tool": tool_name,
                            "label": f"Executing {tool_name}",
                            "status": "completed",
                            "detail": str(tool_res)[:200] if tool_res else "",
                        }
                        yield {
                            "type": "thought",
                            "signature": tool_name,
                            "content": f"Investigated: {tool_res}" if tool_res else f"Called {tool_name}",
                        }

                # 3. Content delta
                elif hasattr(event, "content") and event.content:
                    if delta_type != "thought":
                        content = str(event.content)
                        full_output.append(content)
                        yield {"type": "text", "content": content}

                # 4. Generated visual charts / graphs (visualization="auto")
                if hasattr(event, "image") and event.image:
                    yield {"type": "image", "data": str(event.image)}
                elif hasattr(event, "images") and event.images:
                    for img in event.images:
                        yield {"type": "image", "data": str(img)}

                # 5. Citations & Grounding sources directly from Deep Research Agent
                event_citations = getattr(event, "citations", None) or getattr(event, "sources", None)
                if event_citations:
                    yield {"type": "sources", "sources": event_citations}

            output = "\n".join(full_output)
            self._results[interaction_id] = {
                "status": "completed",
                "output": output,
                "error": None,
                "progress": None,
            }
            yield {"type": "completed", "output": output, "interaction_id": interaction_id}

        except Exception as e:
            logger.error(f"Deep research streaming error: {e}", exc_info=True)
            self._results[interaction_id] = {
                "status": "failed",
                "output": None,
                "error": str(e),
                "progress": None,
            }
            yield {"type": "error", "error": str(e)}

    async def _stream_parallel(self, query: str):
        """Fallback streaming for Parallel Task Engine."""
        from app.services.parallel_service import get_parallel_service
        parallel_srv = get_parallel_service()
        yield {"type": "thought", "signature": "Parallel Deep Research", "content": "Initializing Parallel web research..."}

        task = await parallel_srv.create_deep_research(input_prompt=query, processor="pro")
        run_id = task["run_id"]
        interaction_id = f"parallel:{run_id}"
        yield {"type": "status", "status": "running", "interaction_id": interaction_id}

        for _ in range(60):
            await asyncio.sleep(2.0)
            try:
                res = await parallel_srv.get_deep_research_result(run_id=str(run_id), api_timeout=10)
                content = res.get("content", "")
                if content:
                    yield {"type": "completed", "output": content, "interaction_id": interaction_id}
                    return
            except Exception as e:
                yield {"type": "thought", "signature": "Parallel Task Engine", "content": f"Synthesizing findings: {e}"}

    async def start_research(
        self,
        query: str,
        mcp_servers: Optional[List[Any]] = None,
        engine: str = "gemini",
        thinking_summaries: Optional[str] = None,
        visualization: Optional[str] = None,
        collaborative_planning: Optional[bool] = None,
        file_search_store_names: Optional[List[str]] = None,
        user_id: Optional[str] = None,
        on_complete: Optional[ResearchCompletionCallback] = None,
    ) -> str:
        """Starts a background deep research task and returns the interaction ID."""
        logger.info(f"Starting deep research (engine={engine}) for query: {query[:100]}...")

        # Parallel Task API fallback
        if engine == "parallel" or (not self.api_key and settings.PARALLEL_API_KEY):
            from app.services.parallel_service import get_parallel_service
            parallel_srv = get_parallel_service()
            task = await parallel_srv.create_deep_research(input_prompt=query, processor="pro")
            interaction_id = f"parallel:{task['run_id']}"
            self._results[interaction_id] = {
                "status": "running",
                "output": None,
                "error": None,
                "progress": "Parallel deep research in progress",
            }
            logger.info(f"Parallel deep research started: {interaction_id}")
            return interaction_id

        if not self.api_key:
            raise ValueError("GEMINI_API_KEY or PARALLEL_API_KEY must be configured for deep research")

        interaction_id = f"dr_{uuid.uuid4().hex[:12]}"

        # Build MCP server configs if provided
        mcp_configs = None
        if mcp_servers:
            mcp_configs = []
            for i, item in enumerate(mcp_servers):
                if isinstance(item, str):
                    mcp_configs.append({"name": f"mcp_{i}", "url": item})
                elif isinstance(item, dict):
                    mcp_configs.append(item)

        # Resolve user's persistent Gemini File Search Store if user_id is provided
        resolved_stores = list(file_search_store_names) if file_search_store_names else []
        if user_id:
            try:
                from app.services.gemini_file_store import get_gemini_file_store_service
                store_service = get_gemini_file_store_service()
                user_store = store_service.get_cached_store(user_id)
                if not user_store:
                    user_store = await store_service.get_or_create_user_store(user_id)
                if user_store and user_store not in resolved_stores:
                    resolved_stores.append(user_store)
            except Exception as e:
                logger.warning(f"Could not resolve Gemini file search store for user {user_id}: {e}")

        agent = self._build_agent(
            engine=engine,
            thinking_summaries=thinking_summaries,
            visualization=visualization,
            collaborative_planning=collaborative_planning,
            file_search_store_names=resolved_stores if resolved_stores else None,
            mcp_servers=mcp_configs,
        )

        # Mark as running immediately
        self._results[interaction_id] = {
            "status": "running",
            "output": None,
            "error": None,
            "progress": "Research task started",
        }

        # Launch background task
        asyncio.create_task(self._run_background(interaction_id, agent, query, on_complete))

        logger.info(f"Deep research started: interaction_id={interaction_id}")
        return interaction_id

    async def _run_background(
        self,
        interaction_id: str,
        agent: Agent,
        query: str,
        on_complete: Optional[ResearchCompletionCallback] = None,
    ):
        """Execute research in background and store the result."""
        start_time = time.perf_counter()
        try:
            response = await agent.arun(query)
            duration_s = time.perf_counter() - start_time
            output = response.content if hasattr(response, "content") else str(response)
            
            # Safe citation extraction
            citations = getattr(response, "citations", None)
            citation_count = 0
            citations_data = []
            if citations:
                if isinstance(citations, (list, tuple, set)):
                    citation_count = len(citations)
                    citations_data = list(citations)
                else:
                    urls = getattr(citations, "urls", None)
                    docs = getattr(citations, "documents", None)
                    if urls and isinstance(urls, list):
                        citation_count += len(urls)
                    if docs and isinstance(docs, list):
                        citation_count += len(docs)
                    if citation_count == 0 and hasattr(citations, "raw") and isinstance(citations.raw, list):
                        citation_count = len(citations.raw)
                    elif citation_count == 0:
                        citation_count = 1
                    citations_data = citations.model_dump() if hasattr(citations, "model_dump") else str(citations)

            images = getattr(response, "images", None) or []
            result = {
                "status": "completed",
                "output": output,
                "citations": citations_data,
                "citation_count": citation_count,
                "images": images,
                "duration_seconds": round(duration_s, 2),
                "error": None,
                "progress": None,
            }
            self._results[interaction_id] = result
            if on_complete:
                await on_complete(interaction_id, result)
            logger.info(
                f"Deep research completed: {interaction_id} in {duration_s:.2f}s "
                f"(output length: {len(output or '')}, citations: {citation_count})"
            )
        except Exception as e:
            duration_s = time.perf_counter() - start_time
            logger.error(f"Background deep research failed after {duration_s:.2f}s: {e}", exc_info=True)
            result = {
                "status": "failed",
                "output": None,
                "citations": [],
                "images": [],
                "duration_seconds": round(duration_s, 2),
                "error": str(e),
                "progress": None,
            }
            self._results[interaction_id] = result
            if on_complete:
                await on_complete(interaction_id, result)

    async def get_research_status(self, interaction_id: str) -> dict:
        """Polls the status of the deep research task."""
        logger.debug(f"Polling deep research status: {interaction_id}")

        # Parallel Task API
        if interaction_id.startswith("parallel:"):
            run_id = interaction_id.replace("parallel:", "")
            from app.services.parallel_service import get_parallel_service
            parallel_srv = get_parallel_service()
            try:
                res = await parallel_srv.get_deep_research_result(run_id=run_id, api_timeout=15)
                result = {
                    "status": "completed",
                    "output": res.get("content", ""),
                    "error": None,
                    "progress": None,
                    "basis": res.get("basis", []),
                }
                self._results[interaction_id] = result
                return result
            except Exception as e:
                return {
                    "status": "running",
                    "output": None,
                    "error": None,
                    "progress": f"Parallel deep research in progress: {e}",
                }

        # Gemini Interactions — check in-memory store
        stored = self._results.get(interaction_id)
        if stored:
            return stored

        # Unknown interaction
        return {
            "status": "failed",
            "output": None,
            "error": f"Unknown interaction ID: {interaction_id}",
            "progress": None,
        }


_agent_instance: Optional[DeepResearchAgent] = None


def get_deep_research_agent() -> DeepResearchAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = DeepResearchAgent()
    return _agent_instance
