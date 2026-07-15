## 2025-02-15 - [Anti-Pattern] Inefficient Record Counting

**Learning:** Calculating record counts using `len(result.scalars().all())` is an anti-pattern that can lead to N+1 queries when looping, and pulls unnecessarily large sets of objects into memory.
**Action:** Use `.scalar_subquery()`, explicitly aggregating with `func.count()`, and `.correlate()` to prevent auto-correlation issues for batched counting. For singular counts, use explicit aggregation `select(func.count()).select_from(...)` via `.scalar()`.
