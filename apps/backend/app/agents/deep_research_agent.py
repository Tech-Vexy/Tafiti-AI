from google import genai
from typing import List, Optional
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("deep_research_agent")

class DeepResearchAgent:
    def __init__(self):
        # Default initialization uses GEMINI_API_KEY from environment or GOOGLE_API_KEY
        self.api_key = settings.GOOGLE_API_KEY
        self.client = genai.Client(api_key=self.api_key)

    async def start_research(self, query: str, mcp_servers: Optional[List[str]] = None) -> str:
        """Starts a background deep research task and returns the interaction ID."""
        logger.info(f"Starting deep research for query: {query}")

        # Configure tools if MCP servers are provided
        config = {}
        if mcp_servers:
            logger.info(f"Configuring MCP servers: {mcp_servers}")
            tools = []
            for server_url in mcp_servers:
                 tools.append({"mcp": {"server_url": server_url}})
            config["tools"] = tools

        interaction = await self.client.aio.interactions.create(
            input=query,
            agent="deep-research-max-preview-04-2026",
            background=True,
            config=config if config else None
        )
        return interaction.id

    async def get_research_status(self, interaction_id: str) -> dict:
        """Polls the status of the deep research task."""
        logger.info(f"Checking deep research status for interaction: {interaction_id}")
        interaction = await self.client.aio.interactions.get(interaction_id)

        result = {
            "status": interaction.status,
            "output": None,
            "error": None
        }

        if interaction.status == "completed":
            # the final output text
            result["output"] = interaction.outputs[-1].text if interaction.outputs else ""
        elif interaction.status == "failed":
            result["error"] = getattr(interaction, "error", "Unknown error")

        return result

def get_deep_research_agent() -> DeepResearchAgent:
    return DeepResearchAgent()
