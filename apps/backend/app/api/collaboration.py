from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import logging

from app.db.session import get_db
from app.api.auth import get_current_user
from app.models.database import User, ResearchProject, ProjectMember, ProjectActivity, Notification
from app.models.schemas import (
    ProjectCreate, ProjectResponse, ProjectMemberResponse, 
    ProjectActivityResponse, ProjectInviteRequest
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    project_in: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new research project."""
    project = ResearchProject(
        title=project_in.title,
        description=project_in.description,
        owner_id=current_user["user_id"]
    )
    db.add(project)
    await db.flush()
    
    # Add owner as a member
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user["user_id"],
        role="owner"
    )
    db.add(member)
    
    # Log activity
    activity = ProjectActivity(
        project_id=project.id,
        user_id=current_user["user_id"],
        activity_type="project_created",
        content=f"Project '{project.title}' was created."
    )
    db.add(activity)
    
    await db.commit()
    await db.refresh(project)
    return project

@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List projects the user is a member of."""
    query = select(ResearchProject).join(ProjectMember).where(ProjectMember.user_id == current_user["user_id"])
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get project details if the user is a member."""
    # Check membership
    membership = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user["user_id"])
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this project")
        
    project = await db.get(ResearchProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/projects/{project_id}/invite")
async def invite_member(
    project_id: int,
    invite: ProjectInviteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite a scholar to a project."""
    # Check if current user has permission (owner/editor)
    membership = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, 
            ProjectMember.user_id == current_user["user_id"],
            ProjectMember.role.in_(["owner", "editor"])
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions to invite members")
        
    # Check if target user exists
    target = await db.get(User, invite.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target scholar not found")
        
    # Check if already a member
    existing = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == invite.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Scholar is already a member of this project")
        
    # Add member
    new_member = ProjectMember(
        project_id=project_id,
        user_id=invite.user_id,
        role=invite.role
    )
    db.add(new_member)
    
    # Notify target user
    project = await db.get(ResearchProject, project_id)
    notification = Notification(
        user_id=invite.user_id,
        type="project_invite",
        content=f"You've been invited to join the project: {project.title}",
        link=f"/projects/{project_id}"
    )
    db.add(notification)
    
    # Log activity
    activity = ProjectActivity(
        project_id=project_id,
        user_id=current_user["user_id"],
        activity_type="member_invited",
        content=f"Invited {target.username} as {invite.role}."
    )
    db.add(activity)
    
    await db.commit()
    return {"message": "Invitation sent successfully"}

@router.get("/projects/{project_id}/activity", response_model=List[ProjectActivityResponse])
async def get_project_activity(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch recent activity for a project."""
    # Check membership
    membership = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user["user_id"])
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this project")
        
    query = select(ProjectActivity).where(ProjectActivity.project_id == project_id).order_by(ProjectActivity.created_at.desc()).limit(50)
    result = await db.execute(query)
    return result.scalars().all()
