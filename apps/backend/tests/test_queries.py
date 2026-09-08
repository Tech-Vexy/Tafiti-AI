"""Tests for /api/v1/queries endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_saved_query(client: AsyncClient, seeded_user, paper_data):
    resp = await client.post("/api/v1/queries/", json={
        "title": "ML Research Query",
        "query": "What is transfer learning?",
        "papers": [paper_data],
        "answer": "Transfer learning is a technique...",
        "tags": ["ML", "transfer-learning"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "ML Research Query"
    assert len(data["papers"]) == 1
    assert data["is_favorite"] is False


@pytest.mark.asyncio
async def test_list_saved_queries(client: AsyncClient, seeded_user, paper_data):
    await client.post("/api/v1/queries/", json={
        "title": "Q1", "query": "q1", "papers": [paper_data], "answer": "a1",
    })
    await client.post("/api/v1/queries/", json={
        "title": "Q2", "query": "q2", "papers": [paper_data], "answer": "a2",
    })

    resp = await client.get("/api/v1/queries/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_saved_query(client: AsyncClient, seeded_user, paper_data):
    create_resp = await client.post("/api/v1/queries/", json={
        "title": "Fetchable", "query": "q", "papers": [paper_data], "answer": "a",
    })
    query_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/queries/{query_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Fetchable"


@pytest.mark.asyncio
async def test_get_saved_query_not_found(client: AsyncClient, seeded_user):
    resp = await client.get("/api/v1/queries/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_saved_query(client: AsyncClient, seeded_user, paper_data):
    create_resp = await client.post("/api/v1/queries/", json={
        "title": "Old", "query": "q", "papers": [paper_data], "answer": "a",
    })
    query_id = create_resp.json()["id"]

    resp = await client.put(f"/api/v1/queries/{query_id}", json={"title": "New Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_toggle_favorite(client: AsyncClient, seeded_user, paper_data):
    create_resp = await client.post("/api/v1/queries/", json={
        "title": "Fav Test", "query": "q", "papers": [paper_data], "answer": "a",
    })
    query_id = create_resp.json()["id"]

    resp = await client.post(f"/api/v1/queries/{query_id}/favorite")
    assert resp.status_code == 200
    assert resp.json()["is_favorite"] is True

    # Toggle back
    resp = await client.post(f"/api/v1/queries/{query_id}/favorite")
    assert resp.status_code == 200
    assert resp.json()["is_favorite"] is False


@pytest.mark.asyncio
async def test_delete_saved_query(client: AsyncClient, seeded_user, paper_data):
    create_resp = await client.post("/api/v1/queries/", json={
        "title": "To Delete", "query": "q", "papers": [paper_data], "answer": "a",
    })
    query_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/queries/{query_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/v1/queries/{query_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_queries_isolated_per_user(client: AsyncClient, seeded_user, seeded_second_user, paper_data):
    from app.core.security import get_current_user
    from main import app

    await client.post("/api/v1/queries/", json={
        "title": "A's Query", "query": "q", "papers": [paper_data], "answer": "a",
    })

    async def _auth_b():
        return {"user_id": "test-user-002", "username": "seconduser", "email": "second@example.com"}
    app.dependency_overrides[get_current_user] = _auth_b
    try:
        resp = await client.get("/api/v1/queries/")
        assert resp.status_code == 200
        assert len(resp.json()) == 0
    finally:
        app.dependency_overrides[get_current_user] = lambda: {"user_id": "test-user-001", "username": "testuser", "email": "test@example.com"}
