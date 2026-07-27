import sys

with open("apps/backend/app/api/bounties.py", "r") as f:
    content = f.read()

content = content.replace(
    "from sqlalchemy import select, desc",
    "from sqlalchemy import select, desc, func"
)

old_code = """    result = await db.execute(
        select(Bounty)
        .where(Bounty.status == status, Bounty.funded == True)  # noqa: E712
        .order_by(desc(Bounty.created_at))
        .limit(limit)
    )
    bounties = result.scalars().all()
    out = []
    for b in bounties:
        sub_count_res = await db.execute(
            select(BountySubmission).where(BountySubmission.bounty_id == b.id)
        )
        count = len(sub_count_res.scalars().all())
        out.append(BountyResponse(**b.__dict__, submission_count=count))
    return out"""

new_code = """    sub_count_subq = (
        select(func.count(BountySubmission.id))
        .where(BountySubmission.bounty_id == Bounty.id)
        .correlate(Bounty)
        .scalar_subquery()
    )
    result = await db.execute(
        select(Bounty, sub_count_subq)
        .where(Bounty.status == status, Bounty.funded == True)  # noqa: E712
        .order_by(desc(Bounty.created_at))
        .limit(limit)
    )
    bounties = result.all()
    out = []
    for b, count in bounties:
        out.append(BountyResponse(**b.__dict__, submission_count=count or 0))
    return out"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open("apps/backend/app/api/bounties.py", "w") as f:
        f.write(content)
    print("Patched bounties.py")
else:
    print("Could not find old_code in bounties.py")
    sys.exit(1)
