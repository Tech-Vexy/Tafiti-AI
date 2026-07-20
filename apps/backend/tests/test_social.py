import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from main import app
from app.models.database import User, Connection, Notification
from app.core.security import get_current_user

# Test users data
user1_data = {
    "id": "user1_id",
    "username": "user1",
    "email": "user1@example.com"
}

user2_data = {
    "id": "user2_id",
    "username": "user2",
    "email": "user2@example.com"
}

import pytest_asyncio

@pytest_asyncio.fixture
async def setup_users(db_session: AsyncSession):
    # Insert test users into the database
    user1 = User(**user1_data)
    user2 = User(**user2_data)
    db_session.add(user1)
    db_session.add(user2)
    await db_session.commit()
    return user1_data, user2_data

@pytest.fixture
def override_current_user():
    def _override():
        return {"user_id": user1_data["id"], "email": user1_data["email"]}

    app.dependency_overrides[get_current_user] = _override
    yield
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_connect_to_user_happy_path(
    client: AsyncClient,
    db_session: AsyncSession,
    setup_users,
    override_current_user
):
    _, user2_data = setup_users
    target_id = user2_data["id"]

    response = await client.post(f"/api/v1/social/connect/{target_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["follower_id"] == "user1_id"
    assert data["followed_id"] == target_id
    assert data["status"] == "accepted"

    # Verify in DB
    result = await db_session.execute(
        select(Connection).where(
            (Connection.follower_id == "user1_id") &
            (Connection.followed_id == target_id)
        )
    )
    connection = result.scalar_one_or_none()
    assert connection is not None
    assert connection.status == "accepted"

    # Verify notification created
    result = await db_session.execute(
        select(Notification).where(Notification.user_id == target_id)
    )
    notification = result.scalar_one_or_none()
    assert notification is not None
    assert notification.type == "connection_request"


@pytest.mark.asyncio
async def test_connect_to_self(
    client: AsyncClient,
    setup_users,
    override_current_user
):
    user1_data, _ = setup_users
    target_id = user1_data["id"]

    response = await client.post(f"/api/v1/social/connect/{target_id}")

    assert response.status_code == 400
    assert response.json()["detail"] == "You cannot connect to yourself"


@pytest.mark.asyncio
async def test_connect_duplicate(
    client: AsyncClient,
    db_session: AsyncSession,
    setup_users,
    override_current_user
):
    _, user2_data = setup_users
    target_id = user2_data["id"]

    # First connection
    response1 = await client.post(f"/api/v1/social/connect/{target_id}")
    assert response1.status_code == 200

    # Attempt duplicate connection
    response2 = await client.post(f"/api/v1/social/connect/{target_id}")
    assert response2.status_code == 200

    # Verify only one connection exists
    result = await db_session.execute(
        select(Connection).where(
            (Connection.follower_id == "user1_id") &
            (Connection.followed_id == target_id)
        )
    )
    connections = result.scalars().all()
    assert len(connections) == 1

    # Verify only one notification was sent
    result = await db_session.execute(
        select(Notification).where(Notification.user_id == target_id)
    )
    notifications = result.scalars().all()
    assert len(notifications) == 1
