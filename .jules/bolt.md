## 2024-05-24 - N+1 Counts in Loops
**Learning:** Using `len(result.scalars().all())` inside a loop leads to N+1 queries, fetching whole tables just to calculate the count.
**Action:** Replace nested loops fetching lengths with `scalar_subquery()` or explicitly joined `func.count()` fields to resolve N+1.
