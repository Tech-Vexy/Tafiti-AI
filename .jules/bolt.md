## 2026-07-02 - N+1 Query Optimization
**Learning:** Using len(result.scalars().all()) inside loops creates N+1 queries.
**Action:** Use func.count() and correlated subqueries to batch count operations into a single query.
