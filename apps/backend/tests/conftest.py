import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from main import app
from app.db.session import Base, get_db


import os

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Replace JSONB with JSON for SQLite tests
if os.environ.get("TESTING") == "1":
    from sqlalchemy.dialects.sqlite import JSON
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.compiler import compiles

    @compiles(JSONB, "sqlite")
    def compile_jsonb_sqlite(type_, compiler, **kw):
        return "JSON"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@pytest_asyncio.fixture
async def db_session():
    """Create a fresh database for each test"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session):
    """Create test client with database override"""
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Test user data"""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123"
    }


@pytest.fixture
def test_paper_data():
    """Test paper data"""
    return {
        "id": "W1234567890",
        "title": "Test Paper on Machine Learning",
        "year": 2023,
        "citations": 100,
        "abstract": "This is a test abstract about machine learning applications.",
        "authors": ["John Doe", "Jane Smith"]
    }

import os
from sqlalchemy.dialects.postgresql import JSONB

if os.environ.get("TESTING") == "1":
    from sqlalchemy.ext.compiler import compiles
    @compiles(JSONB, "sqlite")
    def compile_jsonb_sqlite(type_, compiler, **kw):
        return "JSON"
