import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_saved_query(client: AsyncClient, test_user_data, test_paper_data):
    """Test creating a saved query"""
    # Register and get token
    register_response = await client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    token = register_response.json()["access_token"]
    
    # Create saved query
    response = await client.post(
        "/api/v1/queries/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Test Query",
            "query": "What is AI?",
            "papers": [test_paper_data],
            "answer": "AI is artificial intelligence.",
            "tags": ["ai", "test"]
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Query"
    assert len(data["tags"]) == 2


@pytest.mark.asyncio
async def test_list_saved_queries(client: AsyncClient, test_user_data, test_paper_data):
    """Test listing saved queries"""
    # Register and get token
    register_response = await client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    token = register_response.json()["access_token"]
    
    # Create a query
    await client.post(
        "/api/v1/queries/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Test Query",
            "query": "What is AI?",
            "papers": [test_paper_data],
            "answer": "AI is artificial intelligence.",
            "tags": ["ai"]
        }
    )
    
    # List queries
    response = await client.get(
        "/api/v1/queries/",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0


@pytest.mark.asyncio
async def test_toggle_favorite(client: AsyncClient, test_user_data, test_paper_data):
    """Test toggling favorite status"""
    # Register and get token
    register_response = await client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    token = register_response.json()["access_token"]
    
    # Create a query
    create_response = await client.post(
        "/api/v1/queries/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Test Query",
            "query": "What is AI?",
            "papers": [test_paper_data],
            "answer": "AI is artificial intelligence.",
            "tags": []
        }
    )
    query_id = create_response.json()["id"]
    
    # Toggle favorite
    response = await client.post(
        f"/api/v1/queries/{query_id}/favorite",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["is_favorite"] == True


@pytest.mark.asyncio
async def test_delete_query(client: AsyncClient, test_user_data, test_paper_data):
    """Test deleting a query"""
    # Register and get token
    register_response = await client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    token = register_response.json()["access_token"]
    
    # Create a query
    create_response = await client.post(
        "/api/v1/queries/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Test Query",
            "query": "What is AI?",
            "papers": [test_paper_data],
            "answer": "AI is artificial intelligence.",
            "tags": []
        }
    )
    query_id = create_response.json()["id"]
    
    # Delete query
    response = await client.delete(
        f"/api/v1/queries/{query_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 204
    
    # Verify it's deleted
    get_response = await client.get(
        f"/api/v1/queries/{query_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get_response.status_code == 404
