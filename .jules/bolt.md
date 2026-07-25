## 2024-06-15 - SQLAlchemy N+1 Queries with count
**Learning:** Found an anti-pattern `len(result.scalars().all())` which loads full models in loops (e.g. `list_bounties`, `list_my_sandboxes`) causing massive N+1 issues.
**Action:** Replace `len(scalars().all())` in loops with `select(func.count()).select_from(...).correlate(Parent).scalar_subquery()` and join/add it to the main `select` query.
