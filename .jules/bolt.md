## 2024-05-18 - SQLAlchemy count performance
**Learning:** In SQLAlchemy, computing the count by retrieving all items using `len(result.scalars().all())` is an anti-pattern that leads to unnecessary memory usage and processing overhead, and often causes N+1 problems in loops.
**Action:** Always compute simple counts by running a query that returns the count (`select(func.count()).select_from(...)`) via `.scalar()`, and for batch queries, correlate the subquery explicitly.
