## 2025-02-14 - N+1 Queries and Inefficient Memory Counting
**Learning:** Using `len(result.scalars().all())` inside a loop leads to N+1 queries and inefficiently loads all records into memory.
**Action:** Use `.scalar_subquery()` with `.correlate()` to attach counts to the main query to avoid N+1 queries, and use explicit aggregation `select(func.count()).select_from(...)` via `.scalar()` to do simple counts without loading models.
