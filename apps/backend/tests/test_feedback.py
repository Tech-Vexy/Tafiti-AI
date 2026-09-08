"""Tests for /api/v1/feedback endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_submit_trial_feedback(client: AsyncClient, seeded_user):
    resp = await client.post("/api/v1/feedback/trial", json={
        "rating": 5,
        "favorite_feature": "Research synthesis",
        "improvement_text": "Great tool for literature review!",
        "would_recommend": "yes",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_given_feedback"] is True


@pytest.mark.asyncio
async def test_submit_trial_feedback_idempotent(client: AsyncClient, seeded_user):
    """Submitting feedback twice is a no-op."""
    await client.post("/api/v1/feedback/trial", json={"rating": 4})
    resp = await client.post("/api/v1/feedback/trial", json={"rating": 2})
    assert resp.status_code == 200
    assert resp.json()["has_given_feedback"] is True


@pytest.mark.asyncio
async def test_get_testimonials(client: AsyncClient, seeded_user):
    # Submit feedback with high rating and text
    await client.post("/api/v1/feedback/trial", json={
        "rating": 5,
        "improvement_text": "Amazing platform for African researchers. Love the ORCID integration!",
        "favorite_feature": "ORCID sync",
    })

    resp = await client.get("/api/v1/feedback/testimonials")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["rating"] >= 4


@pytest.mark.asyncio
async def test_get_testimonials_empty(client: AsyncClient):
    resp = await client.get("/api/v1/feedback/testimonials")
    assert resp.status_code == 200
    assert len(resp.json()) == 0
