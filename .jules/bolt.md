## 2025-02-18 - Optimize Submission Count Query
**Learning:** In loop constructs pulling related count data using `len(result.scalars().all())` initiates catastrophic N+1 query patterns, driving significant DB roundtrips.
**Action:** Replace looped secondary queries with a single query utilizing `func.count()`, `.scalar_subquery()`, and `.correlate(MainModel)` paired with `.label()` on the primary SELECT statement.
