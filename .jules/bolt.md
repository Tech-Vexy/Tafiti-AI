## 2024-06-25 - Batching sequential queries over SQLAlchemy AsyncSession

**Learning:** The backend's SQLAlchemy `AsyncSession` implementation does not support parallel concurrent queries on the same database connection (e.g., using `asyncio.gather()`). A common anti-pattern was firing sequential `await db.execute` and `await db.scalar` queries for a single API endpoint to compute various metrics or fetch related items, adding significant overhead due to multiple network round trips.

**Action:** When calculating multiple aggregates or running several independent, fast queries on the same connection, batch them together using `scalar_subquery()` inside a single `select()` statement to reduce database round trips and improve API endpoint latency.
