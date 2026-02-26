"""
ORCID integration service.

Flow:
1. User clicks "Connect ORCID" in the frontend.
2. Frontend redirects to GET /api/v1/auth/orcid/authorize → redirects to ORCID OAuth page.
3. ORCID redirects back to GET /api/v1/auth/orcid/callback?code=...
4. Backend exchanges code for token, stores OrcidProfile, fires background sync.
5. Background sync fetches all works from ORCID, upserts OrcidPublication rows,
   and auto-creates GhostProfile rows for any unrecognised co-authors.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    User,
    OrcidProfile,
    OrcidPublication,
    GhostProfile,
)

logger = get_logger("orcid")


# ─── Token Exchange ───────────────────────────────────────────────────────────

async def exchange_code_for_token(code: str) -> Optional[Dict[str, Any]]:
    """Exchange an ORCID authorisation code for an access token."""
    if not settings.ORCID_CLIENT_ID or not settings.ORCID_CLIENT_SECRET:
        logger.warning("ORCID_CLIENT_ID / ORCID_CLIENT_SECRET not configured")
        return None

    data = {
        "client_id": settings.ORCID_CLIENT_ID,
        "client_secret": settings.ORCID_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": f"{settings.FRONTEND_URL}/orcid/callback",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(
                settings.ORCID_TOKEN_URL,
                data=data,
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"ORCID token exchange failed: {e}")
            return None


# ─── Profile Upsert ───────────────────────────────────────────────────────────

async def upsert_orcid_profile(
    db: AsyncSession,
    user_id: str,
    orcid_id: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_in: Optional[int],
) -> OrcidProfile:
    result = await db.execute(
        select(OrcidProfile).where(OrcidProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    expires_at = (
        datetime.utcnow() + timedelta(seconds=expires_in)
        if expires_in
        else None
    )

    if profile:
        profile.orcid_id = orcid_id
        profile.access_token = access_token
        if refresh_token:
            profile.refresh_token = refresh_token
        profile.token_expires_at = expires_at
    else:
        profile = OrcidProfile(
            user_id=user_id,
            orcid_id=orcid_id,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=expires_at,
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile


# ─── Background Sync ──────────────────────────────────────────────────────────

async def sync_orcid_works(db: AsyncSession, user_id: str, orcid_id: str) -> int:
    """
    Pull all works from ORCID for a given ORCID iD.
    Upserts OrcidPublication rows and auto-creates GhostProfiles for unknown co-authors.
    Returns the number of works synced.
    """
    url = f"{settings.ORCID_API_URL}/{orcid_id}/works"
    headers = {"Accept": "application/json"}

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"ORCID works fetch failed for {orcid_id}: {e}")
            return 0

    groups = data.get("group") or []
    synced = 0

    for group in groups:
        work_summaries = group.get("work-summary") or []
        if not work_summaries:
            continue
        # Take the first (most complete) summary
        summary = work_summaries[0]
        put_code = str(summary.get("put-code", ""))
        title_data = (summary.get("title") or {}).get("title") or {}
        title = (title_data.get("value") or "").strip()
        if not title:
            continue

        # DOI
        doi: Optional[str] = None
        for ext_id in (summary.get("external-ids") or {}).get("external-id") or []:
            if ext_id.get("external-id-type") == "doi":
                doi = (ext_id.get("external-id-value") or "").strip() or None
                break

        pub_year: Optional[int] = None
        year_data = (summary.get("publication-date") or {}).get("year") or {}
        year_val = year_data.get("value")
        if year_val:
            try:
                pub_year = int(year_val)
            except ValueError:
                pass

        journal = ((summary.get("journal-title") or {}).get("value") or "").strip() or None
        work_type = summary.get("type") or None

        # Upsert publication
        existing = await db.execute(
            select(OrcidPublication).where(
                OrcidPublication.user_id == user_id,
                OrcidPublication.put_code == put_code,
            )
        )
        pub = existing.scalar_one_or_none()
        if pub:
            pub.title = title
            pub.doi = doi
            pub.publication_year = pub_year
            pub.journal = journal
            pub.work_type = work_type
        else:
            pub = OrcidPublication(
                user_id=user_id,
                put_code=put_code,
                title=title,
                doi=doi,
                publication_year=pub_year,
                journal=journal,
                work_type=work_type,
            )
            db.add(pub)
        synced += 1

        # Auto-create Ghost Profiles for co-authors (if DOI known)
        if doi:
            await _create_ghost_profiles_for_doi(db, doi, exclude_orcid=orcid_id)

    # Mark last-synced timestamp
    result = await db.execute(
        select(OrcidProfile).where(OrcidProfile.user_id == user_id)
    )
    orcid_profile = result.scalar_one_or_none()
    if orcid_profile:
        orcid_profile.last_synced_at = datetime.utcnow()

    await db.commit()

    # Update user's publications_count
    result2 = await db.execute(select(User).where(User.id == user_id))
    user = result2.scalar_one_or_none()
    if user:
        from sqlalchemy import func
        count_result = await db.execute(
            select(func.count()).select_from(OrcidPublication).where(
                OrcidPublication.user_id == user_id
            )
        )
        user.publications_count = count_result.scalar() or 0
        await db.commit()

    logger.info(f"ORCID sync complete for {orcid_id}: {synced} works")
    return synced


async def _create_ghost_profiles_for_doi(
    db: AsyncSession,
    doi: str,
    exclude_orcid: str,
) -> None:
    """
    Fetch co-author metadata for a DOI from the OpenAlex API and create
    GhostProfiles for any authors who are not yet registered on Tafiti AI.
    Best-effort — silently skips on error.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.openalex.org/works",
                params={
                    "filter": f"doi:{doi}",
                    "select": "authorships",
                    "per_page": 1,
                },
            )
            if resp.status_code != 200:
                return
            data = resp.json()
            results = data.get("results") or []
            if not results:
                return
            authorships = results[0].get("authorships") or []

        for authorship in authorships:
            author = authorship.get("author") or {}
            name = (author.get("display_name") or "").strip()
            orcid_url = (author.get("orcid") or "")
            co_orcid = orcid_url.split("/")[-1] if orcid_url else None

            if not name:
                continue
            if co_orcid and co_orcid == exclude_orcid:
                continue  # Skip the user who triggered the sync

            # Check if a real user with this ORCID already exists
            if co_orcid:
                existing_user = await db.execute(
                    select(OrcidProfile).where(OrcidProfile.orcid_id == co_orcid)
                )
                if existing_user.scalar_one_or_none():
                    continue

                # Check if ghost profile already exists
                existing_ghost = await db.execute(
                    select(GhostProfile).where(GhostProfile.orcid_id == co_orcid)
                )
                ghost = existing_ghost.scalar_one_or_none()
            else:
                ghost = None

            if ghost:
                # Append DOI to co_publication_dois if not already present
                dois = list(ghost.co_publication_dois or [])
                if doi not in dois:
                    dois.append(doi)
                    ghost.co_publication_dois = dois
            else:
                institutions = authorship.get("institutions") or []
                affiliation = (institutions[0].get("display_name") if institutions else None)
                ghost = GhostProfile(
                    display_name=name,
                    orcid_id=co_orcid,
                    affiliation=affiliation,
                    co_publication_dois=[doi],
                    invite_token=secrets.token_urlsafe(32),
                )
                db.add(ghost)

        await db.commit()
    except Exception as e:
        logger.debug(f"Ghost profile creation skipped for DOI {doi}: {e}")
