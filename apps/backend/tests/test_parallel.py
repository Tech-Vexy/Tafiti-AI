"""
Unit tests for Parallel Web Systems integration:
- Parallel Search API (search, search_sync, search_web)
- OpenAI-compatible search_web function tool definition
- Agno Toolkit (ParallelTools)
- Parallel Task API (Deep Research)
- Parallel Extract API
"""

import pytest
from unittest.mock import MagicMock, AsyncMock

from app.services.parallel_service import (
    ParallelService,
    ParallelTools,
    PARALLEL_SEARCH_TOOL_DEFINITION,
)
from parallel.types.search_result import SearchResult, WebSearchResult


def test_parallel_tool_definition_schema():
    """Verify OpenAI function-calling tool schema matches specification."""
    assert PARALLEL_SEARCH_TOOL_DEFINITION["type"] == "function"
    fn = PARALLEL_SEARCH_TOOL_DEFINITION["function"]
    assert fn["name"] == "search_web"
    params = fn["parameters"]
    assert params["type"] == "object"
    assert "objective" in params["properties"]
    assert "search_queries" in params["properties"]
    assert params["required"] == ["objective", "search_queries"]


@pytest.fixture
def mock_search_result():
    return SearchResult(
        search_id="search_abc123",
        session_id="sess_xyz789",
        results=[
            WebSearchResult(
                title="Vector Database Benchmarks 2025",
                url="https://example.com/vector-db-2025",
                publish_date="2025-01-20",
                excerpts=[
                    "pgvector demonstrates 10x throughput scaling on PostgreSQL 17.",
                    "Memory consumption is minimized through scalar quantization."
                ],
            )
        ],
    )


@pytest.mark.asyncio
async def test_parallel_search_async(mock_search_result):
    """Test async search execution with result formatting."""
    service = ParallelService(api_key="test_api_key")
    service._async_client = MagicMock()
    service._async_client.search = AsyncMock(return_value=mock_search_result)

    result = await service.search(
        objective="Find recent vector database benchmarks",
        search_queries=["pgvector benchmark 2025", "vector database performance"],
        mode="advanced",
        max_results=5,
        use_cache=False,
    )

    assert result["search_id"] == "search_abc123"
    assert len(result["results"]) == 1
    assert result["results"][0]["title"] == "Vector Database Benchmarks 2025"
    assert len(result["results"][0]["excerpts"]) == 2


@pytest.mark.asyncio
async def test_parallel_search_web_tool(mock_search_result):
    """Test agent-facing search_web tool returning pre-compressed markdown excerpts."""
    service = ParallelService(api_key="test_api_key")
    service._async_client = MagicMock()
    service._async_client.search = AsyncMock(return_value=mock_search_result)

    content = await service.search_web(
        objective="Vector Database Benchmarks",
        search_queries=["pgvector benchmark", "qdrant comparison"],
    )

    assert "### Web Evidence for: Vector Database Benchmarks" in content
    assert "[Vector Database Benchmarks 2025](https://example.com/vector-db-2025)" in content
    assert "pgvector demonstrates 10x throughput scaling" in content


@pytest.mark.asyncio
async def test_parallel_search_papers_adapter(mock_search_result):
    """Test adapting web results into normalized academic PaperBase records."""
    service = ParallelService(api_key="test_api_key")
    service._async_client = MagicMock()
    service._async_client.search = AsyncMock(return_value=mock_search_result)

    papers = await service.search_papers(query="Vector Databases", limit=5)
    assert len(papers) == 1
    p = papers[0]
    assert p.id.startswith("parallel:")
    assert p.source == "parallel"
    assert p.year == 2025
    assert "pgvector demonstrates 10x throughput scaling" in p.abstract


def test_parallel_search_sync(mock_search_result):
    """Test synchronous search method."""
    service = ParallelService(api_key="test_api_key")
    service._sync_client = MagicMock()
    service._sync_client.search = MagicMock(return_value=mock_search_result)

    res = service.search_sync(
        objective="JEPA Architecture",
        search_queries=["JEPA Meta AI", "Joint Embedding Predictive Architecture"],
        mode="advanced",
    )
    assert res["search_id"] == "search_abc123"
    assert len(res["results"]) == 1


@pytest.mark.asyncio
async def test_parallel_task_deep_research():
    """Test Task API deep research run creation and result retrieval."""
    service = ParallelService(api_key="test_api_key")

    mock_run = MagicMock()
    mock_run.run_id = "task_run_999"
    service._async_client = MagicMock()
    service._async_client.task_run.create = AsyncMock(return_value=mock_run)

    # 1. Create task
    task = await service.create_deep_research(
        input_prompt="Comprehensive evaluation of agent memory systems",
        processor="pro",
    )
    assert task["run_id"] == "task_run_999"
    assert task["processor"] == "pro"

    # 2. Retrieve result with basis citations
    mock_citation = MagicMock()
    mock_citation.url = "https://arxiv.org/abs/2305.18290"
    mock_citation.title = "DPO Research Paper"
    mock_citation.excerpt = "Direct Preference Optimization reduces training instability."

    mock_field = MagicMock()
    mock_field.field = "Methodology"
    mock_field.citations = [mock_citation]

    mock_task_res = MagicMock()
    mock_task_res.output.content = "Synthesized analysis on agent memory architectures."
    mock_task_res.output.basis = [mock_field]

    service._async_client.task_run.result = AsyncMock(return_value=mock_task_res)

    res = await service.get_deep_research_result("task_run_999", api_timeout=60)
    assert res["status"] == "completed"
    assert "Synthesized analysis" in res["content"]
    assert len(res["basis"]) == 1
    assert res["basis"][0]["field"] == "Methodology"
    assert res["basis"][0]["citations"][0]["url"] == "https://arxiv.org/abs/2305.18290"


@pytest.mark.asyncio
async def test_parallel_extract():
    """Test Parallel Extract API for markdown generation."""
    service = ParallelService(api_key="test_api_key")

    mock_item = MagicMock()
    mock_item.url = "https://example.com/article"
    mock_item.title = "Article Title"
    mock_item.text = "# Article Markdown\n\nContent details here."

    mock_extract_res = MagicMock()
    mock_extract_res.results = [mock_item]

    service._async_client = MagicMock()
    service._async_client.extract = AsyncMock(return_value=mock_extract_res)

    res = await service.extract(urls="https://example.com/article")
    assert len(res["results"]) == 1
    assert res["results"][0]["title"] == "Article Title"
    assert "# Article Markdown" in res["results"][0]["text"]


def test_agno_parallel_tools(mock_search_result):
    """Test Agno Toolkit wrapper exposing search_web."""
    tools = ParallelTools(api_key="test_api_key")
    tools.service._sync_client = MagicMock()
    tools.service._sync_client.search = MagicMock(return_value=mock_search_result)

    output = tools.search_web(
        objective="Vector Database Benchmarks",
        search_queries=["pgvector", "qdrant"],
    )
    assert "### Web Evidence: Vector Database Benchmarks" in output
    assert "Vector Database Benchmarks 2025" in output
