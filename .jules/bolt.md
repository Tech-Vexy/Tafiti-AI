## 2026-07-22 - Optimizing SQLAlchemy List Count Fetches

**Learning:** When generating counts for nested relationships in lists (like submission counts for bounties or member counts for sandboxes), relying on loop-based sub-queries via `len(result.scalars().all())` results in classic N+1 bottlenecks.

**Action:** Replace looped `len()` calls with a single integrated query by using SQLAlchemy's `scalar_subquery()` and `.correlate(MainModel)` within the main `select()` statement to bundle the aggregation correctly and dramatically reduce database response time (measured ~90% decrease in execution time in benchmarks).
## 2025-07-21 - Optimize record counts in loops using scalar_subquery
**Learning:** Found instances of N+1 query performance anti-patterns by calculating `len(result.scalars().all())` within a loop, querying child records for parent records returned sequentially. This causes heavy DB load because it pulls entire model objects from the DB instead of executing a count on DB side, and it does so repetitively.
**Action:** Replace `len(result.scalars().all())` inside a loop with a count optimized directly via `.scalar_subquery()` or explicitly querying counts, avoiding full row hydration and reducing DB roundtrips.
## 2024-06-25 - Fix N+1 Query Using Correlated Scalar Subquery
**Learning:** Using a `for` loop to fetch a count for each returned record results in N+1 queries, creating a severe performance bottleneck. In `apps/backend/app/api/bounties.py:list_bounties`, looping over all bounties and querying `BountySubmission` sequentially caused significant database round trips. A scalar subquery with explicit correlation enables calculating the count directly inside the database efficiently.
**Action:** Always prefer computing counts at the database level when listing records. Use `select(func.count(RelatedModel.id)).where(...).correlate(BaseModel).scalar_subquery()` and label it inside the primary `select(...)`.
## 2025-02-09 - N+1 len(scalars()) counts
**Learning:** Using `len(result.scalars().all())` inside a loop leads to N+1 queries and unnecessary memory allocation by resolving ORM models. It should be optimized using `func.count()`, `.scalar_subquery()`, and explicitly appending `.correlate(MainModel)` to prevent SQLAlchemy auto-correlation issues.
**Action:** For loops, batch queries using `.scalar_subquery()`. For singular queries, replace with explicit aggregation using `select(func.count()).select_from(...)` via `.scalar()`.
## 2024-05-24 - SQLAlchemy Correlated Subquery Optimization

**Learning:** When addressing N+1 query problems in SQLAlchemy where a parent entity needs a count of its children (e.g. `Bounty` -> `BountySubmissions`), using a correlated scalar subquery (`select(func.count()).correlate(Parent).scalar_subquery()`) is significantly faster than using `.scalars().all()` and calling `len()` in python. It keeps the aggregation purely in the database layer.

**Action:** Whenever retrieving lists of objects that include a "count" field mapped to a relationship, check for manual `len()` calls in loops. Replace these with explicit `func.count()` subqueries attached to the main select using `.label("count_field")`.
## 2024-05-24 - N+1 Counts in Loops
**Learning:** Using `len(result.scalars().all())` inside a loop leads to N+1 queries, fetching whole tables just to calculate the count.
**Action:** Replace nested loops fetching lengths with `scalar_subquery()` or explicitly joined `func.count()` fields to resolve N+1.
## 2025-02-18 - Optimize Submission Count Query
**Learning:** In loop constructs pulling related count data using `len(result.scalars().all())` initiates catastrophic N+1 query patterns, driving significant DB roundtrips.
**Action:** Replace looped secondary queries with a single query utilizing `func.count()`, `.scalar_subquery()`, and `.correlate(MainModel)` paired with `.label()` on the primary SELECT statement.
## 2025-02-18 - [Optimize N+1 Query in Sandbox Members Route]
**Learning:** In the `get_members` route in `sandboxes.py`, iterating over `SandboxMember` results to fetch `User` objects one by one causes a severe N+1 query issue, increasing execution time proportionally with member count.
**Action:** Always use SQLAlchemy's `joinedload` (or similar eager loading options like `selectinload` for collections) when returning a collection of objects that need their relationships loaded. This reduces multiple individual DB requests to a single combined request via a JOIN, improving performance drastically (e.g., from 0.0715s to 0.0038s, an ~94% improvement on 50 members).
## 2025-02-20 - N+1 Query Anti-Pattern in Backend (SQLAlchemy)
**Learning:** Calculating record counts by fetching all objects with `.scalars().all()` and calling `len()` causes severe N+1 queries in loops and unneeded memory usage.
**Action:** Use `func.count()` with `scalar_subquery()` and explicitly `.correlate()` it in SQLAlchemy queries. For single queries, just aggregate directly and `.scalar()`.
## 2025-02-15 - [Anti-Pattern] Inefficient Record Counting

**Learning:** Calculating record counts using `len(result.scalars().all())` is an anti-pattern that can lead to N+1 queries when looping, and pulls unnecessarily large sets of objects into memory.
**Action:** Use `.scalar_subquery()`, explicitly aggregating with `func.count()`, and `.correlate()` to prevent auto-correlation issues for batched counting. For singular counts, use explicit aggregation `select(func.count()).select_from(...)` via `.scalar()`.
## 2024-05-18 - SQLAlchemy count performance
**Learning:** In SQLAlchemy, computing the count by retrieving all items using `len(result.scalars().all())` is an anti-pattern that leads to unnecessary memory usage and processing overhead, and often causes N+1 problems in loops.
**Action:** Always compute simple counts by running a query that returns the count (`select(func.count()).select_from(...)`) via `.scalar()`, and for batch queries, correlate the subquery explicitly.
## 2025-02-14 - N+1 Queries and Inefficient Memory Counting
**Learning:** Using `len(result.scalars().all())` inside a loop leads to N+1 queries and inefficiently loads all records into memory.
**Action:** Use `.scalar_subquery()` with `.correlate()` to attach counts to the main query to avoid N+1 queries, and use explicit aggregation `select(func.count()).select_from(...)` via `.scalar()` to do simple counts without loading models.
## 2024-07-12 - N+1 Queries and memory overhead due to `len(scalars().all())`

**Learning:** A common performance anti-pattern in this codebase is counting records by pulling all instances into memory using `len(result.scalars().all())`. Inside iterative endpoints (like `list_my_sandboxes` and `list_bounties`), this leads to N+1 queries. In addition, fetching full ORM objects just to count them adds unnecessary memory overhead. Note that SQLAlchemy 2.0 async sessions do not support concurrent parallel queries on the same connection, and using `scalar_subquery` on the same table can lead to auto-correlation issues if not handled with `aliased()` and explicit `.correlate()`.

**Action:** Replace `len(scalars().all())` loops with `scalar_subquery` and explicit aggregation using `func.count()`. For loops joining the same table (e.g., `SandboxMember` inside `InstitutionalSandbox` list), always use `aliased` for the subquery table and explicitly use `.correlate(MainModel)` to prevent auto-correlation issues.
## 2026-07-11 - Optimize N+1 and scalar count queries
**Learning:** Using `len(result.scalars().all())` is a performance anti-pattern. In loops, it causes N+1 queries. Even outside of loops, it loads full rows just to get a count, using extra memory.
**Action:** For loops, use `.scalar_subquery()` and explicitly correlate with `func.count()`. For singular counts, use explicit aggregation `select(func.count()).select_from(...)` via `.scalar()`.
## 2024-07-10 - SQLAlchemy Scalar All Anti-Pattern
**Learning:** Using `len(result.scalars().all())` is an anti-pattern when trying to fetch counts. In loops it leads to N+1 query performance problems, and even for simple queries it fetches the entire result set over the network only to compute the length. SQLAlchemy `AsyncSession` doesn't support concurrent queries easily, so queries must be batched or batched using subqueries.
**Action:** When computing counts inside a loop (like nested entities), use a `.scalar_subquery()` correlated with the main model in a single query. When getting a simple count, use `select(func.count()).select_from(...)` via `.scalar()`.
## 2024-05-14 - Fix N+1 issues and avoid len(all()) calls in SQLAlchemy
**Learning:** Found multiple instances where the app performs a separate db count via `len(result.scalars().all())` causing N+1 queries. We can eliminate the N+1 problem by utilizing `scalar_subquery()` and explicitly correlating it using `.correlate(MainModel)` which resolves autocorrelation issues when referencing multiple tables. For singular fetches, explicit aggregations using `func.count().scalar()` are significantly more efficient than fetching all records and counting their array lengths.
**Action:** When working on lists that require count information (e.g. `member_count`, `submission_count`), always batch the count via `.scalar_subquery()` rather than adding secondary `.execute()` calls in for loops. For single fetches requiring a length check, use explicit aggregations.
## 2025-02-27 - Optimize SQLAlchemy len(result.scalars().all())
**Learning:** Using `len(result.scalars().all())` to get record counts causes the database to fetch all records into memory, which is inefficient. Inside loops, this creates N+1 query bottlenecks, heavily degrading performance due to sequential async DB calls not being run in parallel in the current setup.
**Action:** Always use `.scalar_subquery()` explicitly `.correlate()`d (using `aliased` if joining the same table) for loop queries to avoid N+1 and SQLAlchemy auto-correlation issues. For single queries, use `select(func.count()).select_from(...)` via `.scalar()`.
## 2024-07-06 - Optimize SQLAlchemy count in APIs
**Learning:** Calculating record counts using `len(result.scalars().all())` loads all rows into memory and causes N+1 queries when executed inside loops. For batching, `scalar_subquery()` should be used.
**Action:** Use `func.count()` with `scalar_subquery()` and explicitly append `.correlate()` to prevent auto-correlation issues for batched operations. For singular counts, use `.scalar(select(func.count()).select_from(...))`.
## 2024-05-24 - N+1 Query Antipattern identified
**Learning:** The backend codebase has a recurring performance antipattern where record counts are calculated by fetching all records into memory using `len(result.scalars().all())`. Inside loops, this creates N+1 database queries.
**Action:** This should be replaced with explicit aggregation using `.scalar_subquery()` mapped onto the main query or via `.scalar()` with `func.count()`. When selecting `func.count()`, make sure to properly `.correlate()` subqueries to prevent SQLAlchemy auto-correlation issues.
## 2024-05-18 - Avoid N+1 and .all() lengths for Counting in SQLAlchemy
**Learning:** Found multiple instances where record counts are being calculated using `len(result.scalars().all())` inside a loop or after a full data fetch. This is a known performance anti-pattern. First, it pulls full rows into memory instead of just integer counts. Second, when inside a loop like `list_my_sandboxes` or `list_bounties`, it creates an N+1 query problem. SQLAlchemy's async connection pooling doesn't support concurrent gather tasks easily, so we must batch queries in the database directly.
**Action:** Replace `len(result.scalars().all())` loops with either explicit aggregation using `func.count()` with `.scalar_subquery()` and explicitly appending `.correlate(MainModel)`. For singular query checks like those in `join_sandbox` replace `len(result.scalars().all())` with `select(func.count()).select_from(...)`.
## 2025-07-03 - Avoid calculating record counts using `len(result.scalars().all())`
**Learning:** Found N+1 query patterns `len(count_result.scalars().all())` used across multiple endpoints (`api/sandboxes.py` and `api/bounties.py`). The issue is that fetching all rows and calling `.all()` into memory is very inefficient. In some places it's in a loop causing N+1 queries.
**Action:** Replace this anti-pattern using `func.count()`, `.scalar_subquery()`, and `.correlate()` to prevent SQLAlchemy auto-correlation issues for loops, or just explicit aggregation using `select(func.count()).select_from(...)` via `.scalar()` for single counts.
## 2026-07-02 - N+1 Query Optimization
**Learning:** Using len(result.scalars().all()) inside loops creates N+1 queries.
**Action:** Use func.count() and correlated subqueries to batch count operations into a single query.
## 2025-01-20 - Optimize N+1 queries using scalar subqueries
**Learning:** Discovered N+1 queries and memory-inefficient record counts using `len(result.scalars().all())` inside loops in list_my_sandboxes and list_bounties. This architecture anti-pattern causes performance degradation on larger datasets.
**Action:** Replaced iterative `.all()` calls inside loops with `func.count()` as a `.scalar_subquery()` correlated to the main model, resolving the N+1 issue and reducing memory footprint.
## 2024-11-20 - [Fixing N+1 queries using `len(result.scalars().all())`]
**Learning:** Python-level calculation of database counts using `len(result.scalars().all())` within a loop creates serious N+1 query bottlenecks in SQLAlchemy. This pattern is prevalent for counts like `submission_count` and `member_count`. Simply fetching data by using `scalar_subquery()` together with `.correlate(MainModel)` effectively pushes this computation to the database level and executes it in a single trip. Using an `aliased()` model is crucial when joining the same table or counting related properties to prevent SQLAlchemy auto-correlation failures.
**Action:** Always scan for `len(result.scalars().all())` during performance optimization and replace it with `select(func.count()).scalar()` or as a correlated `.scalar_subquery()` batch depending on the context.
## 2024-06-30 - N+1 and len(all()) Anti-Patterns in SQLAlchemy 2.0 Async
**Learning:** Found multiple instances where record counts were calculated using `len(result.scalars().all())` which either leads to inefficient N+1 queries in loops or simply fetches entirely too much data for a basic count operation. With SQLAlchemy 2.0 Async, running multiple asynchronous count queries in parallel (e.g. `asyncio.gather()`) isn't supported on the same connection.
**Action:** When calculating counts inside a loop (like members in a sandbox, submissions in a bounty), use a `scalar_subquery` with `.correlate(ParentModel)` to batch counts directly inside the parent query to eliminate N+1. For single queries, explicitly use `select(func.count()).select_from(Model)` via `.scalar()` rather than counting retrieved objects in memory.
## 2024-07-29 - N+1 Query in Counting related records
**Learning:** Found an N+1 query problem using a loop to count sub-records: `len(result.scalars().all())` which triggers one SQL query per iteration. This applies to Sandbox and Bounty APIs where counts of related items are appended to each record in a loop.
**Action:** Replace `len(sub_count_res.scalars().all())` with an aggregate subquery using `select(func.count()).where(...)` or batched requests, to fetch the count directly from the database without loading all models into memory.
## 2026-06-28 - Optimize SQLAlchemy Count and N+1 Queries
**Learning:** Calculating record counts using `len(result.scalars().all())` leads to N+1 queries in loops. The backend AsyncSession implementation does not support concurrent parallel queries on the same connection, so we should batch them using `scalar_subquery()` and `.correlate()` within a single statement.
**Action:** Always use `select(func.count())` and `scalar_subquery()` for fetching associated counts instead of fetching all records in loops.
## 2026-06-27 - Backend N+1 Subquery Optimization
**Learning:** Calculating associated record counts in SQLAlchemy using `len(result.scalars().all())` within loops causes severe N+1 query performance degradation.
**Action:** When calculating record counts alongside main records, always use `func.count()`, `.scalar_subquery()`, and `.correlate(MainModel)` as a column in the main `select()` statement to fetch everything in a single, batched query. For singular records, use `db.scalar(select(func.count()).select_from(...))`.
## 2024-06-26 - Backend N+1 and Memory Issues with list counts
**Learning:** A common performance anti-pattern in this specific codebase architecture involves calculating relational counts by explicitly fetching all ORM objects and calling `len(result.scalars().all())`. Inside loops (such as API list endpoints), this leads to severe N+1 query execution and high memory overhead for large lists.
**Action:** Always replace `len(result.scalars().all())` inside loops with single SQL statements that leverage `func.count()`, `.scalar_subquery()`, and explicit `.correlate(MainModel)` (utilising `aliased` for same-table joins) to batch the fetch operation, eliminating the N+1 problem. For singular queries, utilize `select(func.count()).where(...)` and resolve with `.scalar()`.
## 2024-05-24 - Avoiding N+1 Memory Bloat in SQLAlchemy
**Learning:** A common performance anti-pattern in the backend codebase was calculating record counts by loading all entities into memory using `len(result.scalars().all())` within a loop. This results in heavy memory overhead (O(N)) and triggers N+1 query patterns.
**Action:** Always replace `len(result.scalars().all())` counting patterns with explicit aggregation using `select(func.count()).select_from(...)` via `.scalar()` to compute counts efficiently within the database engine (O(1) memory).
## $(date +%Y-%m-%d) - Optimize SQLAlchemy Count Queries

**Learning:** Calculating record counts using `len(result.scalars().all())` is an anti-pattern because it retrieves all records from the database into memory and leads to N+1 queries when used inside loops.
**Action:** Replace `len(result.scalars().all())` with `select(func.count())` and `.scalar_one()` for single queries. For loops, consider using `scalar_subquery()` or at least updating the inner loop queries to be `select(func.count(...)).scalar_one()` to avoid loading all objects into memory.
## 2024-06-23 - Optimize N+1 issues and auto-correlation problems in SQLAlchemy count queries
**Learning:** In loops or single fetch queries, using `len(result.scalars().all())` results in inefficient execution and N+1 query problems. Replacing this with `.scalar_subquery()` incorporating `func.count()`, along with `.correlate()` (using `aliased` if joining the same table), correctly batches the operation into a single database query and prevents SQLAlchemy auto-correlation issues.
**Action:** Always prefer using `func.count(...)` with `.scalar_subquery()` or `.scalar_one()` for counting database records in SQLAlchemy over fetching all records into application memory to check their length.
## 2024-05-24 - SQLAlchemy N+1 Query & `len()` Anti-pattern
**Learning:** Found instances where calculating nested record counts resulted in N+1 queries. A loop iterates through initial query results, performing a subquery with `len(result.scalars().all())` which loads all nested objects into memory simply to get a count.
**Action:** When a loop over an async session runs a query, it must be rewritten. Use `.scalar_subquery()` and `func.count()` in the primary query to do all logic in a single batched query, being careful to properly use `.correlate(Model)` to handle SQLAlchemy subquery resolution. Use `result.scalar_one()` for singular lookups.
## 2025-02-20 - [SQLAlchemy Query Performance Optimization]
**Learning:** Avoid `len(result.scalars().all())` within a loop as it leads to N+1 query overhead in database fetching.
**Action:** When a count is needed alongside parent data (e.g. counting SandboxMember for each InstitutionalSandbox), formulate the subquery using `func.count(Model.id)` and `.scalar_subquery()`, and remember to `.correlate(ParentModel)` to integrate it into the parent query correctly, returning a single query that calculates the count natively in PostgreSQL. For singular queries, use `.scalar_one()` rather than loading all objects into Python.
## 2024-05-18 - Avoid Memory Bloat and N+1 Queries with SQLAlchemy `scalar_subquery`
**Learning:** Calculating record counts using `len(result.scalars().all())` inside loops leads to N+1 database queries and significant memory bloat, as it fetches all related records into memory just to count them.
**Action:** When counting related records alongside a list fetch, batch the queries using `scalar_subquery()` combined with `func.count()`. For individual count queries, use `select(func.count())` and fetch the integer using `scalar_one()` instead of loading the object scalar list.
## 2026-06-19 - N+1 Memory Bloat Anti-Pattern using `len(result.scalars().all())`
**Learning:** Found a critical and recurring performance anti-pattern in the backend API layer (`sandboxes.py` and `bounties.py`). When fetching lists of entities (like sandboxes or bounties), the application was executing N+1 queries by looping over results and doing a `select()` for related child items (like members or submissions). Even worse, it was loading all the child records into memory with `.all()` and calling Python's `len()` just to get a count, instead of doing an efficient SQL `COUNT`. This causes huge unnecessary memory pressure and drastically slower request times, particularly for entities with many children.

**Action:** Whenever counting related records in a list API response, use `scalar_subquery()` with `func.count()` built directly into the main `select()` statement to fetch everything in a single, DB-optimized roundtrip without loading full objects into application memory.
## 2024-05-24 - Avoid `len(result.scalars().all())` for database counts
**Learning:** A common performance anti-pattern was found where row counts were being calculated in memory by loading all entities and calling `len(result.scalars().all())`. Inside a loop, this causes severe N+1 query and memory issues.
**Action:** Replace `len(result.scalars().all())` with an explicit `func.count()` query. When counting related entities in a list API response, use a `scalar_subquery()` correlated to the parent entity to fetch counts in a single batched query alongside the parent objects.
## 2024-05-24 - Avoid len(result.scalars().all()) for counting

**Learning:** Found an anti-pattern in `apps/backend/app/api/sandboxes.py` and `apps/backend/app/api/bounties.py` where counting rows was done by fetching all rows into memory and calling `len()` inside loops, leading to severe N+1 queries and memory bloat. SQLAlchemy `AsyncSession` doesn't support concurrent `asyncio.gather()`, which makes sequential loops even slower.

**Action:** Whenever counting related records within a list query, always use a `scalar_subquery` with `func.count()`. For individual counts, use `select(func.count(Model.id))` rather than fetching objects.
## 2026-06-14 - Batching Sequential Queries in SQLAlchemy AsyncSession
**Learning:** The backend's SQLAlchemy `AsyncSession` implementation does not support concurrent parallel queries on the same connection (e.g., using `asyncio.gather()`). When trying to perform multiple aggregations (like counts and sums) for a single entity, making sequential `await db.scalar(...)` calls introduces unnecessary latency (N+1-like issue).
**Action:** To optimize sequential queries, batch them using `scalar_subquery()` within a single `select` statement. This reduces network roundtrips to the database from N to 1 while respecting the connection constraints of `AsyncSession`.
## 2024-05-15 - N+1 query patterns in backend
**Learning:** Found several instances of N+1 queries in the FastAPI backend (e.g. `apps/backend/app/api/sandboxes.py` `list_sandboxes` and `apps/backend/app/api/bounties.py` `list_bounties`) fetching counts using `len(count_result.scalars().all())` inside a for loop.
**Action:** Replace len(scalars().all()) inside loops with scalar subqueries using `func.count()` integrated into the primary select statement to optimize database performance and solve N+1.
## 2024-06-25 - Batching sequential queries over SQLAlchemy AsyncSession

**Learning:** The backend's SQLAlchemy `AsyncSession` implementation does not support parallel concurrent queries on the same database connection (e.g., using `asyncio.gather()`). A common anti-pattern was firing sequential `await db.execute` and `await db.scalar` queries for a single API endpoint to compute various metrics or fetch related items, adding significant overhead due to multiple network round trips.

**Action:** When calculating multiple aggregates or running several independent, fast queries on the same connection, batch them together using `scalar_subquery()` inside a single `select()` statement to reduce database round trips and improve API endpoint latency.
## 2024-06-11 - Parallelize DB Queries in User Profile
**Learning:** The `/me` endpoint performed four separate, sequential database queries to calculate user metrics, adding unnecessary latency to a high-traffic route. Although `asyncio.gather()` is useful for concurrent IO, `AsyncSession` in SQLAlchemy does not support parallel queries on the same session/connection.
**Action:** Used `scalar_subquery()` inside a single SQLAlchemy `select` statement to batch independent count/sum queries, effectively reducing the sequence of database calls to a single network round-trip.
