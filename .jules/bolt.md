## 2026-06-28 - Optimize SQLAlchemy Count and N+1 Queries
**Learning:** Calculating record counts using `len(result.scalars().all())` leads to N+1 queries in loops. The backend AsyncSession implementation does not support concurrent parallel queries on the same connection, so we should batch them using `scalar_subquery()` and `.correlate()` within a single statement.
**Action:** Always use `select(func.count())` and `scalar_subquery()` for fetching associated counts instead of fetching all records in loops.
