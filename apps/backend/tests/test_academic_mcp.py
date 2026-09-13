"""Tests for the Tafiti Academic MCP Server tools and SSE app."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace
from starlette.applications import Starlette

from app.mcp.academic_server import (
    academic_mcp,
    search_openalex_papers,
    lookup_doi,
    search_user_library,
)


class TestAcademicMCPTools:
    @pytest.mark.asyncio
    async def test_search_openalex_papers_success(self):
        fake_paper = SimpleNamespace(
            id="W12345",
            title="Computational Complexity",
            doi="10.1000/182",
            publication_year=2023,
            citation_count=42,
            authors=["Alice Smith", "Bob Jones"],
            abstract="A study of complexity classes.",
            pdf_url="https://example.com/paper.pdf",
            is_open_access=True,
        )
        mock_openalex = MagicMock()
        mock_openalex.search_papers = AsyncMock(return_value=[fake_paper])

        with patch("app.mcp.academic_server.get_openalex_service", return_value=mock_openalex):
            results = await search_openalex_papers(query="complexity", limit=5, year_min=2020)

        assert len(results) == 1
        paper = results[0]
        assert paper["id"] == "W12345"
        assert paper["title"] == "Computational Complexity"
        assert paper["doi"] == "10.1000/182"
        assert paper["citation_count"] == 42
        mock_openalex.search_papers.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_search_openalex_papers_error_handled(self):
        mock_openalex = MagicMock()
        mock_openalex.search_papers = AsyncMock(side_effect=RuntimeError("OpenAlex API down"))

        with patch("app.mcp.academic_server.get_openalex_service", return_value=mock_openalex):
            results = await search_openalex_papers(query="test")

        assert len(results) == 1
        assert "error" in results[0]
        assert "OpenAlex API down" in results[0]["error"]

    @pytest.mark.asyncio
    async def test_lookup_doi_success(self):
        mock_details = {
            "title": "Quantum Computing Advances",
            "doi": "https://doi.org/10.1038/s41586-023-00001",
            "publication_year": 2024,
            "cited_by_count": 88,
            "authorships": [
                {"author": {"display_name": "Carol Danvers"}},
                {"author": {"display_name": "Tony Stark"}},
            ],
            "open_access": {"oa_url": "https://nature.com/oa.pdf"},
        }
        mock_openalex = MagicMock()
        mock_openalex.get_paper_details = AsyncMock(return_value=mock_details)

        with patch("app.mcp.academic_server.get_openalex_service", return_value=mock_openalex):
            result = await lookup_doi("10.1038/s41586-023-00001")

        assert result["title"] == "Quantum Computing Advances"
        assert result["citation_count"] == 88
        assert "danvers2024" in result["bibtex"]
        assert "@article" in result["bibtex"]

    @pytest.mark.asyncio
    async def test_lookup_doi_not_found(self):
        mock_openalex = MagicMock()
        mock_openalex.get_paper_details = AsyncMock(return_value=None)

        with patch("app.mcp.academic_server.get_openalex_service", return_value=mock_openalex):
            result = await lookup_doi("10.9999/invalid")

        assert "error" in result
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_search_user_library(self):
        fake_file = SimpleNamespace(
            id=1,
            filename="np_completeness.pdf",
            file_size=1048576,
            uploaded_at="2026-09-10 10:00:00",
        )
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [fake_file]
        mock_db.execute = AsyncMock(return_value=mock_result)

        mock_session_ctx = AsyncMock()
        mock_session_ctx.__aenter__.return_value = mock_db

        with patch("app.mcp.academic_server.AsyncSessionLocal", return_value=mock_session_ctx):
            results = await search_user_library(query="np_completeness", user_id="user_123")

        assert len(results) == 1
        assert results[0]["filename"] == "np_completeness.pdf"
        assert results[0]["file_size"] == 1048576


class TestAcademicMCPApp:
    def test_sse_app_instance(self):
        app = academic_mcp.sse_app()
        assert isinstance(app, Starlette)
