"""Tests for /api/v1/ghost-profiles endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.database import GhostProfile, OrcidProfile


@pytest.mark.asyncio
async def test_list_ghost_profiles_requires_orcid(client: AsyncClient, seeded_user):
    """Listing ghost profiles requires an ORCID profile link."""
    resp = await client.get("/api/v1/ghost-profiles/")
    assert resp.status_code == 200
    # Without ORCID profile, returns empty list
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_list_ghost_profiles_with_orcid(client: AsyncClient, seeded_user, db_session):
    """With ORCID profile, ghost profiles are returned."""
    # Create ORCID profile for user
    orcid = OrcidProfile(
        user_id="test-user-001",
        orcid_id="0000-0001-2345-6789",
        access_token="fake_token",
    )
    db_session.add(orcid)

    # Create unclaimed ghost profile
    ghost = GhostProfile(
        display_name="Dr. Ghost Author",
        email="ghost@example.com",
        orcid_id="0000-0001-9999-9999",
        affiliation="MIT",
    )
    db_session.add(ghost)
    await db_session.commit()

    resp = await client.get("/api/v1/ghost-profiles/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_claim_ghost_profile(client: AsyncClient, seeded_user, db_session):
    ghost = GhostProfile(
        display_name="Claim Me",
        email="claimme@example.com",
        invite_token="valid_token_123",
    )
    db_session.add(ghost)
    await db_session.commit()

    resp = await client.post("/api/v1/ghost-profiles/claim", json={
        "invite_token": "valid_token_123",
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_claim_ghost_profile_invalid_token(client: AsyncClient, seeded_user):
    resp = await client.post("/api/v1/ghost-profiles/claim", json={
        "invite_token": "nonexistent-token",
    })
    assert resp.status_code == 404
