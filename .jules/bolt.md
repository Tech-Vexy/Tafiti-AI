## 2025-01-20 - Optimize N+1 queries using scalar subqueries
**Learning:** Discovered N+1 queries and memory-inefficient record counts using `len(result.scalars().all())` inside loops in list_my_sandboxes and list_bounties. This architecture anti-pattern causes performance degradation on larger datasets.
**Action:** Replaced iterative `.all()` calls inside loops with `func.count()` as a `.scalar_subquery()` correlated to the main model, resolving the N+1 issue and reducing memory footprint.
