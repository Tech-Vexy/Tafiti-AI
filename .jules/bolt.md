## 2024-07-27 - N+1 query problem with len(result.scalars().all())
**Learning:** Found multiple instances where the codebase computes count by loading all rows into memory and calling `len()` inside a loop, resulting in a severe N+1 query bottleneck.
**Action:** Replace `len(result.scalars().all())` loops with `.scalar_subquery()` correctly correlated, or just use `func.count()`. Join the relevant tables if multiple tables are queried in sequence to fetch related counts.
