import asyncio
import time
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

# Mock JSONB to JSON for SQLite
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, desc
from app.db.session import Base
from app.models.database import Bounty, BountySubmission, User
from app.api.bounties import BountyResponse
import uuid
from datetime import datetime

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        # Create users to avoid foreign key issues if sqlite enforces them
        u1 = User(id="user_123", email="user123@example.com", username="user123")
        u2 = User(id="user_456", email="user456@example.com", username="user456")
        session.add_all([u1, u2])
        await session.commit()

        # Create 100 Bounties
        bounties = []
        for i in range(100):
            b = Bounty(
                id=str(uuid.uuid4()),
                creator_id="user_123",
                description=f"Bounty {i} description, extremely long to pass validation rules"*5,
                amount_kes=1000,
                reputation_points=10,
                status="open",
                funded=True,
                expires_at=datetime.utcnow(),
            )
            bounties.append(b)
        session.add_all(bounties)
        await session.commit()

        # Create 20 Submissions per Bounty
        submissions = []
        for b in bounties:
            for j in range(20):
                sub = BountySubmission(
                    id=str(uuid.uuid4()),
                    bounty_id=b.id,
                    submitter_id="user_456",
                    review_text=f"Review {j} for bounty {b.id}, needs to be long enough to pass length validation rules"*5
                )
                submissions.append(sub)
        session.add_all(submissions)
        await session.commit()

from sqlalchemy import func

async def benchmark_new_way():
    async with SessionLocal() as db:
        start_time = time.time()

        status = "open"
        limit = 100

        subq = (
            select(func.count(BountySubmission.id))
            .where(BountySubmission.bounty_id == Bounty.id)
            .correlate(Bounty)
            .scalar_subquery()
        )
        result = await db.execute(
            select(Bounty, subq.label("submission_count"))
            .where(Bounty.status == status, Bounty.funded == True)
            .order_by(desc(Bounty.created_at))
            .limit(limit)
        )
        rows = result.all()
        out = []
        for b, count in rows:
            out.append(BountyResponse(**b.__dict__, submission_count=count))

        end_time = time.time()
        print(f"New approach took: {end_time - start_time:.4f} seconds")
        return end_time - start_time


async def main():
    await setup_db()
    # Run multiple times to warm up and get an average
    times = []
    for _ in range(5):
        t = await benchmark_new_way()
        times.append(t)
    print(f"Average: {sum(times)/len(times):.4f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
