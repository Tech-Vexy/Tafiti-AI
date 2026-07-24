## 2024-05-24 - Optimize len() queries and N+1 loops in SQLAlchemy
**Learning:** A known performance anti-pattern in the backend codebase is calculating record counts using `len(result.scalars().all())`. For loops, this leads to N+1 queries.
**Action:** Optimized using `func.count()`, `.scalar_subquery()`, and explicitly appending `.correlate(MainModel)` to prevent auto-correlation issues. For singular counts, replaced with explicit aggregation using `.scalar()`.
