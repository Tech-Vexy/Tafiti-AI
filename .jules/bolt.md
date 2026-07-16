## 2025-02-20 - N+1 Query Anti-Pattern in Backend (SQLAlchemy)
**Learning:** Calculating record counts by fetching all objects with `.scalars().all()` and calling `len()` causes severe N+1 queries in loops and unneeded memory usage.
**Action:** Use `func.count()` with `scalar_subquery()` and explicitly `.correlate()` it in SQLAlchemy queries. For single queries, just aggregate directly and `.scalar()`.
