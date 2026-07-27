import sys

with open("apps/backend/app/api/sandboxes.py", "r") as f:
    content = f.read()

content = content.replace(
    "from sqlalchemy import select",
    "from sqlalchemy import select, func\nfrom sqlalchemy.orm import aliased"
)

old_list = """    result = await db.execute(
        select(SandboxMember).where(SandboxMember.user_id == current_user["user_id"])
    )
    memberships = result.scalars().all()

    out = []
    for m in memberships:
        sb_result = await db.execute(
            select(InstitutionalSandbox).where(InstitutionalSandbox.id == m.sandbox_id)
        )
        sb = sb_result.scalar_one_or_none()
        if not sb:
            continue
        count_result = await db.execute(
            select(SandboxMember).where(SandboxMember.sandbox_id == sb.id)
        )
        count = len(count_result.scalars().all())
        out.append(SandboxResponse(**sb.__dict__, member_count=count))
    return out"""

new_list = """    member_alias = aliased(SandboxMember)
    count_subq = (
        select(func.count(member_alias.id))
        .where(member_alias.sandbox_id == InstitutionalSandbox.id)
        .correlate(InstitutionalSandbox)
        .scalar_subquery()
    )
    result = await db.execute(
        select(InstitutionalSandbox, count_subq)
        .join(SandboxMember, SandboxMember.sandbox_id == InstitutionalSandbox.id)
        .where(SandboxMember.user_id == current_user["user_id"])
    )
    sandboxes = result.all()

    out = []
    for sb, count in sandboxes:
        out.append(SandboxResponse(**sb.__dict__, member_count=count or 0))
    return out"""

old_join = """    count_result = await db.execute(
        select(SandboxMember).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = len(count_result.scalars().all())"""

new_join = """    count_result = await db.execute(
        select(func.count(SandboxMember.id)).where(SandboxMember.sandbox_id == sandbox.id)
    )
    count = count_result.scalar() or 0"""

if old_list in content and old_join in content:
    content = content.replace(old_list, new_list).replace(old_join, new_join)
    with open("apps/backend/app/api/sandboxes.py", "w") as f:
        f.write(content)
    print("Patched sandboxes.py")
else:
    print("Could not find targets in sandboxes.py")
    sys.exit(1)
