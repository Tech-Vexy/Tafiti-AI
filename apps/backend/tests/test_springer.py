"""Tests for the Springer Nature Meta + Open Access integration."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.springer_service import SpringerService, get_springer_service
from app.core.external_client import RateLimitError


def make_record(**overrides):
    record = {
        "title": "A study on renewable energy",
        "doi": "10.1007/s12345-67890",
        "abstract": {"p": ["This paper explores renewable energy sources."]},
        "publicationDate": "2023-05-01",
        "publicationName": "Nature Energy",
        "openaccess": "false",
        "creators": [{"creator": "Doe, John"}, {"creator": "Smith, Jane"}],
        "identifier": [{"id": "doi:10.1007/s12345-67890"}],
        "url": [
            {"format": "html", "platform": "web", "value": "https://link.springer.com/article/10.1007/s12345-67890"},
            {"format": "pdf", "platform": "web", "value": "https://link.springer.com/content/pdf/10.1007/s12345-67890.pdf"},
        ],
    }
    record.update(overrides)
    return record


class TestParsing:
    @pytest.mark.asyncio
    async def test_parse_record_full(self):
        service = SpringerService()
        paper = service._parse_record(make_record(), source="Springer Meta")
        assert paper is not None
        assert paper.id == "springer:10.1007/s12345-67890"
        assert paper.title == "A study on renewable energy"
        assert paper.year == 2023
        assert paper.authors == ["Doe, John", "Smith, Jane"]
        assert paper.abstract == "This paper explores renewable energy sources."
        assert paper.doi == "10.1007/s12345-67890"
        assert paper.url == "https://link.springer.com/article/10.1007/s12345-67890"
        assert paper.pdf_url == "https://link.springer.com/content/pdf/10.1007/s12345-67890.pdf"
        assert paper.publisher == "Nature Energy"
        assert paper.source == "Springer Meta"

    @pytest.mark.asyncio
    async def test_parse_abstract_string_and_dict(self):
        service = SpringerService()
        assert service._parse_abstract("plain abstract") == "plain abstract"
        assert service._parse_abstract({"p": ["first", "second"]}) == "first second"
        assert service._parse_abstract(None) == ""
        assert service._parse_abstract({"Background": "x", "Methods": "y"}) == "Background: x Methods: y"

    @pytest.mark.asyncio
    async def test_parse_openaccess_pdf_url(self):
        service = SpringerService()
        paper = service._parse_record(
            make_record(openaccess="true", url=None, pdfUrl=None),
            source="SpringerOpen",
        )
        assert paper.pdf_url == "https://link.springer.com/content/pdf/10.1007/s12345-67890.pdf"

        paper = service._parse_record(
            make_record(openAccess=True, url=None, pdfUrl="https://static-content.springer.com/custom.pdf"),
            source="SpringerOpen",
        )
        assert paper.pdf_url == "https://static-content.springer.com/custom.pdf"

    @pytest.mark.asyncio
    async def test_parse_missing_title_returns_none(self):
        service = SpringerService()
        assert service._parse_record({"doi": "10.1007/x"}, source="Springer Meta") is None

    @pytest.mark.asyncio
    async def test_build_query(self):
        assert SpringerService._build_query("quantum computing") == '"quantum computing"'
        assert SpringerService._build_query("doi:10.1007/abc") == "doi:10.1007/abc"
        q = SpringerService._build_query("ai", filters={"year": 2020, "type": "Journal Article"})
        assert 'year:2020' in q and 'type:"Journal Article"' in q


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_papers_skips_without_key(self):
        service = SpringerService(meta_api_key="", open_access_api_key="")
        service.api_key = None
        service.meta_api_key = None
        service.open_access_api_key = None
        assert await service.search_papers("cancer") == []

    @pytest.mark.asyncio
    async def test_search_meta_parses_records(self):
        service = SpringerService(meta_api_key="meta-secret-key")
        fake_response = {
            "apiMessage": "ok",
            "records": [make_record(), make_record(doi="10.1007/s12345-99999", title="Second paper")],
        }
        with patch.object(SpringerService, "get", new=AsyncMock(return_value=fake_response)) as mock_get:
            papers = await service.search_meta(query="cancer", limit=10)

        assert len(papers) == 2
        mock_get.assert_called_once()
        _, kwargs = mock_get.call_args
        assert kwargs["params"]["api_key"] == "meta-secret-key"
        assert kwargs["params"]["p"] == 10

    @pytest.mark.asyncio
    async def test_search_openaccess_parses_records(self):
        service = SpringerService(open_access_api_key="oa-secret-key")
        fake_response = {
            "apiMessage": "ok",
            "records": [make_record(openAccess="true")],
        }
        with patch.object(SpringerService, "get", new=AsyncMock(return_value=fake_response)) as mock_get:
            papers = await service.search_openaccess(query="crispr", limit=5)

        assert len(papers) == 1
        mock_get.assert_called_once()
        _, kwargs = mock_get.call_args
        assert kwargs["params"]["api_key"] == "oa-secret-key"
        assert kwargs["params"]["p"] == 5

    @pytest.mark.asyncio
    async def test_search_papers_dedupes_by_doi(self):
        service = SpringerService(meta_api_key="meta-key", open_access_api_key="oa-key")
        shared = make_record()
        meta_response = {"records": [shared]}
        oa_response = {"records": [shared, make_record(doi="10.1007/s55555-00001", title="OA paper")]}
        with patch.object(SpringerService, "get", side_effect=[meta_response, oa_response]):
            papers = await service.search_papers(query="cancer", limit=10)

        assert len(papers) == 2
        ids = {p.id for p in papers}
        assert "springer:10.1007/s12345-67890" in ids
        assert "springer:10.1007/s55555-00001" in ids

    @pytest.mark.asyncio
    async def test_search_papers_open_access_only(self):
        service = SpringerService(meta_api_key="meta-key", open_access_api_key="oa-key")
        oa_response = {"records": [make_record(openAccess=True)]}
        with patch.object(SpringerService, "get", new=AsyncMock(return_value=oa_response)) as mock_get:
            papers = await service.search_papers(query="quantum", limit=5, open_access_only=True)

        assert len(papers) == 1
        mock_get.assert_called_once()
        endpoint = mock_get.call_args[0][0]
        assert "openaccess" in endpoint

    @pytest.mark.asyncio
    async def test_get_paper_by_doi(self):
        service = SpringerService(meta_api_key="meta-key", open_access_api_key="oa-key")
        sample = make_record(doi="10.1007/s12345-99999", title="Specific Paper")
        oa_response = {"records": [sample]}
        with patch.object(SpringerService, "get", new=AsyncMock(return_value=oa_response)):
            paper = await service.get_paper_by_doi("https://doi.org/10.1007/s12345-99999")

        assert paper is not None
        assert paper.doi == "10.1007/s12345-99999"
        assert paper.title == "Specific Paper"

    @pytest.mark.asyncio
    async def test_search_meta_rate_limit_graceful(self):
        service = SpringerService(meta_api_key="test-key")
        with patch.object(
            SpringerService, "get",
            new=AsyncMock(side_effect=RateLimitError("rate limited")),
        ):
            papers = await service.search_meta(query="cancer", limit=10)
        assert papers == []


def test_get_springer_service_returns_singleton():
    a = get_springer_service()
    b = get_springer_service()
    assert a is b
    c = get_springer_service(client=MagicMock())
    assert c is not a


@pytest.mark.asyncio
async def test_discovery_engine_springer_backend():
    from app.services.discovery_engine import DiscoveryEngine
    engine = DiscoveryEngine()
    assert "springer" in engine._search_backends

    sample = make_record(doi="10.1007/s99999", title="Discovered Springer Paper")
    with patch.object(SpringerService, "search_papers", new=AsyncMock(return_value=[
        SpringerService()._parse_record(sample, source="Springer Meta")
    ])):
        res = await engine.search_springer("robotics", limit=5)
        assert len(res) == 1
        assert res[0]["title"] == "Discovered Springer Paper"
        assert res[0]["doi"] == "10.1007/s99999"
        assert res[0]["source_type"] == "paper"