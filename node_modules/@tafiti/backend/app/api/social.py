from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from typing import List

from app.db.session import get_db
from app.models.database import User, Connection, Notification
from app.models.schemas import ConnectionResponse, NotificationResponse
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("social_api")
router = APIRouter()

@router.post("/connect/{target_user_id}", response_model=ConnectionResponse)
async def connect_to_user(
    target_user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if target_user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot connect to yourself")
    
    # Check if connection already exists
    stmt = select(Connection).where(
        (Connection.follower_id == current_user["user_id"]) & 
        (Connection.followed_id == target_user_id)
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        return existing
        
    connection = Connection(
        follower_id=current_user["user_id"],
        followed_id=target_user_id,
        status="accepted" # Auto-accepting for now to simplify, could be "pending"
    )
    db.add(connection)
    
    # Create notification for the target user
    notification = Notification(
        user_id=target_user_id,
        type="connection_request",
        content=f"New connection from a scholar!",
        link=f"/profile/{current_user['user_id']}"
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(connection)
    return connection

@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20
):
    stmt = select(Notification).where(
        Notification.user_id == current_user["user_id"]
    ).order_by(Notification.created_at.desc()).limit(limit)
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = update(Notification).where(
        (Notification.id == notification_id) & 
        (Notification.user_id == current_user["user_id"])
    ).values(is_read=True)
    
    await db.execute(stmt)
    await db.commit()
    return {"status": "success"}

@router.get("/notifications/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(func.count(Notification.id)).where(
        (Notification.user_id == current_user["user_id"]) &
        (Notification.is_read == False)
    )
    count = await db.scalar(stmt)
    return {"count": count or 0}


@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read."""
    stmt = update(Notification).where(
        (Notification.user_id == current_user["user_id"]) &
        (Notification.is_read == False)
    ).values(is_read=True)
    await db.execute(stmt)
    await db.commit()
    return {"status": "success"}


@router.delete("/connect/{target_user_id}")
async def unfollow_user(
    target_user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unfollow / disconnect from a user."""
    stmt = select(Connection).where(
        (Connection.follower_id == current_user["user_id"]) &
        (Connection.followed_id == target_user_id)
    )
    result = await db.execute(stmt)
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    await db.delete(connection)
    await db.commit()
    return {"status": "unfollowed"}


@router.get("/followers", response_model=List[ConnectionResponse])
async def list_followers(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List users who follow the current user."""
    stmt = select(Connection).where(Connection.followed_id == current_user["user_id"])
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/following", response_model=List[ConnectionResponse])
async def list_following(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List users the current user follows."""
    stmt = select(Connection).where(Connection.follower_id == current_user["user_id"])
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/connect/{connection_id}/accept")
async def accept_connection(
    connection_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept a pending connection request."""
    result = await db.execute(
        select(Connection).where(
            Connection.id == connection_id,
            Connection.followed_id == current_user["user_id"],
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection request not found")
    connection.status = "accepted"
    await db.commit()
    return {"status": "accepted"}


@router.delete("/connect/{connection_id}/reject")
async def reject_connection(
    connection_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reject / delete a pending connection request."""
    result = await db.execute(
        select(Connection).where(
            Connection.id == connection_id,
            Connection.followed_id == current_user["user_id"],
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection request not found")
    await db.delete(connection)
    await db.commit()
    return {"status": "rejected"}
