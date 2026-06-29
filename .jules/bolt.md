## 2024-07-29 - N+1 Query in Counting related records
**Learning:** Found an N+1 query problem using a loop to count sub-records: `len(result.scalars().all())` which triggers one SQL query per iteration. This applies to Sandbox and Bounty APIs where counts of related items are appended to each record in a loop.
**Action:** Replace `len(sub_count_res.scalars().all())` with an aggregate subquery using `select(func.count()).where(...)` or batched requests, to fetch the count directly from the database without loading all models into memory.
