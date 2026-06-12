## 2024-06-11 - Parallelize DB Queries in User Profile
**Learning:** The `/me` endpoint performed four separate, sequential database queries to calculate user metrics, adding unnecessary latency to a high-traffic route. Although `asyncio.gather()` is useful for concurrent IO, `AsyncSession` in SQLAlchemy does not support parallel queries on the same session/connection.
**Action:** Used `scalar_subquery()` inside a single SQLAlchemy `select` statement to batch independent count/sum queries, effectively reducing the sequence of database calls to a single network round-trip.
