"""Tests for /api/v1/research endpoints."""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
from app.models.schemas import PaperBase
from app.models.database import DeepResearchSession
from app.models.database import Thesis, ThesisCollaborator


@pytest.mark.asyncio
async def test_search_papers(client: AsyncClient, seeded_user):
    mock_service = MagicMock()
    mock_service.search_papers = AsyncMock(return_value=[
        PaperBase(id="W123", title="Test Paper", year=2023,
                  citations=10, abstract="Test abstract", authors=["Author"]),
    ])

    empty = MagicMock()
    empty.search_papers = AsyncMock(return_value=[])

    with patch.multiple("app.api.research",
        get_openalex_service=MagicMock(return_value=mock_service),
        get_core_service=MagicMock(return_value=empty),
        get_elsevier_service=MagicMock(return_value=empty),
        get_springer_service=MagicMock(return_value=empty),
        get_parallel_service=MagicMock(return_value=empty),
    ):
        resp = await client.post("/api/v1/research/search", json={
            "query": "machine learning", "limit": 5,
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "papers" in data
    assert len(data["papers"]) >= 1


@pytest.mark.asyncio
async def test_synthesize_no_papers(client: AsyncClient, seeded_user):
    resp = await client.post("/api/v1/research/synthesize", json={
        "query": "What is AI?", "papers": [],
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_search_history(client: AsyncClient, seeded_user):
    resp = await client.get("/api/v1/research/history")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_deep_research_status_is_user_scoped(client: AsyncClient, seeded_user, seeded_second_user, db_session):
    session = DeepResearchSession(
        user_id=seeded_second_user.id,
        query="private research",
        interaction_id="dr_private",
        status="completed",
        output="private output",
    )
    db_session.add(session)
    await db_session.commit()

    response = await client.get("/api/v1/research/deep-research/dr_private")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_deep_research_missing_status_is_not_found(client: AsyncClient, seeded_user):
    response = await client.get("/api/v1/research/deep-research/does-not-exist")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_thesis_collaborator_access_is_persisted(client: AsyncClient, seeded_user, seeded_second_user, db_session):
    thesis = Thesis(user_id=seeded_user.id, title="Shared thesis", content="{}")
    db_session.add(thesis)
    await db_session.flush()
    db_session.add(ThesisCollaborator(thesis_id=thesis.id, user_id=seeded_second_user.id, role="editor"))
    await db_session.commit()

    from sqlalchemy import select
    result = await db_session.execute(select(ThesisCollaborator).where(ThesisCollaborator.thesis_id == thesis.id))
    collaborator = result.scalar_one()
    assert collaborator.status == "active"
    assert collaborator.role == "editor"


@pytest.mark.asyncio
async def test_get_paper_detail(client: AsyncClient, seeded_user):
    mock_service = MagicMock()
    mock_service.get_paper_details = AsyncMock(return_value={
        "id": "W1234567890", "title": "Test", "year": 2023,
        "citations": 10, "abstract": "abs", "authors": ["A"],
    })
    with patch("app.api.research.get_openalex_service", return_value=mock_service):
        resp = await client.get("/api/v1/research/papers/W1234567890")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test"


@pytest.mark.asyncio
async def test_get_related_papers(client: AsyncClient, seeded_user):
    mock_service = MagicMock()
    mock_service.get_related_papers = AsyncMock(return_value=[])
    with patch("app.api.research.get_openalex_service", return_value=mock_service):
        resp = await client.get("/api/v1/research/papers/W123/related")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_springer_search_endpoint(client: AsyncClient, seeded_user):
    mock_springer = MagicMock()
    mock_springer.is_configured = True
    mock_springer.search_papers = AsyncMock(return_value=[
        PaperBase(
            id="springer:10.1007/test-doi",
            title="Springer Discovery Paper",
            year=2024,
            authors=["Alice", "Bob"],
            doi="10.1007/test-doi",
            url="https://doi.org/10.1007/test-doi",
            source="Springer Meta",
        )
    ])
    with patch("app.api.research.get_springer_service", return_value=mock_springer):
        resp = await client.post("/api/v1/research/springer/search", json={
            "query": "quantum gravity",
            "limit": 5,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["papers"][0]["title"] == "Springer Discovery Paper"


@pytest.mark.asyncio
async def test_springer_doi_endpoint(client: AsyncClient, seeded_user):
    mock_springer = MagicMock()
    mock_springer.is_configured = True
    mock_springer.get_paper_by_doi = AsyncMock(return_value=PaperBase(
        id="springer:10.1007/unique-doi",
        title="Direct DOI Paper",
        year=2023,
        authors=["Charlie"],
        doi="10.1007/unique-doi",
        url="https://doi.org/10.1007/unique-doi",
        source="SpringerOpen",
    ))
    with patch("app.api.research.get_springer_service", return_value=mock_springer):
        resp = await client.get("/api/v1/research/springer/doi/10.1007/unique-doi")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Direct DOI Paper"
    assert resp.json()["doi"] == "10.1007/unique-doi"
