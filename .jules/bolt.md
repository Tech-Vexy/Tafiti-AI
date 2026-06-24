## $(date +%Y-%m-%d) - Optimize SQLAlchemy Count Queries

**Learning:** Calculating record counts using `len(result.scalars().all())` is an anti-pattern because it retrieves all records from the database into memory and leads to N+1 queries when used inside loops.
**Action:** Replace `len(result.scalars().all())` with `select(func.count())` and `.scalar_one()` for single queries. For loops, consider using `scalar_subquery()` or at least updating the inner loop queries to be `select(func.count(...)).scalar_one()` to avoid loading all objects into memory.
