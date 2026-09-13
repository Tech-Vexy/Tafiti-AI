"""Tests for /api/v1/auth endpoints (Clerk-based auth, no register/login)."""
from app.models.database import User
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import UserSettings


@pytest.mark.asyncio
async def test_get_me_creates_user(client: AsyncClient, db_session: AsyncSession):
    """GET /me auto-creates a User + UserSettings on first visit."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "test-user-001"
    assert data["subscription_status"] == "trialing"
    assert data["trial_ends_at"] is not None

    # Verify UserSettings was also created
    from sqlalchemy import select
    result = await db_session.execute(select(UserSettings).where(UserSettings.user_id == "test-user-001"))
    assert result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_get_me_returns_existing_user(client: AsyncClient, seeded_user):
    """GET /me returns existing user without creating a duplicate."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "test-user-001"
    assert data["username"] == "testuser"


@pytest.mark.asyncio
async def test_update_me(client: AsyncClient, seeded_user):
    """PUT /me updates user profile fields."""
    resp = await client.put(
        "/api/v1/auth/me",
        json={"bio": "Machine learning researcher", "university": "MIT"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["bio"] == "Machine learning researcher"
    assert data["university"] == "MIT"


@pytest.mark.asyncio
async def test_update_me_not_found(client: AsyncClient):
    """PUT /me returns 404 if user doesn't exist in DB yet."""
    from app.core.security import get_current_user
    from main import app

    async def override():
        return {"user_id": "nonexistent-user", "username": "ghost", "email": None}

    app.dependency_overrides[get_current_user] = override
    try:
        resp = await client.put("/api/v1/auth/me", json={"bio": "test"})
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_settings_creates_defaults(client: AsyncClient, seeded_user):
    """GET /settings auto-creates default settings for new user."""
    resp = await client.get("/api/v1/auth/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "dark"
    assert data["llm_provider"] == "nvidia"


@pytest.mark.asyncio
async def test_update_settings(client: AsyncClient, seeded_user):
    """PUT /settings updates user settings."""
    # First create settings
    await client.get("/api/v1/auth/settings")

    resp = await client.put(
        "/api/v1/auth/settings",
        json={"theme": "light", "llm_provider": "openai"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "light"
    assert data["llm_provider"] == "openai"


@pytest.mark.asyncio
async def test_start_trial(client: AsyncClient, db_session):
    """POST /start-trial activates a 7-day trial for inactive users."""
    user = User(
        id="test-user-001", username="testuser", email="test@example.com",
        expertise_areas=[], subscription_status="inactive",
    )
    db_session.add(user)
    await db_session.commit()

    resp = await client.post("/api/v1/auth/start-trial")
    assert resp.status_code == 200
    data = resp.json()
    assert data["subscription_status"] == "trialing"
    assert data["trial_ends_at"] is not None


@pytest.mark.asyncio
async def test_start_trial_idempotent(client: AsyncClient, db_session):
    """POST /start-trial is idempotent when already trialing."""
    from datetime import datetime, timedelta, timezone

    user = User(
        id="test-user-001", username="testuser", email="test@example.com",
        expertise_areas=[], subscription_status="trialing",
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=3),
    )
    db_session.add(user)
    await db_session.commit()

    resp = await client.post("/api/v1/auth/start-trial")
    assert resp.status_code == 200
    assert resp.json()["subscription_status"] == "trialing"


@pytest.mark.asyncio
async def test_start_trial_already_active(client: AsyncClient, db_session):
    """POST /start-trial returns existing active user unchanged."""
    from datetime import datetime, timedelta, timezone

    user = User(
        id="test-user-001", username="testuser", email="test@example.com",
        expertise_areas=[], subscription_status="active",
        subscription_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(user)
    await db_session.commit()

    resp = await client.post("/api/v1/auth/start-trial")
    assert resp.status_code == 200
    assert resp.json()["subscription_status"] == "active"
