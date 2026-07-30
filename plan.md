1. *Fix N+1 and inefficient counting in `apps/backend/app/api/sandboxes.py`.*
   - In `list_my_sandboxes`, the loop fetches sandbox details, and for each sandbox, it queries all members and counts them via `len(count_result.scalars().all())`.
   - Update `list_my_sandboxes` to either:
     - Execute an aggregate query using `func.count(SandboxMember.user_id)`.
     - Or even better, just replace `len(count_result.scalars().all())` with `.scalar()` of an aggregate count if we keep the loop.
     - Update `join_sandbox` to use `.scalar()` of an aggregate query instead of `len(count_result.scalars().all())`.
2. *Fix N+1 and inefficient counting in `apps/backend/app/api/bounties.py`.*
   - In `list_bounties`, the loop queries all submissions for each bounty and counts them using `len(sub_count_res.scalars().all())`.
   - Replace it with a `func.count(BountySubmission.id)` query that returns `.scalar()`.
3. *Complete pre commit steps.*
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
4. *Submit changes.*
   - Submit via `submit` tool with title "⚡ Bolt: Replace in-memory list length count with DB func.count()".
