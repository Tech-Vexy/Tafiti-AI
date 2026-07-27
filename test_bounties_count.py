import asyncio
import time
import uuid

from app.models.database import Base, Bounty, BountySubmission
from sqlalchemy import desc, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker


@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return 'JSON'

engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Create 100 bounties
        for i in range(100):
            b = Bounty(
                id=str(uuid.uuid4()),
                creator_id="user1",
                description=f"Desc {i}",
                amount_kes=100,
                reputation_points=10,
                status="open",
                funded=True,
            )
            db.add(b)
            # Add some submissions
            for j in range(5):
                s = BountySubmission(
                    id=str(uuid.uuid4()),
                    bounty_id=b.id,
                    submitter_id=f"user{j}",
                    review_text="Good paper"
                )
                db.add(s)
        await db.commit()

async def run_original():
    async with async_session() as db:
        start = time.perf_counter()

        result = await db.execute(
            select(Bounty)
            .where(Bounty.status == "open", Bounty.funded == True)
            .order_by(desc(Bounty.created_at))
            .limit(100)
        )
        bounties = result.scalars().all()
        out = []
        for b in bounties:
            sub_count_res = await db.execute(
                select(BountySubmission).where(BountySubmission.bounty_id == b.id)
            )
            count = len(sub_count_res.scalars().all())
            out.append((b, count))

        duration = time.perf_counter() - start
        return duration, len(out)

async def run_optimized():
    async with async_session() as db:
        start = time.perf_counter()

        sub_count_subq = (
            select(func.count(BountySubmission.id))
            .where(BountySubmission.bounty_id == Bounty.id)
            .correlate(Bounty)
            .scalar_subquery()
        )
        result = await db.execute(
            select(Bounty, sub_count_subq)
            .where(Bounty.status == "open", Bounty.funded == True)
            .order_by(desc(Bounty.created_at))
            .limit(100)
        )
        bounties_with_counts = result.all()

        out = []
        for b, count in bounties_with_counts:
            out.append((b, count))

        duration = time.perf_counter() - start
        return duration, len(out)

async def main():
    await setup_db()
    orig_time, orig_len = await run_original()
    opt_time, opt_len = await run_optimized()
    print(f"Original: {orig_time:.4f}s (len {orig_len})")
    print(f"Optimized: {opt_time:.4f}s (len {opt_len})")
    print(f"Improvement: {(orig_time - opt_time) / orig_time * 100:.2f}%")

if __name__ == "__main__":
    asyncio.run(main())
