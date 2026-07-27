import asyncio
import time
import uuid

from app.models.database import Base, InstitutionalSandbox, SandboxMember, User
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import aliased, sessionmaker


@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return 'JSON'

engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        user_id = "test_user_id"
        u = User(id=user_id, email="test@example.com")
        db.add(u)
        # Create 50 sandboxes
        for i in range(50):
            sb_id = str(uuid.uuid4())
            sb = InstitutionalSandbox(
                id=sb_id,
                name=f"Sandbox {i}",
                institution="Test Inst",
                invite_code=f"CODE{i}",
                admin_user_id=user_id,
                is_public=False
            )
            db.add(sb)

            # The test user is a member
            db.add(SandboxMember(sandbox_id=sb.id, user_id=user_id, role="admin"))

            # Add some other members
            for j in range(10):
                m = SandboxMember(sandbox_id=sb.id, user_id=f"other_{j}", role="participant")
                db.add(m)
        await db.commit()
    return "test_user_id"

async def run_original(user_id):
    async with async_session() as db:
        start = time.perf_counter()

        result = await db.execute(
            select(SandboxMember).where(SandboxMember.user_id == user_id)
        )
        memberships = result.scalars().all()

        out = []
        for m in memberships:
            sb_result = await db.execute(
                select(InstitutionalSandbox).where(InstitutionalSandbox.id == m.sandbox_id)
            )
            sb = sb_result.scalar_one_or_none()
            if not sb:
                continue
            count_result = await db.execute(
                select(SandboxMember).where(SandboxMember.sandbox_id == sb.id)
            )
            count = len(count_result.scalars().all())
            out.append((sb, count))

        duration = time.perf_counter() - start
        return duration, len(out)

async def run_optimized(user_id):
    async with async_session() as db:
        start = time.perf_counter()

        member_alias = aliased(SandboxMember)
        count_subq = (
            select(func.count(member_alias.id))
            .where(member_alias.sandbox_id == InstitutionalSandbox.id)
            .correlate(InstitutionalSandbox)
            .scalar_subquery()
        )

        # Join SandboxMember and InstitutionalSandbox to avoid N+1 queries
        result = await db.execute(
            select(InstitutionalSandbox, count_subq)
            .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
            .where(SandboxMember.user_id == user_id)
        )
        sandboxes = result.all()

        out = []
        for sb, count in sandboxes:
            out.append((sb, count))

        duration = time.perf_counter() - start
        return duration, len(out)

async def main():
    user_id = await setup_db()
    orig_time, orig_len = await run_original(user_id)
    opt_time, opt_len = await run_optimized(user_id)
    print(f"Original: {orig_time:.4f}s (len {orig_len})")
    print(f"Optimized: {opt_time:.4f}s (len {opt_len})")
    print(f"Improvement: {(orig_time - opt_time) / orig_time * 100:.2f}%")

if __name__ == "__main__":
    asyncio.run(main())
