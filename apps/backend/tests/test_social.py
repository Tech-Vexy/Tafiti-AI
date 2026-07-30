import pytest
from httpx import AsyncClient

from main import app
from app.core.security import get_current_user


@pytest.mark.asyncio
async def test_connect_to_self_error(client: AsyncClient):
    """Test that a user cannot connect to themselves."""

    # Mock user ID to match the target ID
    test_user_id = "user_123"

    async def override_get_current_user():
        return {
            "user_id": test_user_id,
            "username": "testuser",
            "email": "test@example.com"
        }

    # Override the dependency
    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        # Attempt to connect to self
        response = await client.post(
            f"/api/v1/social/connect/{test_user_id}",
            # We still need some form of Authorization header to pass basic validation
            # if there are any middleware checks, though the override might bypass it.
            # Adding it just in case.
            headers={"Authorization": "Bearer fake-token"}
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"] == "You cannot connect to yourself"

    finally:
        # Clean up the override
        app.dependency_overrides.pop(get_current_user, None)
