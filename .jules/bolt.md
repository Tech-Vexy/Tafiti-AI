## 2024-07-23 - Avoid len(result.scalars().all()) for counting

**Learning:** Using `len(result.scalars().all())` inside a loop in SQLAlchemy leads to an N+1 query problem, fetching all objects just to count them. This is an anti-pattern that significantly degrades performance.
**Action:** Always replace `len(result.scalars().all())` with explicit counting. Inside loops, use `func.count()`, `.scalar_subquery()`, and explicit `.correlate()` to batch counts in the primary query. For singular queries, use `select(func.count()).select_from(...)` and `.scalar()`.
