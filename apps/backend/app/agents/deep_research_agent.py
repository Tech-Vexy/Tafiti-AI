from google import genai
from typing import List, Optional
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("deep_research_agent")

class DeepResearchAgent:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        self.agent = settings.GEMINI_DEEP_RESEARCH_AGENT
        self.max_agent = settings.GEMINI_DEEP_RESEARCH_MAX_AGENT

    async def start_research(
        self,
        query: str,
        mcp_servers: Optional[List[str]] = None,
        engine: str = "gemini",
        thinking_summaries: Optional[str] = None,
        visualization: Optional[str] = None,
        collaborative_planning: Optional[bool] = None,
    ) -> str:
        """Starts a background deep research task and returns the interaction ID."""
        logger.info(f"Starting deep research (engine={engine}) for query: {query[:100]}...")

        # Parallel Task API option
        if engine == "parallel" or (not self.client and settings.PARALLEL_API_KEY):
            from app.services.parallel_service import get_parallel_service
            parallel_srv = get_parallel_service()
            task = await parallel_srv.create_deep_research(input_prompt=query, processor="pro")
            logger.info(f"Parallel deep research started: run_id={task['run_id']}")
            return f"parallel:{task['run_id']}"

        if not self.client:
            raise ValueError("GEMINI_API_KEY or PARALLEL_API_KEY must be configured for deep research")

        agent_id = self.agent if engine != "gemini-max" else self.max_agent

        agent_config = {
            "type": "deep-research",
            "thinking_summaries": thinking_summaries or settings.GEMINI_DEEP_RESEARCH_THINKING_SUMMARIES,
            "visualization": visualization if visualization is not None else settings.GEMINI_DEEP_RESEARCH_VISUALIZATION,
            "collaborative_planning": (
                collaborative_planning
                if collaborative_planning is not None
                else settings.GEMINI_DEEP_RESEARCH_COLLABORATIVE_PLANNING
            ),
        }

        tools = []
        if mcp_servers:
            logger.info(f"Configuring MCP servers: {mcp_servers}")
            for server_url in mcp_servers:
                tools.append({"type": "mcp_server", "mcp": {"server_url": server_url}})

        try:
            interaction = await self.client.aio.interactions.create(
                input=query,
                agent=agent_id,
                background=True,
                agent_config=agent_config,
                tools=tools or None,
            )
            logger.info(f"Deep research started: interaction_id={interaction.id}")
            return interaction.id
        except Exception as e:
            logger.error(f"Failed to start deep research: {e}", exc_info=True)
            raise

    async def get_research_status(self, interaction_id: str) -> dict:
        """Polls the status of the deep research task."""
        logger.debug(f"Polling deep research status: {interaction_id}")

        if interaction_id.startswith("parallel:"):
            run_id = interaction_id.replace("parallel:", "")
            from app.services.parallel_service import get_parallel_service
            parallel_srv = get_parallel_service()
            try:
                # Parallel Task pro tier result retrieval
                res = await parallel_srv.get_deep_research_result(run_id=run_id, api_timeout=15)
                return {
                    "status": "completed",
                    "output": res.get("content", ""),
                    "error": None,
                    "progress": None,
                    "basis": res.get("basis", []),
                }
            except Exception as e:
                return {
                    "status": "running",
                    "output": None,
                    "error": None,
                    "progress": f"Parallel deep research in progress: {e}",
                }

        try:
            interaction = await self.client.aio.interactions.get(interaction_id)
        except Exception as e:
            logger.error(f"Failed to get interaction status: {e}")
            return {
                "status": "failed",
                "output": None,
                "error": "Failed to retrieve research status",
                "progress": None,
            }

        result = {
            "status": interaction.status,
            "output": None,
            "error": None,
            "progress": None,
        }

        if interaction.status == "completed":
            result["output"] = self._extract_final_text(interaction)
            logger.info(f"Deep research completed: {interaction_id} (output length: {len(result['output'] or '')})")
        elif interaction.status == "failed":
            result["error"] = self._extract_error(interaction)
            logger.error(f"Deep research failed: {interaction_id}: {result['error']}")
        elif interaction.status in ("running", "pending", "in_progress"):
            progress = self._extract_progress(interaction)
            if progress:
                result["progress"] = progress

        return result

    def _extract_final_text(self, interaction) -> str:
        output = getattr(interaction, "output_text", None)
        if output:
            return output

        outputs = getattr(interaction, "outputs", None)
        if outputs:
            last = outputs[-1]
            text = getattr(last, "text", None)
            if text:
                return text

        return self._latest_model_output_text(interaction)

    def _extract_progress(self, interaction) -> Optional[str]:
        text = self._latest_model_output_text(interaction)
        if text:
            return text[:200]
        return None

    def _latest_model_output_text(self, interaction) -> str:
        steps = getattr(interaction, "steps", None) or []
        if not steps:
            return ""
        for step in reversed(steps):
            if getattr(step, "type", None) != "model_output":
                continue
            parts = getattr(step, "content", None) or []
            texts = [p.text for p in parts if getattr(p, "type", None) == "text" and getattr(p, "text", None)]
            if texts:
                return "\n".join(texts)
        return ""

    def _extract_error(self, interaction) -> str:
        errors = getattr(interaction, "errors", None)
        if errors:
            messages = [getattr(e, "message", None) or str(e) for e in errors]
            if messages:
                return "; ".join(messages)
        error = getattr(interaction, "error", None)
        if error:
            if hasattr(error, "message") and error.message:
                return error.message
            return str(error)
        return "Research task failed"


def get_deep_research_agent() -> DeepResearchAgent:
    return DeepResearchAgent()