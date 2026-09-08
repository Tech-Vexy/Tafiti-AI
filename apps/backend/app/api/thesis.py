"""
Thesis Editor API — CRUD + version history + auto-save for Syncfusion Document Editor.
"""
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.database import Thesis
from app.models.schemas import (
    ThesisCreate, ThesisUpdate, ThesisResponse, ThesisListResponse,
    ThesisVersionResponse,
)
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("thesis_api")
router = APIRouter()

MAX_VERSION_HISTORY = 50  # keep last 50 snapshots


@router.get("/", response_model=List[ThesisListResponse])
async def list_theses(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
):
    """List all theses for the current user (lightweight, no content)."""
    q = select(Thesis).where(Thesis.user_id == current_user["user_id"])
    if status_filter:
        q = q.where(Thesis.status == status_filter)
    q = q.order_by(Thesis.updated_at.desc())
    result = await db.execute(q)
    theses = result.scalars().all()

    if search:
        search_lower = search.lower()
        theses = [t for t in theses if search_lower in (t.title or "").lower()]

    return [
        ThesisListResponse(
            id=t.id, title=t.title, status=t.status,
            word_count=t.word_count, created_at=t.created_at, updated_at=t.updated_at,
        )
        for t in theses
    ]


@router.post("/", response_model=ThesisResponse, status_code=status.HTTP_201_CREATED)
async def create_thesis(
    thesis_in: ThesisCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new thesis document."""
    thesis = Thesis(
        user_id=current_user["user_id"],
        title=thesis_in.title,
        content=thesis_in.content,
        question_id=thesis_in.question_id,
    )
    db.add(thesis)
    await db.commit()
    await db.refresh(thesis)
    logger.info("thesis_created", extra={"user_id": current_user["user_id"], "thesis_id": thesis.id})
    return thesis


@router.get("/{thesis_id}", response_model=ThesisResponse)
async def get_thesis(
    thesis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single thesis with full content."""
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")
    return thesis


@router.put("/{thesis_id}", response_model=ThesisResponse)
async def update_thesis(
    thesis_id: str,
    thesis_in: ThesisUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update thesis content, title, or status. Optionally creates a version snapshot."""
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    update_data = thesis_in.model_dump(exclude_unset=True)

    # Auto-save: if content changed, optionally create a version snapshot
    if "content" in update_data and update_data["content"] != thesis.content:
        version_history = thesis.version_history or []
        # Only snapshot if content actually changed significantly (last snapshot differs)
        if not version_history or version_history[-1].get("content") != thesis.content:
            version_entry = {
                "version": len(version_history) + 1,
                "content": thesis.content,  # save previous version
                "plain_text": thesis.plain_text,
                "word_count": thesis.word_count,
                "page_count": thesis.page_count,
                "created_at": thesis.updated_at.isoformat() if thesis.updated_at else None,
            }
            version_history.append(version_entry)
            # Trim old versions
            if len(version_history) > MAX_VERSION_HISTORY:
                version_history = version_history[-MAX_VERSION_HISTORY:]
            thesis.version_history = version_history

        thesis.last_auto_save_at = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(thesis, field, value)

    thesis.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(thesis)
    return thesis


@router.post("/{thesis_id}/snapshot", response_model=ThesisResponse)
async def create_snapshot(
    thesis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly create a version snapshot of the current content."""
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    version_history = thesis.version_history or []
    version_entry = {
        "version": len(version_history) + 1,
        "content": thesis.content,
        "plain_text": thesis.plain_text,
        "word_count": thesis.word_count,
        "page_count": thesis.page_count,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    version_history.append(version_entry)
    if len(version_history) > MAX_VERSION_HISTORY:
        version_history = version_history[-MAX_VERSION_HISTORY:]
    thesis.version_history = version_history
    thesis.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(thesis)
    return thesis


@router.get("/{thesis_id}/versions", response_model=ThesisVersionResponse)
async def list_versions(
    thesis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List version history metadata (no content blobs)."""
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    versions = [
        {
            "version": v.get("version"),
            "created_at": v.get("created_at"),
            "word_count": v.get("word_count", 0),
        }
        for v in (thesis.version_history or [])
    ]
    return ThesisVersionResponse(versions=versions, total_versions=len(versions))


@router.post("/{thesis_id}/restore/{version_number}", response_model=ThesisResponse)
async def restore_version(
    thesis_id: str,
    version_number: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore thesis to a specific version number."""
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    version_history = thesis.version_history or []
    target = None
    for v in version_history:
        if v.get("version") == version_number:
            target = v
            break
    if not target:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found")

    # Save current as a snapshot before restoring
    pre_restore = {
        "version": len(version_history) + 1,
        "content": thesis.content,
        "plain_text": thesis.plain_text,
        "word_count": thesis.word_count,
        "page_count": thesis.page_count,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "_note": f"auto-saved before restoring to v{version_number}",
    }
    version_history.append(pre_restore)

    thesis.content = target.get("content", thesis.content)
    thesis.plain_text = target.get("plain_text", thesis.plain_text)
    thesis.word_count = target.get("word_count", thesis.word_count)
    thesis.page_count = target.get("page_count", thesis.page_count)
    thesis.version_history = version_history
    thesis.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(thesis)
    return thesis


@router.delete("/{thesis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thesis(
    thesis_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a thesis document."""
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")
    await db.delete(thesis)
    await db.commit()
    return None


@router.post("/{thesis_id}/export")
async def export_thesis(
    thesis_id: str,
    format: str = Query("docx", pattern="^(docx|txt|html|md)$"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export thesis in various formats. Returns the SFDT content for client-side export."""
    result = await db.execute(
        select(Thesis).where(Thesis.id == thesis_id, Thesis.user_id == current_user["user_id"])
    )
    thesis = result.scalar_one_or_none()
    if not thesis:
        raise HTTPException(status_code=404, detail="Thesis not found")

    # For now, return the SFDT content — client-side Syncfusion handles conversion
    return {
        "id": thesis.id,
        "title": thesis.title,
        "format": format,
        "content": thesis.content,
        "plain_text": thesis.plain_text or "",
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
