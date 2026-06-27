## 2026-06-27 - Backend N+1 Subquery Optimization
**Learning:** Calculating associated record counts in SQLAlchemy using `len(result.scalars().all())` within loops causes severe N+1 query performance degradation.
**Action:** When calculating record counts alongside main records, always use `func.count()`, `.scalar_subquery()`, and `.correlate(MainModel)` as a column in the main `select()` statement to fetch everything in a single, batched query. For singular records, use `db.scalar(select(func.count()).select_from(...))`.
