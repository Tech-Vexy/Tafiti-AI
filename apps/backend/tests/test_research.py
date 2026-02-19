import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_search_papers(client: AsyncClient, test_user_data):
    """Test paper search"""
    # Register and get token
    register_response = await client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    token = register_response.json()["access_token"]
    
    # Mock OpenAlex service
    with patch('app.services.openalex_service.OpenAlexService.search_papers') as mock_search:
        mock_search.return_value = [
            {
                "id": "W123",
                "title": "Test Paper",
                "year": 2023,
                "citations": 10,
                "abstract": "Test abstract",
                "authors": ["Author"]
            }
        ]
        
        response = await client.post(
            "/api/v1/research/search",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "query": "machine learning",
                "limit": 5
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert "papers" in data
    assert len(data["papers"]) > 0


@pytest.mark.asyncio
async def test_synthesize(client: AsyncClient, test_user_data, test_paper_data):
    """Test synthesis generation"""
    # Register and get token
    register_response = await client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    token = register_response.json()["access_token"]
    
    # Mock research agent
    with patch('app.agents.research_agent.ResearchAgent.synthesize') as mock_synthesize:
        mock_synthesize.return_value = {
            "answer": "Test synthesis answer",
            "sources_used": [1],
            "model": "test-model",
            "provider": "test"
        }
        
        response = await client.post(
            "/api/v1/research/synthesize",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "query": "What is machine learning?",
                "papers": [test_paper_data]
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources_used" in data


@pytest.mark.asyncio
async def test_synthesize_no_papers(client: AsyncClient, test_user_data):
    """Test synthesis with no papers fails"""
    # Register and get token
    register_response = await client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    token = register_response.json()["access_token"]
    
    response = await client.post(
        "/api/v1/research/synthesize",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "query": "What is machine learning?",
            "papers": []
        }
    )
    
    assert response.status_code == 400
    assert "No papers" in response.json()["detail"]
