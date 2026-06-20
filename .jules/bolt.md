## 2024-05-18 - Avoid Memory Bloat and N+1 Queries with SQLAlchemy `scalar_subquery`
**Learning:** Calculating record counts using `len(result.scalars().all())` inside loops leads to N+1 database queries and significant memory bloat, as it fetches all related records into memory just to count them.
**Action:** When counting related records alongside a list fetch, batch the queries using `scalar_subquery()` combined with `func.count()`. For individual count queries, use `select(func.count())` and fetch the integer using `scalar_one()` instead of loading the object scalar list.
