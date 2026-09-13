"""Tests for /api/v1/billing endpoints."""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from app.models.database import PaymentTransaction


@pytest.mark.asyncio
async def test_initialize_subscription(client: AsyncClient, seeded_user, db_session):
    mock_paystack = {
        "authorization_url": "https://checkout.paystack.com/abc",
        "reference": "ref_123",
    }
    with patch("app.api.billing.paystack.initialize_transaction", new_callable=AsyncMock, return_value=mock_paystack):
        resp = await client.post("/api/v1/billing/initialize")
    assert resp.status_code == 200
    data = resp.json()
    assert "authorization_url" in data
    from sqlalchemy import select
    result = await db_session.execute(select(PaymentTransaction).where(PaymentTransaction.reference == "ref_123"))
    assert result.scalar_one().user_id == seeded_user.id


@pytest.mark.asyncio
async def test_initialize_subscription_user_not_found(client: AsyncClient):
    """404 when user doesn't exist in DB."""
    from app.core.security import get_current_user
    from main import app

    async def override():
        return {"user_id": "ghost", "username": "ghost", "email": None}
    app.dependency_overrides[get_current_user] = override
    try:
        resp = await client.post("/api/v1/billing/initialize")
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_verify_subscription_success(client: AsyncClient, seeded_user):
    mock_verification = {
        "status": "success",
        "amount": 20000,
        "currency": "KES",
        "customer": {"customer_code": "CUST_123", "email": seeded_user.email},
    }
    with patch("app.api.billing.paystack.verify_transaction", new_callable=AsyncMock, return_value=mock_verification):
        with patch("app.api.billing.paystack.initialize_transaction", new_callable=AsyncMock, return_value={"reference": "ref_123"}):
            await client.post("/api/v1/billing/initialize")
        resp = await client.get("/api/v1/billing/verify/ref_123")
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


@pytest.mark.asyncio
async def test_verify_subscription_rejects_unowned_reference(client: AsyncClient, seeded_user, seeded_second_user, db_session):
    from app.api.billing import SUBSCRIPTION_AMOUNT_KES

    db_session.add(PaymentTransaction(
        user_id=seeded_second_user.id,
        reference="ref_other",
        amount=SUBSCRIPTION_AMOUNT_KES * 100,
        currency="KES",
    ))
    await db_session.commit()

    mock_verification = {
        "status": "success",
        "amount": 20000,
        "currency": "KES",
        "customer": {"email": seeded_user.email},
    }
    with patch("app.api.billing.paystack.verify_transaction", new_callable=AsyncMock, return_value=mock_verification):
        resp = await client.get("/api/v1/billing/verify/ref_other")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_verify_subscription_pending(client: AsyncClient, seeded_user):
    mock_verification = {"status": "pending"}
    with patch("app.api.billing.paystack.verify_transaction", new_callable=AsyncMock, return_value=mock_verification):
        resp = await client.get("/api/v1/billing/verify/ref_456")
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_verify_subscription_failed(client: AsyncClient, seeded_user):
    with patch("app.api.billing.paystack.verify_transaction", new_callable=AsyncMock, return_value=None):
        resp = await client.get("/api/v1/billing/verify/bad_ref")
    assert resp.status_code == 400
