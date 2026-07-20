## 2025-02-09 - N+1 len(scalars()) counts
**Learning:** Using `len(result.scalars().all())` inside a loop leads to N+1 queries and unnecessary memory allocation by resolving ORM models. It should be optimized using `func.count()`, `.scalar_subquery()`, and explicitly appending `.correlate(MainModel)` to prevent SQLAlchemy auto-correlation issues.
**Action:** For loops, batch queries using `.scalar_subquery()`. For singular queries, replace with explicit aggregation using `select(func.count()).select_from(...)` via `.scalar()`.
