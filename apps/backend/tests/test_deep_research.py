"""Tests for the Gemini Deep Research agent (Agno GeminiInteractions)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace

from agno.agent import Agent
from agno.models.google import GeminiInteractions

from app.agents.deep_research_agent import DeepResearchAgent, get_deep_research_agent
from app.core.config import settings


@pytest.fixture
def agent(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", None)
    monkeypatch.setattr(settings, "PARALLEL_API_KEY", None)
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_AGENT", "deep-research-preview-04-2026")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_MAX_AGENT", "deep-research-max-preview-04-2026")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_THINKING_SUMMARIES", "auto")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_VISUALIZATION", "auto")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_COLLABORATIVE_PLANNING", False)
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_SEARCH", True)
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_URL_CONTEXT", True)
    return DeepResearchAgent()


class TestBuildModel:
    def test_build_model_default(self, agent):
        model = agent._build_model(engine="gemini")
        assert isinstance(model, GeminiInteractions)
        assert model.agent == "deep-research-preview-04-2026"
        assert model.thinking_summaries == "auto"
        assert model.visualization == "auto"

    def test_build_model_max(self, agent):
        model = agent._build_model(engine="gemini-max")
        assert isinstance(model, GeminiInteractions)
        assert model.agent == "deep-research-max-preview-04-2026"

    def test_build_model_overrides(self, agent):
        model = agent._build_model(
            engine="gemini",
            thinking_summaries="none",
            visualization="off",
            collaborative_planning=True,
            file_search_store_names=["fileSearchStores/test-store-123"],
            mcp_servers=[{"name": "mcp_0", "url": "http://localhost:8000/mcp"}],
        )
        assert model.thinking_summaries == "none"
        assert model.visualization == "off"
        assert model.collaborative_planning is True
        assert model.file_search_store_names == ["fileSearchStores/test-store-123"]
        assert model.mcp_servers == [{"name": "mcp_0", "url": "http://localhost:8000/mcp"}]

    def test_build_agent(self, agent):
        agno_agent = agent._build_agent(engine="gemini")
        assert isinstance(agno_agent, Agent)
        assert isinstance(agno_agent.model, GeminiInteractions)


class TestStartResearch:
    @pytest.mark.asyncio
    async def test_gemini_starts_background_task(self, agent):
        with patch.object(agent, "_run_background", new_callable=AsyncMock) as mock_bg:
            interaction_id = await agent.start_research(query="History of TPUs")
            assert interaction_id.startswith("dr_")
            assert interaction_id in agent._results
            assert agent._results[interaction_id]["status"] == "running"
            mock_bg.assert_called_once()

    @pytest.mark.asyncio
    async def test_parallel_engine(self, agent):
        fake_srv = MagicMock()
        fake_srv.create_deep_research = AsyncMock(return_value={"run_id": "run-1"})
        with patch("app.services.parallel_service.get_parallel_service", return_value=fake_srv):
            interaction_id = await agent.start_research(query="Research q", engine="parallel")
        assert interaction_id == "parallel:run-1"
        assert agent._results[interaction_id]["status"] == "running"
        fake_srv.create_deep_research.assert_awaited_once_with(input_prompt="Research q", processor="pro")

    @pytest.mark.asyncio
    async def test_raises_without_keys(self, agent):
        agent.api_key = None
        with pytest.raises(ValueError, match="GEMINI_API_KEY or PARALLEL_API_KEY must be configured"):
            await agent.start_research(query="Research q")


class TestRunBackground:
    @pytest.mark.asyncio
    async def test_run_background_success(self, agent):
        fake_agent = MagicMock()
        fake_response = SimpleNamespace(content="Synthesized deep research report.")
        fake_agent.arun = AsyncMock(return_value=fake_response)

        interaction_id = "dr_test_123"
        await agent._run_background(interaction_id, fake_agent, "Test query")

        assert agent._results[interaction_id]["status"] == "completed"
        assert agent._results[interaction_id]["output"] == "Synthesized deep research report."
        assert agent._results[interaction_id]["error"] is None

    @pytest.mark.asyncio
    async def test_run_background_failure(self, agent):
        fake_agent = MagicMock()
        fake_agent.arun = AsyncMock(side_effect=RuntimeError("API quota exceeded"))

        interaction_id = "dr_test_err"
        await agent._run_background(interaction_id, fake_agent, "Test query")

        assert agent._results[interaction_id]["status"] == "failed"
        assert agent._results[interaction_id]["output"] is None
        assert "API quota exceeded" in agent._results[interaction_id]["error"]


class TestGetResearchStatus:
    @pytest.mark.asyncio
    async def test_gemini_in_memory_status(self, agent):
        agent._results["dr_complete"] = {
            "status": "completed",
            "output": "Report content",
            "error": None,
            "progress": None,
        }
        status = await agent.get_research_status("dr_complete")
        assert status["status"] == "completed"
        assert status["output"] == "Report content"

    @pytest.mark.asyncio
    async def test_unknown_interaction(self, agent):
        status = await agent.get_research_status("dr_nonexistent")
        assert status["status"] == "failed"
        assert "Unknown interaction ID" in status["error"]

    @pytest.mark.asyncio
    async def test_parallel_status(self, agent):
        fake_srv = MagicMock()
        fake_srv.get_deep_research_result = AsyncMock(
            return_value={"content": "Parallel report", "basis": [{"title": "ref"}]}
        )
        with patch("app.services.parallel_service.get_parallel_service", return_value=fake_srv):
            status = await agent.get_research_status("parallel:run-1")
        assert status["status"] == "completed"
        assert status["output"] == "Parallel report"
        assert status["basis"] == [{"title": "ref"}]


def test_get_deep_research_agent_is_singleton_factory():
    assert isinstance(get_deep_research_agent(), DeepResearchAgent)