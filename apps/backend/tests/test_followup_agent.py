"""
Tests for ResearchAgent (Follow-up Agent) and ResearchRouter dynamic dispatch.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agents.research_agent import ResearchAgent, get_research_agent
from app.models.schemas import PaperBase
from app.services.research_router import ResearchRouter


def test_research_agent_singleton():
    a1 = get_research_agent()
    a2 = get_research_agent()
    assert isinstance(a1, ResearchAgent)
    assert a1 is a2


@pytest.mark.asyncio
async def test_stream_followup_yields_events():
    agent = ResearchAgent()

    # Mock Agent.arun event stream
    event1 = MagicMock()
    event1.reasoning_content = "Checking historical context"
    event1.content = None

    event2 = MagicMock()
    event2.reasoning_content = None
    event2.content = "Follow-up answer text."

    async def mock_arun(*args, **kwargs):
        yield event1
        yield event2

    with patch("app.agents.research_agent.Agent") as MockAgentClass:
        mock_instance = MagicMock()
        mock_instance.arun = mock_arun
        MockAgentClass.return_value = mock_instance

        events = []
        async for item in agent.stream_followup(
            query="Can you expand on the methodology?",
            history=[
                {"role": "user", "content": "Tell me about quantum computing."},
                {"role": "assistant", "content": "Quantum computing uses qubits."},
            ],
        ):
            events.append(item)

    types = [e["type"] for e in events]
    assert "thought" in types
    assert "text" in types
    assert "completed" in types

    completed_event = next(e for e in events if e["type"] == "completed")
    assert completed_event["output"] == "Follow-up answer text."


@pytest.mark.asyncio
async def test_research_agent_generate_followup_questions():
    agent = ResearchAgent()

    mock_resp = MagicMock()
    mock_resp.content = MagicMock()
    mock_resp.content.questions = [
        "What are the error rates?",
        "How does decoherence affect scalability?",
    ]

    with patch("app.agents.research_agent.Agent") as MockAgentClass:
        mock_instance = MagicMock()
        mock_instance.arun = AsyncMock(return_value=mock_resp)
        MockAgentClass.return_value = mock_instance

        questions = await agent.generate_followup_questions(
            context="Quantum computing review",
            query="quantum supremacy",
        )
        assert len(questions) == 2
        assert "What are the error rates?" in questions


@pytest.mark.asyncio
async def test_research_agent_gap_analysis():
    agent = ResearchAgent()

    mock_resp = MagicMock()
    mock_resp.content = MagicMock()
    mock_resp.content.model_dump = MagicMock(return_value={
        "summary": "Corpus has distinct methodological gaps.",
        "gaps": [
            {
                "category": "methodological",
                "title": "Lack of longitudinal trials",
                "description": "Cross-sectional data only.",
                "suggested_questions": ["What happens over 5 years?"],
                "urgency": "high",
            }
        ]
    })

    papers = [
        PaperBase(id="p1", title="Study 1", year=2024, abstract="Abstract 1"),
        PaperBase(id="p2", title="Study 2", year=2023, abstract="Abstract 2"),
    ]

    with patch("app.agents.research_agent.Agent") as MockAgentClass:
        mock_instance = MagicMock()
        mock_instance.arun = AsyncMock(return_value=mock_resp)
        MockAgentClass.return_value = mock_instance

        gaps = await agent.analyze_research_gaps(papers=papers)
        assert "gaps" in gaps
        assert len(gaps["gaps"]) == 1
        assert gaps["gaps"][0]["title"] == "Lack of longitudinal trials"


@pytest.mark.asyncio
async def test_research_router_routes_initial_to_deep_research():
    router = ResearchRouter()
    output_text = "Initial deep research synthesis with comprehensive academic review and analysis of the transformer literature across multiple domains."

    async def mock_dr_stream(*args, **kwargs):
        yield {"type": "thought", "signature": "Thinking", "content": "Exploring papers"}
        yield {"type": "text", "content": output_text}
        yield {"type": "completed", "output": output_text}

    mock_dr = MagicMock()
    mock_dr.stream_research = mock_dr_stream

    with patch("app.agents.deep_research_agent.get_deep_research_agent", return_value=mock_dr), \
         patch("app.agents.research_agent.get_research_agent") as mock_get_fu, \
         patch("app.services.synthesis_service.generate_followup_questions", new_callable=AsyncMock) as mock_fu_q:
        mock_fu_q.return_value = ["Question 1", "Question 2"]

        chunks = []
        async for chunk in router.stream_investigation(
            query="What is transformer architecture?",
            history=[],  # Empty history => Initial research
        ):
            chunks.append(chunk)

        # ResearchAgent should NOT be called for initial research
        mock_get_fu.assert_not_called()

        combined = "".join(chunks)
        assert "deep_research" in combined
        assert "Deep Research" in combined
        assert output_text in combined


@pytest.mark.asyncio
async def test_research_router_routes_followup_to_research_agent():
    router = ResearchRouter()
    output_text = "Follow-up specific explanation on attention mechanisms detailing multi-head projections, scaled dot-products, and computational complexity."

    async def mock_fu_stream(*args, **kwargs):
        yield {"type": "thought", "signature": "Context Continuity", "content": "Evaluating follow-up"}
        yield {"type": "text", "content": output_text}
        yield {"type": "completed", "output": output_text}

    mock_fu = MagicMock()
    mock_fu.stream_followup = mock_fu_stream

    with patch("app.agents.research_agent.get_research_agent", return_value=mock_fu), \
         patch("app.agents.deep_research_agent.get_deep_research_agent") as mock_get_dr, \
         patch("app.services.synthesis_service.generate_followup_questions", new_callable=AsyncMock) as mock_fu_q:
        mock_fu_q.return_value = ["Followup Q1", "Followup Q2"]

        chunks = []
        async for chunk in router.stream_investigation(
            query="How does multi-head attention differ from standard attention?",
            history=[
                {"role": "user", "content": "What is transformer architecture?"},
                {"role": "assistant", "content": "Transformers use self-attention."},
            ],  # Non-empty history => Follow-up question!
        ):
            chunks.append(chunk)

        # DeepResearchAgent should NOT be called for follow-up questions
        mock_get_dr.assert_not_called()

        combined = "".join(chunks)
        assert "followup_research" in combined
        assert "Follow-up Research" in combined
        assert output_text in combined
