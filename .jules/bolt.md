## 2024-07-06 - Optimize SQLAlchemy count in APIs
**Learning:** Calculating record counts using `len(result.scalars().all())` loads all rows into memory and causes N+1 queries when executed inside loops. For batching, `scalar_subquery()` should be used.
**Action:** Use `func.count()` with `scalar_subquery()` and explicitly append `.correlate()` to prevent auto-correlation issues for batched operations. For singular counts, use `.scalar(select(func.count()).select_from(...))`.
