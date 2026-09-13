"""
Shared Test Configuration
=========================
Provides fixtures for:
  - SQLite async database (in-memory, fresh per test)
  - FastAPI test client with DB override
  - Auth override (Clerk JWT mocked via dependency override)
  - Pre-seeded test users in the database
"""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

import sys
from unittest.mock import MagicMock

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["TESTING"] = "1"

# Mock vector_service before any module import (avoids loading sentence-transformers model)
_mock_vs = MagicMock()
_mock_vs.search_similar = MagicMock(return_value=[])
_mock_vs.add_query = MagicMock()
_mock_vs.delete_query = MagicMock()
sys.modules["app.services.vector_service"] = _mock_vs

from main import app  # noqa: E402
from app.db.session import Base, get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.models.database import User  # noqa: E402


# ---------------------------------------------------------------------------
# Test engine — SQLite in-memory, fresh per test session
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, future=True)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# ---------------------------------------------------------------------------
# Auth user data (matches get_current_user return shape)
# ---------------------------------------------------------------------------
DEFAULT_USER = {
    "user_id": "test-user-001",
    "username": "testuser",
    "email": "test@example.com",
}

SECOND_USER = {
    "user_id": "test-user-002",
    "username": "seconduser",
    "email": "second@example.com",
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(autouse=True)
async def _setup_database():
    """Create tables before each test, drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    """Provide a raw database session for direct DB assertions."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """HTTP test client with auth + DB dependency overrides."""
    async def _auth_override():
        return DEFAULT_USER.copy()

    async def _db_override():
        yield db_session

    app.dependency_overrides[get_current_user] = _auth_override
    app.dependency_overrides[get_db] = _db_override

    # Ensure app.state has the shared http client (normally set by lifespan)
    import httpx
    if not hasattr(app.state, "http_client") or app.state.http_client is None:
        app.state.http_client = httpx.AsyncClient(timeout=httpx.Timeout(15.0))
        _owns_http_client = True
    else:
        _owns_http_client = False

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    if _owns_http_client:
        await app.state.http_client.aclose()
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_second_user(db_session: AsyncSession):
    """HTTP test client authenticated as the second user."""
    async def _auth_override():
        return SECOND_USER.copy()

    async def _db_override():
        yield db_session

    app.dependency_overrides[get_current_user] = _auth_override
    app.dependency_overrides[get_db] = _db_override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_user(db_session: AsyncSession):
    """Insert the default test user into the database and return it."""
    user = User(
        id=DEFAULT_USER["user_id"],
        username=DEFAULT_USER["username"],
        email=DEFAULT_USER["email"],
        expertise_areas=[],
        subscription_status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def seeded_second_user(db_session: AsyncSession):
    """Insert the second test user into the database."""
    user = User(
        id=SECOND_USER["user_id"],
        username=SECOND_USER["username"],
        email=SECOND_USER["email"],
        expertise_areas=[],
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def paper_data():
    """Minimal paper dict matching PaperBase schema."""
    return {
        "id": "W1234567890",
        "title": "Test Paper on Machine Learning",
        "year": 2023,
        "citations": 100,
        "abstract": "This is a test abstract about machine learning.",
        "authors": ["John Doe", "Jane Smith"],
    }


@pytest.fixture
def paper_data_2():
    """Second paper for multi-paper tests."""
    return {
        "id": "W9876543210",
        "title": "Deep Learning in Healthcare",
        "year": 2024,
        "citations": 50,
        "abstract": "An overview of deep learning applications in healthcare.",
        "authors": ["Alice Johnson"],
    }
