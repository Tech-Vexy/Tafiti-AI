import pytest
from httpx import AsyncClient

from main import app
from app.core.security import get_current_user

@pytest.fixture(autouse=True)
def setup_auth_override(test_user_data):
    override_user = {
        "user_id": test_user_data.get("username", "testuser"),
        "username": test_user_data.get("username"),
        "email": test_user_data.get("email")
    }
    app.dependency_overrides[get_current_user] = lambda: override_user
    yield
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_verify_anchor_not_found(client: AsyncClient, test_user_data):
    """Test verification of a missing anchor returns 404"""
    response = await client.post(
        "/api/v1/anchors/verify",
        json={
            "anchor_id": "nonexistent_anchor_123",
            "content": "This is some content to verify against the missing anchor."
        }
    )

    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Anchor not found"

@pytest.mark.asyncio
async def test_create_and_verify_anchor(client: AsyncClient, test_user_data, db_session):
    """Test creating an anchor and verifying it with matching and non-matching content"""
    # Create user in the database directly to bypass Clerk auth during testing
    from app.models.database import User
    import uuid
    from sqlalchemy.exc import IntegrityError

    user_id = test_user_data.get("username", "testuser")
    user = User(
        id=user_id,
        email=test_user_data.get("email"),
        username=test_user_data.get("username"),
        expertise_areas=[], # SQLite tests will fail if we try to write to this, we will rely on default or ignore since we just need the foreign key
    )
    db_session.add(user)
    try:
        await db_session.commit()
    except Exception:
        await db_session.rollback()
        pass # User might already exist in the test DB due to other tests, which is fine

    original_content = "This is a secret draft that I want to anchor securely."

    # Create anchor
    create_response = await client.post(
        "/api/v1/anchors/",
        json={
            "content": original_content,
            "label": "My Secret Draft"
        }
    )

    assert create_response.status_code == 200
    create_data = create_response.json()
    assert "id" in create_data

    anchor_id = create_data["id"]

    # Verify with matching content
    verify_match_response = await client.post(
        "/api/v1/anchors/verify",
        json={
            "anchor_id": anchor_id,
            "content": original_content
        }
    )

    assert verify_match_response.status_code == 200
    assert verify_match_response.json()["match"] is True

    # Verify with non-matching content
    verify_mismatch_response = await client.post(
        "/api/v1/anchors/verify",
        json={
            "anchor_id": anchor_id,
            "content": "This is some different content that should not match."
        }
    )

    assert verify_mismatch_response.status_code == 200
    assert verify_mismatch_response.json()["match"] is False

@pytest.mark.asyncio
async def test_list_anchors(client: AsyncClient, test_user_data, db_session):
    """Test listing anchors returns previously created anchors"""
    from app.models.database import User

    user_id = test_user_data.get("username", "testuser")
    user = User(
        id=user_id,
        email=test_user_data.get("email"),
        username=test_user_data.get("username"),
    )
    db_session.add(user)
    try:
        await db_session.commit()
    except Exception:
        await db_session.rollback()
        pass

    await client.post(
        "/api/v1/anchors/",
        json={
            "content": "Content for listing test",
            "label": "Listing Test Label"
        }
    )

    list_response = await client.get("/api/v1/anchors/")
    assert list_response.status_code == 200
    anchors = list_response.json()

    assert isinstance(anchors, list)
    assert len(anchors) >= 1
    assert any(a["label"] == "Listing Test Label" for a in anchors)
