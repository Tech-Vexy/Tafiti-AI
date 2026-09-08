"""Tests for /api/v1/notes endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_note(client: AsyncClient, seeded_user):
    resp = await client.post("/api/v1/notes/", json={
        "title": "My Research Note",
        "content": "Important findings about transformers...",
        "tags": ["transformers", "NLP"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Research Note"
    assert data["user_id"] == "test-user-001"
    assert len(data["tags"]) == 2


@pytest.mark.asyncio
async def test_list_notes(client: AsyncClient, seeded_user):
    await client.post("/api/v1/notes/", json={"title": "Note 1", "content": "content1"})
    await client.post("/api/v1/notes/", json={"title": "Note 2", "content": "content2"})

    resp = await client.get("/api/v1/notes/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_note_by_id(client: AsyncClient, seeded_user):
    create_resp = await client.post("/api/v1/notes/", json={
        "title": "Fetchable Note", "content": "fetch me",
    })
    note_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/notes/{note_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Fetchable Note"


@pytest.mark.asyncio
async def test_get_note_not_found(client: AsyncClient, seeded_user):
    resp = await client.get("/api/v1/notes/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_note(client: AsyncClient, seeded_user):
    create_resp = await client.post("/api/v1/notes/", json={
        "title": "Old Title", "content": "old content",
    })
    note_id = create_resp.json()["id"]

    resp = await client.put(f"/api/v1/notes/{note_id}", json={
        "title": "New Title", "content": "new content",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "New Title"
    assert data["content"] == "new content"


@pytest.mark.asyncio
async def test_update_note_partial(client: AsyncClient, seeded_user):
    create_resp = await client.post("/api/v1/notes/", json={
        "title": "Keep Title", "content": "old content",
    })
    note_id = create_resp.json()["id"]

    resp = await client.put(f"/api/v1/notes/{note_id}", json={"content": "updated"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Keep Title"
    assert data["content"] == "updated"


@pytest.mark.asyncio
async def test_delete_note(client: AsyncClient, seeded_user):
    create_resp = await client.post("/api/v1/notes/", json={
        "title": "To Delete", "content": "bye",
    })
    note_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/notes/{note_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/v1/notes/{note_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_note_not_found(client: AsyncClient, seeded_user):
    resp = await client.delete("/api/v1/notes/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_notes_isolated_per_user(client: AsyncClient, seeded_user, seeded_second_user):
    """User A's notes are invisible to User B — isolation at the SQL level."""
    from app.core.security import get_current_user
    from main import app

    # Create a note as user A
    await client.post("/api/v1/notes/", json={"title": "A's Note", "content": "secret"})

    # Switch auth to user B
    async def _auth_b():
        return {"user_id": "test-user-002", "username": "seconduser", "email": "second@example.com"}
    app.dependency_overrides[get_current_user] = _auth_b
    try:
        resp = await client.get("/api/v1/notes/")
        assert resp.status_code == 200
        assert len(resp.json()) == 0
    finally:
        app.dependency_overrides[get_current_user] = lambda: {"user_id": "test-user-001", "username": "testuser", "email": "test@example.com"}
