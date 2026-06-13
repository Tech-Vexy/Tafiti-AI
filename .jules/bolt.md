## 2024-05-15 - N+1 query patterns in backend
**Learning:** Found several instances of N+1 queries in the FastAPI backend (e.g. `apps/backend/app/api/sandboxes.py` `list_sandboxes` and `apps/backend/app/api/bounties.py` `list_bounties`) fetching counts using `len(count_result.scalars().all())` inside a for loop.
**Action:** Replace len(scalars().all()) inside loops with scalar subqueries using `func.count()` integrated into the primary select statement to optimize database performance and solve N+1.
