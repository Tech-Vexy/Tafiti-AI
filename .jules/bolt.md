## 2024-05-24 - Avoid len(result.scalars().all()) for counting

**Learning:** Found an anti-pattern in `apps/backend/app/api/sandboxes.py` and `apps/backend/app/api/bounties.py` where counting rows was done by fetching all rows into memory and calling `len()` inside loops, leading to severe N+1 queries and memory bloat. SQLAlchemy `AsyncSession` doesn't support concurrent `asyncio.gather()`, which makes sequential loops even slower.

**Action:** Whenever counting related records within a list query, always use a `scalar_subquery` with `func.count()`. For individual counts, use `select(func.count(Model.id))` rather than fetching objects.
## 2026-06-14 - Batching Sequential Queries in SQLAlchemy AsyncSession
**Learning:** The backend's SQLAlchemy `AsyncSession` implementation does not support concurrent parallel queries on the same connection (e.g., using `asyncio.gather()`). When trying to perform multiple aggregations (like counts and sums) for a single entity, making sequential `await db.scalar(...)` calls introduces unnecessary latency (N+1-like issue).
**Action:** To optimize sequential queries, batch them using `scalar_subquery()` within a single `select` statement. This reduces network roundtrips to the database from N to 1 while respecting the connection constraints of `AsyncSession`.
## 2024-05-15 - N+1 query patterns in backend
**Learning:** Found several instances of N+1 queries in the FastAPI backend (e.g. `apps/backend/app/api/sandboxes.py` `list_sandboxes` and `apps/backend/app/api/bounties.py` `list_bounties`) fetching counts using `len(count_result.scalars().all())` inside a for loop.
**Action:** Replace len(scalars().all()) inside loops with scalar subqueries using `func.count()` integrated into the primary select statement to optimize database performance and solve N+1.
## 2024-06-25 - Batching sequential queries over SQLAlchemy AsyncSession

**Learning:** The backend's SQLAlchemy `AsyncSession` implementation does not support parallel concurrent queries on the same database connection (e.g., using `asyncio.gather()`). A common anti-pattern was firing sequential `await db.execute` and `await db.scalar` queries for a single API endpoint to compute various metrics or fetch related items, adding significant overhead due to multiple network round trips.

**Action:** When calculating multiple aggregates or running several independent, fast queries on the same connection, batch them together using `scalar_subquery()` inside a single `select()` statement to reduce database round trips and improve API endpoint latency.
## 2024-06-11 - Parallelize DB Queries in User Profile
**Learning:** The `/me` endpoint performed four separate, sequential database queries to calculate user metrics, adding unnecessary latency to a high-traffic route. Although `asyncio.gather()` is useful for concurrent IO, `AsyncSession` in SQLAlchemy does not support parallel queries on the same session/connection.
**Action:** Used `scalar_subquery()` inside a single SQLAlchemy `select` statement to batch independent count/sum queries, effectively reducing the sequence of database calls to a single network round-trip.
