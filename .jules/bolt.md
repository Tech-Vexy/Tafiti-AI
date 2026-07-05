## 2024-05-24 - N+1 Query Antipattern identified
**Learning:** The backend codebase has a recurring performance antipattern where record counts are calculated by fetching all records into memory using `len(result.scalars().all())`. Inside loops, this creates N+1 database queries.
**Action:** This should be replaced with explicit aggregation using `.scalar_subquery()` mapped onto the main query or via `.scalar()` with `func.count()`. When selecting `func.count()`, make sure to properly `.correlate()` subqueries to prevent SQLAlchemy auto-correlation issues.
