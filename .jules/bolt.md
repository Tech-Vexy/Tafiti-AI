## 2026-07-11 - Optimize N+1 and scalar count queries
**Learning:** Using `len(result.scalars().all())` is a performance anti-pattern. In loops, it causes N+1 queries. Even outside of loops, it loads full rows just to get a count, using extra memory.
**Action:** For loops, use `.scalar_subquery()` and explicitly correlate with `func.count()`. For singular counts, use explicit aggregation `select(func.count()).select_from(...)` via `.scalar()`.
