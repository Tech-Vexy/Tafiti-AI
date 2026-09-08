"""
Thesis Collaboration API — WebSocket + REST endpoints for real-time editing.

WebSocket: /ws/thesis/{thesis_id}
REST:     /thesis/{thesis_id}/collaborators  (GET participants)
          /thesis/{thesis_id}/collaborate     (POST invite, PATCH role)
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from app.db.session import get_db
from app.models.database import Thesis, User
from app.core.security import get_current_user, decode_token
from app.core.logger import get_logger
from app.services.collaboration_ws import collaboration_manager

logger = get_logger("collaboration_api")
router = APIRouter()


# ---------------------------------------------------------------------------
# WebSocket endpoint for real-time collaboration
# ---------------------------------------------------------------------------

@router.websocket("/ws/thesis/{thesis_id}")
async def thesis_collaboration_ws(
    websocket: WebSocket,
    thesis_id: str,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for real-time thesis collaboration.
    
    Clients connect with: ws://host/ws/thesis/{thesis_id}?token=<clerk_jwt>
    
    Protocol messages (JSON):
      Client → Server:
        {"type": "cursor_update", "offset": 42}
        {"type": "selection_update", "start": 10, "end": 50}
        {"type": "content_change", "change": {"offset": 10, "delete_count": 0, "insert_text": "hello"}}
        {"type": "typing", "is_typing": true}
        {"type": "ping"}
      
      Server → Client:
        {"type": "user_joined", "user_id": "...", "display_name": "...", "color": "#6366f1"}
        {"type": "user_left", "user_id": "..."}
        {"type": "presence_sync", "collaborators": [...]}
        {"type": "cursor_update", "user_id": "...", "offset": 42, "color": "#6366f1"}
        {"type": "selection_update", "user_id": "...", "start": 10, "end": 50, "color": "#6366f1"}
        {"type": "content_change", "user_id": "...", "change": {...}, "timestamp": 123}
        {"type": "typing", "user_id": "...", "is_typing": true}
        {"type": "pong"}
    """
    # Authenticate via token query param
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        payload = decode_token(token)
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception as e:
        logger.warning(f"ws_auth_failed: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # Check thesis exists and user has access
    async with get_db_session() as db:
        result = await db.execute(
            select(Thesis).where(Thesis.id == thesis_id)
        )
        thesis = result.scalar_one_or_none()
        if not thesis:
            await websocket.close(code=4004, reason="Thesis not found")
            return

        # Determine role
        if thesis.user_id == user_id:
            role = "owner"
        else:
            # Check if user is a project member with access
            role = "editor"  # default for authenticated users with access

        # Get user display name
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        display_name = user.username or user.email or f"Researcher-{user_id[:8]}"
        avatar_url = None  # Could be extended with avatar URL

    # Connect to the collaboration room
    room = await collaboration_manager.connect(
        thesis_id=thesis_id,
        user_id=user_id,
        display_name=display_name,
        role=role,
        avatar_url=avatar_url,
        ws=websocket,
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                await collaboration_manager.handle_message(thesis_id, user_id, data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
    except WebSocketDisconnect:
        await collaboration_manager.disconnect(thesis_id, user_id)
    except Exception as e:
        logger.error(f"ws_error thesis={thesis_id} user={user_id}: {e}")
        await collaboration_manager.disconnect(thesis_id, user_id)


# ---------------------------------------------------------------------------
# REST endpoints for collaboration management
# ---------------------------------------------------------------------------

@router.get("/{thesis_id}/collaborators")
async def get_collaborators(
    thesis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current collaborators for a thesis (who's online)."""
    # Verify access
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    participants = collaboration_manager.get_participants(thesis_id)
    return {
        "thesis_id": thesis_id,
        "active_count": len(participants),
        "participants": participants,
    }


@router.post("/{thesis_id}/collaborate")
async def invite_collaborator(
    thesis_id: str,
    invite_data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a collaborator to a thesis by user ID or email."""
    # Only owner can invite
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    target_id = invite_data.get("user_id")
    target_email = invite_data.get("email")
    role = invite_data.get("role", "editor")

    if not target_id and not target_email:
        raise HTTPException(status_code=400, detail="Provide user_id or email")

    # Find target user
    if target_email:
        user_result = await db.execute(select(User).where(User.email == target_email))
        target_user = user_result.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found with that email")
        target_id = target_user.id

    # Create notification for the invited user
    from app.models.database import Notification
    notification = Notification(
        user_id=target_id,
        type="thesis_collab_invite",
        content=f"You've been invited to collaborate on '{thesis.title}'",
        link=f"/thesis/{thesis_id}",
    )
    db.add(notification)
    await db.commit()

    return {"status": "invited", "thesis_id": thesis_id, "invited_user": target_id, "role": role}


@router.get("/active")
async def get_active_theses(
    current_user: dict = Depends(get_current_user),
):
    """Get all theses with active collaborators."""
    active = collaboration_manager.get_active_theses()
    return {
        "active_theses": [
            {"thesis_id": tid, "collaborator_count": count}
            for tid, count in active.items()
        ]
    }


# ---------------------------------------------------------------------------
# Helper: get an async session outside of FastAPI dependency injection
# ---------------------------------------------------------------------------

from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db_session():
    """Get a database session for use in WebSocket handlers (outside DI)."""
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        yield session
