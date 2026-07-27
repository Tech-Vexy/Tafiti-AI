## 2024-05-18 - Avoid Memory Bloat and N+1 Queries with SQLAlchemy `scalar_subquery`
**Learning:** Calculating record counts using `len(result.scalars().all())` inside loops leads to N+1 database queries and significant memory bloat, as it fetches all related records into memory just to count them.
**Action:** When counting related records alongside a list fetch, batch the queries using `scalar_subquery()` combined with `func.count()`. For individual count queries, use `select(func.count())` and fetch the integer using `scalar_one()` instead of loading the object scalar list.
## 2026-06-19 - N+1 Memory Bloat Anti-Pattern using `len(result.scalars().all())`
**Learning:** Found a critical and recurring performance anti-pattern in the backend API layer (`sandboxes.py` and `bounties.py`). When fetching lists of entities (like sandboxes or bounties), the application was executing N+1 queries by looping over results and doing a `select()` for related child items (like members or submissions). Even worse, it was loading all the child records into memory with `.all()` and calling Python's `len()` just to get a count, instead of doing an efficient SQL `COUNT`. This causes huge unnecessary memory pressure and drastically slower request times, particularly for entities with many children.

**Action:** Whenever counting related records in a list API response, use `scalar_subquery()` with `func.count()` built directly into the main `select()` statement to fetch everything in a single, DB-optimized roundtrip without loading full objects into application memory.
## 2024-05-24 - Avoid `len(result.scalars().all())` for database counts
**Learning:** A common performance anti-pattern was found where row counts were being calculated in memory by loading all entities and calling `len(result.scalars().all())`. Inside a loop, this causes severe N+1 query and memory issues.
**Action:** Replace `len(result.scalars().all())` with an explicit `func.count()` query. When counting related entities in a list API response, use a `scalar_subquery()` correlated to the parent entity to fetch counts in a single batched query alongside the parent objects.
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
