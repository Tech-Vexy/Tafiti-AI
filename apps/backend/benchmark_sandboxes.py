import asyncio
import time
import uuid
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.orm import declarative_base, joinedload

# Handle SQLite JSONB alias issue for memory tests
import sqlalchemy.ext.compiler
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON

@sqlalchemy.ext.compiler.compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.models.database import Base, InstitutionalSandbox, SandboxMember, User

# Use an in-memory SQLite database for benchmarking
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    echo=False,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def setup_test_data(db: AsyncSession, num_members: int = 50) -> str:
    # Create an admin user
    admin = User(
        id=str(uuid.uuid4()),
        username=f"admin_{uuid.uuid4().hex[:8]}",
        email=f"admin_{uuid.uuid4().hex[:8]}@example.com"
    )
    db.add(admin)

    # Create a sandbox
    sandbox = InstitutionalSandbox(
        id=str(uuid.uuid4()),
        name="Test Benchmark Sandbox",
        institution="Benchmark University",
        invite_code=uuid.uuid4().hex[:8],
        admin_user_id=admin.id
    )
    db.add(sandbox)

    # Add admin as member
    db.add(SandboxMember(sandbox_id=sandbox.id, user_id=admin.id, role="admin"))

    # Create members
    for i in range(num_members):
        user = User(
            id=str(uuid.uuid4()),
            username=f"user_{uuid.uuid4().hex[:8]}",
            email=f"user_{uuid.uuid4().hex[:8]}@example.com"
        )
        db.add(user)
        member = SandboxMember(sandbox_id=sandbox.id, user_id=user.id, role="participant")
        db.add(member)

    await db.commit()
    return sandbox.id

async def fetch_members_unoptimized(db: AsyncSession, sandbox_id: str):
    # Mimic the unoptimized route logic
    result = await db.execute(
        select(SandboxMember).where(SandboxMember.sandbox_id == sandbox_id)
    )
    members = result.scalars().all()

    out = []
    for m in members:
        user_result = await db.execute(select(User).where(User.id == m.user_id))
        user = user_result.scalar_one_or_none()
        out.append({
            "user_id": m.user_id,
            "username": user.username if user else None,
            "role": m.role
        })
    return out

async def fetch_members_optimized(db: AsyncSession, sandbox_id: str):
    # Optimized route logic
    result = await db.execute(
        select(SandboxMember)
        .options(joinedload(SandboxMember.user))
        .where(SandboxMember.sandbox_id == sandbox_id)
    )
    members = result.scalars().all()

    out = []
    for m in members:
        user = m.user
        out.append({
            "user_id": m.user_id,
            "username": user.username if user else None,
            "role": m.role
        })
    return out

async def main():
    async with AsyncSessionLocal() as db:
        # Create tables (SQLite in-memory or actual DB)
        await init_db()

        print("Setting up test data...")
        sandbox_id = await setup_test_data(db, num_members=50)

        print(f"Running benchmark for sandbox {sandbox_id}...")

        # Warmup
        await fetch_members_unoptimized(db, sandbox_id)
        await fetch_members_optimized(db, sandbox_id)

        # Benchmark
        num_runs = 10
        start_time = time.time()
        for _ in range(num_runs):
            await fetch_members_unoptimized(db, sandbox_id)
        end_time = time.time()

        unoptimized_time = (end_time - start_time) / num_runs
        print(f"Average time (Unoptimized): {unoptimized_time:.4f} seconds per run")

        # Benchmark Optimized
        start_time = time.time()
        for _ in range(num_runs):
            await fetch_members_optimized(db, sandbox_id)
        end_time = time.time()

        optimized_time = (end_time - start_time) / num_runs
        print(f"Average time (Optimized): {optimized_time:.4f} seconds per run")
        print(f"Improvement: {(unoptimized_time - optimized_time) / unoptimized_time * 100:.2f}%")

if __name__ == "__main__":
    asyncio.run(main())
