## 2024-05-24 - Avoid `len(result.scalars().all())` for database counts
**Learning:** A common performance anti-pattern was found where row counts were being calculated in memory by loading all entities and calling `len(result.scalars().all())`. Inside a loop, this causes severe N+1 query and memory issues.
**Action:** Replace `len(result.scalars().all())` with an explicit `func.count()` query. When counting related entities in a list API response, use a `scalar_subquery()` correlated to the parent entity to fetch counts in a single batched query alongside the parent objects.
