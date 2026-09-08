"""Tests for the Gemini Deep Research agent (Interactions API)."""
import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.agents.deep_research_agent import DeepResearchAgent, get_deep_research_agent
from app.core.config import settings


def make_interaction(**overrides):
    interaction = SimpleNamespace(
        id="interaction-123",
        status="completed",
        output_text="Final synthesized report.",
        outputs=None,
        steps=None,
        errors=None,
        error=None,
    )
    for k, v in overrides.items():
        setattr(interaction, k, v)
    return interaction


@pytest.fixture
def agent(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", None)
    monkeypatch.setattr(settings, "PARALLEL_API_KEY", None)
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_AGENT", "deep-research-preview-04-2026")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_MAX_AGENT", "deep-research-max-preview-04-2026")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_THINKING_SUMMARIES", "none")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_VISUALIZATION", "auto")
    monkeypatch.setattr(settings, "GEMINI_DEEP_RESEARCH_COLLABORATIVE_PLANNING", False)
    return DeepResearchAgent()


class TestStartResearch:
    @pytest.mark.asyncio
    async def test_gemini_uses_preview_agent(self, agent):
        agent.client.aio.interactions.create = AsyncMock(return_value=make_interaction())
        interaction_id = await agent.start_research(query="History of TPUs")
        assert interaction_id == "interaction-123"
        _, kwargs = agent.client.aio.interactions.create.call_args
        assert kwargs["agent"] == "deep-research-preview-04-2026"
        assert kwargs["background"] is True
        assert kwargs["agent_config"]["type"] == "deep-research"
        assert kwargs["agent_config"]["thinking_summaries"] == "none"
        assert kwargs["agent_config"]["visualization"] == "auto"
        assert kwargs["tools"] is None

    @pytest.mark.asyncio
    async def test_gemini_max_uses_max_agent(self, agent):
        agent.client.aio.interactions.create = AsyncMock(return_value=make_interaction())
        await agent.start_research(query="Deep dive", engine="gemini-max")
        _, kwargs = agent.client.aio.interactions.create.call_args
        assert kwargs["agent"] == "deep-research-max-preview-04-2026"

    @pytest.mark.asyncio
    async def test_mcp_servers_build_tools(self, agent):
        agent.client.aio.interactions.create = AsyncMock(return_value=make_interaction())
        await agent.start_research(query="Research q", mcp_servers=["http://localhost:8000/mcp"])
        _, kwargs = agent.client.aio.interactions.create.call_args
        assert kwargs["tools"] == [{"type": "mcp_server", "mcp": {"server_url": "http://localhost:8000/mcp"}}]

    @pytest.mark.asyncio
    async def test_override_agent_config(self, agent):
        agent.client.aio.interactions.create = AsyncMock(return_value=make_interaction())
        await agent.start_research(
            query="Research q",
            thinking_summaries="auto",
            visualization="off",
            collaborative_planning=True,
        )
        _, kwargs = agent.client.aio.interactions.create.call_args
        assert kwargs["agent_config"]["thinking_summaries"] == "auto"
        assert kwargs["agent_config"]["visualization"] == "off"
        assert kwargs["agent_config"]["collaborative_planning"] is True

    @pytest.mark.asyncio
    async def test_parallel_engine(self, agent, monkeypatch):
        fake_srv = MagicMock()
        fake_srv.create_deep_research = AsyncMock(return_value={"run_id": "run-1"})
        with patch("app.services.parallel_service.get_parallel_service", return_value=fake_srv):
            interaction_id = await agent.start_research(query="Research q", engine="parallel")
        assert interaction_id == "parallel:run-1"
        fake_srv.create_deep_research.assert_awaited_once_with(input_prompt="Research q", processor="pro")

    @pytest.mark.asyncio
    async def test_raises_without_keys(self, agent):
        agent.client = None
        with pytest.raises(ValueError):
            await agent.start_research(query="Research q")


class TestGetResearchStatus:
    @pytest.mark.asyncio
    async def test_completed_uses_output_text(self, agent):
        agent.client.aio.interactions.get = AsyncMock(return_value=make_interaction())
        status = await agent.get_research_status("interaction-123")
        assert status["status"] == "completed"
        assert status["output"] == "Final synthesized report."

    @pytest.mark.asyncio
    async def test_completed_falls_back_to_outputs(self, agent):
        interaction = make_interaction(output_text=None, outputs=[SimpleNamespace(text="Out A", kind="final")])
        agent.client.aio.interactions.get = AsyncMock(return_value=interaction)
        status = await agent.get_research_status("interaction-123")
        assert status["output"] == "Out A"

    @pytest.mark.asyncio
    async def test_completed_falls_back_to_steps(self, agent):
        step = SimpleNamespace(
            type="model_output",
            content=[SimpleNamespace(type="text", text="Step text"), SimpleNamespace(type="image", data="bytes")],
        )
        interaction = make_interaction(output_text=None, outputs=None, steps=[step])
        agent.client.aio.interactions.get = AsyncMock(return_value=interaction)
        status = await agent.get_research_status("interaction-123")
        assert status["output"] == "Step text"

    @pytest.mark.asyncio
    async def test_failed_uses_errors(self, agent):
        interaction = make_interaction(
            status="failed",
            errors=[SimpleNamespace(code="500", message="Research crashed")],
        )
        agent.client.aio.interactions.get = AsyncMock(return_value=interaction)
        status = await agent.get_research_status("interaction-123")
        assert status["status"] == "failed"
        assert status["error"] == "Research crashed"

    @pytest.mark.asyncio
    async def test_running_exposes_progress(self, agent):
        step = SimpleNamespace(type="model_output", content=[SimpleNamespace(type="text", text="Gathering sources...")])
        interaction = make_interaction(status="pending", output_text=None, outputs=None, steps=[step])
        agent.client.aio.interactions.get = AsyncMock(return_value=interaction)
        status = await agent.get_research_status("interaction-123")
        assert status["status"] == "pending"
        assert status["progress"] == "Gathering sources..."

    @pytest.mark.asyncio
    async def test_parallel_status(self, agent, monkeypatch):
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