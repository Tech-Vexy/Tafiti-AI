## 2024-05-24 - SQLAlchemy Correlated Subquery Optimization

**Learning:** When addressing N+1 query problems in SQLAlchemy where a parent entity needs a count of its children (e.g. `Bounty` -> `BountySubmissions`), using a correlated scalar subquery (`select(func.count()).correlate(Parent).scalar_subquery()`) is significantly faster than using `.scalars().all()` and calling `len()` in python. It keeps the aggregation purely in the database layer.

**Action:** Whenever retrieving lists of objects that include a "count" field mapped to a relationship, check for manual `len()` calls in loops. Replace these with explicit `func.count()` subqueries attached to the main select using `.label("count_field")`.
