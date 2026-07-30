import asyncio
import time
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, desc, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
import uuid

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return 'JSON'

# We need to import models
from app.models.database import Base, Bounty, BountySubmission

engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Create 50 bounties
        for i in range(50):
            b = Bounty(
                id=str(uuid.uuid4()),
                creator_id=str(uuid.uuid4()),
                description=f"Bounty {i}",
                amount_kes=100,
                reputation_points=10,
                status="open",
                funded=True,
            )
            session.add(b)
            # Create 10 submissions per bounty
            for j in range(10):
                sub = BountySubmission(
                    id=str(uuid.uuid4()),
                    bounty_id=b.id,
                    submitter_id=str(uuid.uuid4()),
                    review_text=f"Review {j}",
                )
                session.add(sub)
        await session.commit()

async def benchmark_old():
    async with AsyncSessionLocal() as db:
        start = time.perf_counter()

        result = await db.execute(
            select(Bounty)
            .where(Bounty.status == "open", Bounty.funded == True)
            .order_by(desc(Bounty.created_at))
            .limit(50)
        )
        bounties = result.scalars().all()
        out = []
        for b in bounties:
            sub_count_res = await db.execute(
                select(BountySubmission).where(BountySubmission.bounty_id == b.id)
            )
            count = len(sub_count_res.scalars().all())
            out.append({"id": b.id, "count": count})

        end = time.perf_counter()
        return end - start

async def benchmark_new():
    async with AsyncSessionLocal() as db:
        start = time.perf_counter()

        subquery = (
            select(func.count())
            .select_from(BountySubmission)
            .where(BountySubmission.bounty_id == Bounty.id)
            .correlate(Bounty)
            .scalar_subquery()
        )

        result = await db.execute(
            select(Bounty, subquery.label("submission_count"))
            .where(Bounty.status == "open", Bounty.funded == True)
            .order_by(desc(Bounty.created_at))
            .limit(50)
        )
        rows = result.all()
        out = []
        for b, count in rows:
            out.append({"id": b.id, "count": count})

        end = time.perf_counter()
        return end - start

async def main():
    await setup_db()

    # Warmup
    await benchmark_old()
    await benchmark_new()

    # Measure
    old_times = []
    new_times = []

    for _ in range(5):
        old_times.append(await benchmark_old())
        new_times.append(await benchmark_new())

    old_avg = sum(old_times) / len(old_times)
    new_avg = sum(new_times) / len(new_times)

    print(f"Old (N+1 length): {old_avg:.4f}s")
    print(f"New (Subquery count): {new_avg:.4f}s")
    print(f"Speedup: {old_avg / new_avg:.2f}x")

if __name__ == "__main__":
    asyncio.run(main())
