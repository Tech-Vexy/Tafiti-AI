"""Tests for /api/v1/social endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.database import Connection, Notification


def _swap_auth(client, user):
    from app.core.security import get_current_user
    from main import app
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.mark.asyncio
async def test_connect_to_user(client: AsyncClient, seeded_user, seeded_second_user):
    resp = await client.post("/api/v1/social/connect/test-user-002")
    assert resp.status_code == 200
    data = resp.json()
    assert data["follower_id"] == "test-user-001"
    assert data["followed_id"] == "test-user-002"
    assert data["status"] == "accepted"


@pytest.mark.asyncio
async def test_connect_to_self(client: AsyncClient, seeded_user):
    resp = await client.post("/api/v1/social/connect/test-user-001")
    assert resp.status_code == 400
    assert "yourself" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_connect_creates_notification(client: AsyncClient, seeded_user, seeded_second_user, db_session):
    await client.post("/api/v1/social/connect/test-user-002")

    result = await db_session.execute(
        select(Notification).where(Notification.user_id == "test-user-002")
    )
    notif = result.scalar_one_or_none()
    assert notif is not None
    assert notif.type == "connection_request"


@pytest.mark.asyncio
async def test_connect_duplicate_idempotent(client: AsyncClient, seeded_user, seeded_second_user, db_session):
    await client.post("/api/v1/social/connect/test-user-002")
    resp = await client.post("/api/v1/social/connect/test-user-002")
    assert resp.status_code == 200

    result = await db_session.execute(
        select(Connection).where(
            Connection.follower_id == "test-user-001",
            Connection.followed_id == "test-user-002",
        )
    )
    connections = result.scalars().all()
    assert len(connections) == 1


@pytest.mark.asyncio
async def test_list_notifications(client: AsyncClient, seeded_user, seeded_second_user):
    await client.post("/api/v1/social/connect/test-user-002")

    _swap_auth(client, {"user_id": "test-user-002", "username": "seconduser", "email": "second@example.com"})
    try:
        resp = await client.get("/api/v1/social/notifications")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
    finally:
        _swap_auth(client, {"user_id": "test-user-001", "username": "testuser", "email": "test@example.com"})


@pytest.mark.asyncio
async def test_mark_notification_read(client: AsyncClient, seeded_user, seeded_second_user, db_session):
    await client.post("/api/v1/social/connect/test-user-002")

    result = await db_session.execute(
        select(Notification).where(Notification.user_id == "test-user-002")
    )
    notif = result.scalar_one_or_none()
    assert notif is not None

    _swap_auth(client, {"user_id": "test-user-002", "username": "seconduser", "email": "second@example.com"})
    try:
        resp = await client.put(f"/api/v1/social/notifications/{notif.id}/read")
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"
    finally:
        _swap_auth(client, {"user_id": "test-user-001", "username": "testuser", "email": "test@example.com"})
