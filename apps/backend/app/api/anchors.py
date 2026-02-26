"""
Cryptographic Draft Anchoring API
===================================
Researchers can hash a private draft and anchor the SHA-256 digest in Neon Postgres
to prove prior art without revealing the content.

Workflow:
  1. POST /anchors/         — provide draft text; backend hashes it and stores the record.
  2. GET  /anchors/         — list the user's anchors (hash + timestamp only).
  3. POST /anchors/verify   — verify a piece of text against a stored hash to prove authorship.

The hash is computed server-side from the raw content. The raw content is NEVER stored.
An optional ANCHOR_WEBHOOK_URL can be set to POST the hash to an external notary service.
"""

import hashlib
import httpx
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.db.session import get_db
from app.models.database import DraftAnchor
from app.core.security import get_current_user
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("anchors")
router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AnchorCreate(BaseModel):
    content: str = Field(..., min_length=10, description="The draft text to anchor. Never stored.")
    label: Optional[str] = Field(None, max_length=200, description="Private label for your reference.")


class AnchorResponse(BaseModel):
    id: str
    label: Optional[str] = None
    content_hash: str          # SHA-256 hex digest
    external_anchor_ref: Optional[str] = None
    anchored_at: datetime

    class Config:
        from_attributes = True


class VerifyRequest(BaseModel):
    anchor_id: str
    content: str = Field(..., min_length=10, description="The content to verify against the stored hash.")


class VerifyResponse(BaseModel):
    anchor_id: str
    match: bool
    anchored_at: Optional[datetime] = None
    message: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def _post_to_notary(content_hash: str, anchor_id: str) -> Optional[str]:
    """
    Optionally POST the hash to an external notary webhook.
    Returns a reference string on success, None otherwise.
    """
    if not settings.ANCHOR_WEBHOOK_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                settings.ANCHOR_WEBHOOK_URL,
                json={"hash": content_hash, "anchor_id": anchor_id, "service": "tafiti_ai"},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("reference") or data.get("tx_id") or str(resp.status_code)
    except Exception as e:
        logger.warning(f"External notary webhook failed: {e}")
        return None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=AnchorResponse)
async def create_anchor(
    body: AnchorCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Hash the provided draft content and store the digest.
    The original content is discarded immediately after hashing — only the hash is persisted.
    """
    content_hash = _sha256(body.content)

    anchor = DraftAnchor(
        user_id=current_user["user_id"],
        label=body.label,
        content_hash=content_hash,
        anchored_at=datetime.utcnow(),
    )
    db.add(anchor)
    await db.flush()  # get the id before the notary call

    # Fire optional external notary (best-effort)
    ext_ref = await _post_to_notary(content_hash, anchor.id)
    if ext_ref:
        anchor.external_anchor_ref = ext_ref

    await db.commit()
    await db.refresh(anchor)

    logger.info(
        f"Anchor created: id={anchor.id} hash={content_hash[:12]}... "
        f"user={current_user['user_id']}"
    )
    return anchor


@router.get("/", response_model=List[AnchorResponse])
async def list_anchors(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all draft anchors for the current user, newest first."""
    result = await db.execute(
        select(DraftAnchor)
        .where(DraftAnchor.user_id == current_user["user_id"])
        .order_by(desc(DraftAnchor.anchored_at))
        .limit(100)
    )
    return result.scalars().all()


@router.post("/verify", response_model=VerifyResponse)
async def verify_anchor(
    body: VerifyRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify that a piece of content matches a previously anchored hash.
    Useful for proving that you authored a draft before a given timestamp.
    """
    result = await db.execute(
        select(DraftAnchor).where(
            DraftAnchor.id == body.anchor_id,
            DraftAnchor.user_id == current_user["user_id"],
        )
    )
    anchor = result.scalar_one_or_none()
    if not anchor:
        raise HTTPException(status_code=404, detail="Anchor not found")

    incoming_hash = _sha256(body.content)
    match = incoming_hash == anchor.content_hash

    return VerifyResponse(
        anchor_id=anchor.id,
        match=match,
        anchored_at=anchor.anchored_at,
        message=(
            f"✓ Content matches anchor from {anchor.anchored_at.strftime('%Y-%m-%d %H:%M UTC')}."
            if match
            else "✗ Content does not match the stored hash."
        ),
    )
