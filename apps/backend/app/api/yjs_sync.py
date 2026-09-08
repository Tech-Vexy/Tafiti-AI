"""
Yjs CRDT Sync API — manages Yjs document state for conflict-free editing.

Endpoints:
  GET  /yjs/{thesis_id}/state       — get full Yjs document state (binary)
  POST /yjs/{thesis_id}/sync        — upload Yjs updates (binary), returns server state vector
  POST /yjs/{thesis_id}/update      — receive a single Yjs update from a client
  GET  /yjs/{thesis_id}/state-vector — get current state vector for incremental sync
"""

import base64
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.database import Thesis
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("yjs_sync")
router = APIRouter()


class YjsSyncRequest(BaseModel):
    """Client sends updates and receives server state vector."""
    updates: str  # base64-encoded Yjs updates (could be multiple concatenated)
    state_vector: Optional[str] = None  # client's current state vector (base64)


class YjsSyncResponse(BaseModel):
    """Server responds with its state vector and any missing updates."""
    state_vector: str  # base64-encoded server state vector
    update: Optional[str] = None  # base64-encoded updates the client is missing


@router.get("/{thesis_id}/state")
async def get_yjs_state(
    thesis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full Yjs document state as binary."""
    result = await db.execute(
        select(Thesis).where(
            Thesis.id == thesis_id,
            Thesis.user_id == current_user["user_id"],
        )
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    if thesis.yjs_state:
        return Response(
            content=bytes(thesis.yjs_state),
            media_type="application/octet-stream",
            headers={
                "X-State-Vector": base64.b64encode(bytes(thesis.yjs_state_vector or b"")).decode(),
                "Content-Type": "application/octet-stream",
            },
        )

    # No state yet — return empty
    return Response(
        content=b"",
        media_type="application/octet-stream",
        headers={"X-State-Vector": ""},
    )


@router.post("/{thesis_id}/sync")
async def yjs_sync(
    thesis_id: str,
    req: YjsSyncRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Synchronize Yjs state: client sends updates, server merges and returns
    any updates the client is missing.
    """
    result = await db.execute(
        select(Thesis).where(
            Thesis.id == thesis_id,
            Thesis.user_id == current_user["user_id"],
        )
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    try:
        import yjs
    except ImportError:
        raise HTTPException(status_code=500, detail="Yjs not installed on server")

    try:
        # Decode client updates
        client_updates = base64.b64decode(req.updates) if req.updates else b""
        client_sv = base64.b64decode(req.state_vector) if req.state_vector else None

        # Create server Yjs doc and apply stored state
        server_doc = yjs.Doc()

        if thesis.yjs_state:
            # Apply stored state to server doc
            server_doc.apply_update(yjs.update.Update(bytes(thesis.yjs_state)))

        # Apply client updates to server doc
        if client_updates:
            server_doc.apply_update(yjs.update.Update(client_updates))

        # Generate delta for client (what the client is missing)
        missing_update = b""
        if client_sv:
            delta = server_doc.diff_v1(client_sv)
            missing_update = bytes(delta)

        # Save updated state to database
        new_state = bytes(server_doc.encode_state_as_update())
        new_sv = bytes(server_doc.encode_state_vector())

        thesis.yjs_state = new_state
        thesis.yjs_state_vector = new_sv
        await db.commit()

        return YjsSyncResponse(
            state_vector=base64.b64encode(new_sv).decode(),
            update=base64.b64encode(missing_update).decode() if missing_update else None,
        )

    except Exception as e:
        logger.error(f"yjs_sync_error thesis={thesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Sync failed")


@router.post("/{thesis_id}/update")
async def yjs_update(
    thesis_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive a single Yjs update from a client. Used by the WebSocket handler
    to forward updates to the database.
    """
    result = await db.execute(
        select(Thesis).where(
            Thesis.id == thesis_id,
            Thesis.user_id == current_user["user_id"],
        )
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    try:
        import yjs
    except ImportError:
        raise HTTPException(status_code=500, detail="Yjs not installed on server")

    try:
        body = await request.body()
        if not body:
            raise HTTPException(status_code=400, detail="Empty update")

        # Create server doc and apply stored state
        server_doc = yjs.Doc()
        if thesis.yjs_state:
            server_doc.apply_update(yjs.update.Update(bytes(thesis.yjs_state)))

        # Apply the new update
        server_doc.apply_update(yjs.update.Update(body))

        # Save
        thesis.yjs_state = bytes(server_doc.encode_state_as_update())
        thesis.yjs_state_vector = bytes(server_doc.encode_state_vector())
        await db.commit()

        return {"status": "ok", "state_vector": base64.b64encode(thesis.yjs_state_vector).decode()}

    except Exception as e:
        logger.error(f"yjs_update_error thesis={thesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Update failed")


@router.get("/{thesis_id}/state-vector")
async def get_state_vector(
    thesis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current state vector for incremental sync."""
    result = await db.execute(
        select(Thesis.id).where(
            Thesis.id == thesis_id,
            Thesis.user_id == current_user["user_id"],
        )
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    return {"state_vector": base64.b64encode(thesis.yjs_state_vector or b"").decode()}
