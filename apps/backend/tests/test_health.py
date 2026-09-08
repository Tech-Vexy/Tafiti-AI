"""Tests for root and health endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("healthy", "degraded")
    assert "dependencies" in data
    assert "database" in data["dependencies"]


@pytest.mark.asyncio
async def test_rate_limit_headers_present(client: AsyncClient):
    """Rate-limited endpoints should include X-RateLimit-Limit / Remaining / Reset."""
    resp = await client.get("/api/v1/auth/me")
    # 200 (authenticated) or 401 (no token) — headers present regardless
    assert resp.status_code in (200, 401, 403)
    assert "X-RateLimit-Limit" in resp.headers
    assert "X-RateLimit-Remaining" in resp.headers
    assert "X-RateLimit-Reset" in resp.headers
    assert int(resp.headers["X-RateLimit-Limit"]) > 0
    assert int(resp.headers["X-RateLimit-Remaining"]) >= 0
