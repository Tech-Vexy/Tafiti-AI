## 2024-05-24 - Avoid len(result.scalars().all()) for counting

**Learning:** Found an anti-pattern in `apps/backend/app/api/sandboxes.py` and `apps/backend/app/api/bounties.py` where counting rows was done by fetching all rows into memory and calling `len()` inside loops, leading to severe N+1 queries and memory bloat. SQLAlchemy `AsyncSession` doesn't support concurrent `asyncio.gather()`, which makes sequential loops even slower.

**Action:** Whenever counting related records within a list query, always use a `scalar_subquery` with `func.count()`. For individual counts, use `select(func.count(Model.id))` rather than fetching objects.
