## 2024-05-24 - Avoiding N+1 Memory Bloat in SQLAlchemy
**Learning:** A common performance anti-pattern in the backend codebase was calculating record counts by loading all entities into memory using `len(result.scalars().all())` within a loop. This results in heavy memory overhead (O(N)) and triggers N+1 query patterns.
**Action:** Always replace `len(result.scalars().all())` counting patterns with explicit aggregation using `select(func.count()).select_from(...)` via `.scalar()` to compute counts efficiently within the database engine (O(1) memory).
