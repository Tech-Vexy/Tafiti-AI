"""
Refactored ORCID service using the standardized BaseExternalClient.
This provides consistent error handling, retry logic, rate limiting, and caching.
"""

import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError, AuthenticationError
from app.core.logger import get_logger
from app.models.database import (
    User,
    OrcidProfile,
    OrcidPublication,
    GhostProfile,
)

logger = get_logger("orcid")


class ORCIDService(BaseExternalClient):
    """
    ORCID API client for researcher profile integration.
    Handles OAuth flow, profile data fetching, and publication synchronization.
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url=settings.ORCID_API_URL,
            service_name="ORCID",
            timeout=15.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=None,  # ORCID uses OAuth tokens, not API keys
            rate_limit_per_minute=100,  # ORCID rate limit
        )
        self._shared_client = client
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Use shared client if provided, otherwise use base client."""
        if self._shared_client:
            return self._shared_client
        return super().client
    
    def _build_headers(self, additional_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Build headers with ORCID-specific requirements."""
        headers = super()._build_headers(additional_headers)
        # ORCID uses Accept header for content negotiation
        headers["Accept"] = "application/json"
        return headers
    
    async def exchange_code_for_token(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Exchange an ORCID authorization code for an access token.
        
        Args:
            code: Authorization code from ORCID OAuth callback
        
        Returns:
            Token response data or None if failed
        """
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
        
        try:
            # Use POST directly to token endpoint (different from base URL)
            response = await self.client.post(
                settings.ORCID_TOKEN_URL,
                data=data,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error("ORCID token exchange failed: Invalid credentials")
                return None
            logger.error(f"ORCID token exchange failed: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"ORCID token exchange failed: {e}")
            return None
    
    async def upsert_orcid_profile(
        self,
        db: AsyncSession,
        user_id: str,
        orcid_id: str,
        access_token: str,
        refresh_token: Optional[str],
        expires_in: Optional[int],
    ) -> OrcidProfile:
        """Create or update ORCID profile for a user."""
        result = await db.execute(
            select(OrcidProfile).where(OrcidProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=expires_in)
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
        logger.info(f"Upserted ORCID profile for user {user_id}")
        return profile
    
    async def fetch_orcid_record(
        self,
        orcid_id: str,
        access_token: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch ORCID record using the API.
        
        Args:
            orcid_id: ORCID identifier
            access_token: OAuth access token
        
        Returns:
            ORCID record data or None if failed
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        }
        
        try:
            return await self.get(
                f"{orcid_id}/record",
                headers=headers,
                use_cache=True,
                cache_ttl=3600
            )
        except AuthenticationError as e:
            logger.error(f"ORCID authentication failed for {orcid_id}: {e.message}")
            return None
        except ExternalAPIError as e:
            logger.error(f"ORCID API error for {orcid_id}: {e.message}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching ORCID record: {e}")
            return None
    
    def _extract_publications(
        self,
        orcid_record: Dict[str, Any]
    ) -> list[Dict[str, Any]]:
        """Extract publication data from ORCID record."""
        publications = []
        
        try:
            activities = orcid_record.get("activities", {})
            summaries = activities.get("summaries", [])
            
            for summary in summaries:
                work_group = summary.get("work-summary", [])
                for work in work_group:
                    # Extract basic work information
                    work_data = {
                        "put_code": work.get("put-code"),
                        "title": work.get("title", {}).get("title", {}).get("value", ""),
                        "type": work.get("type", ""),
                        "publication_date": self._parse_date(work.get("publication-date")),
                        "external_ids": self._extract_external_ids(work.get("external-ids", {}).get("external-id", [])),
                        "url": work.get("url", ""),
                    }
                    publications.append(work_data)
            
            logger.info(f"Extracted {len(publications)} publications from ORCID record")
        except Exception as e:
            logger.error(f"Error extracting publications: {e}")
        
        return publications
    
    def _parse_date(self, date_obj: Optional[Dict]) -> Optional[str]:
        """Parse ORCID date object to string."""
        if not date_obj:
            return None
        
        try:
            year = date_obj.get("year", {}).get("value")
            month = date_obj.get("month", {}).get("value")
            day = date_obj.get("day", {}).get("value")
            
            if year:
                if month and day:
                    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                return year
        except Exception as e:
            logger.debug(f"Error parsing date: {e}")
        
        return None
    
    def _extract_external_ids(self, external_ids: list) -> Dict[str, str]:
        """Extract external identifiers (DOI, PMID, etc.)."""
        ids = {}
        for ext_id in external_ids:
            id_type = ext_id.get("external-id-type", "").lower()
            id_value = ext_id.get("external-id-value", "")
            if id_type and id_value:
                ids[id_type] = id_value
        return ids
    
    async def sync_orcid_publications(
        self,
        db: AsyncSession,
        user_id: str,
        orcid_id: str,
        access_token: str
    ) -> int:
        """
        Sync ORCID publications to database.
        
        Args:
            db: Database session
            user_id: User ID
            orcid_id: ORCID identifier
            access_token: OAuth access token
        
        Returns:
            Number of publications synced
        """
        # Fetch ORCID record
        orcid_record = await self.fetch_orcid_record(orcid_id, access_token)
        if not orcid_record:
            logger.error(f"Failed to fetch ORCID record for {orcid_id}")
            return 0
        
        # Extract publications
        publications = self._extract_publications(orcid_record)
        if not publications:
            logger.info(f"No publications found for ORCID {orcid_id}")
            return 0
        
        # Upsert publications
        synced_count = 0
        for pub_data in publications:
            try:
                # Check if publication already exists
                result = await db.execute(
                    select(OrcidPublication).where(
                        OrcidPublication.user_id == user_id,
                        OrcidPublication.put_code == pub_data["put_code"]
                    )
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # Update existing
                    existing.title = pub_data["title"]
                    existing.publication_type = pub_data["type"]
                    existing.publication_date = pub_data["publication_date"]
                    existing.external_ids = pub_data["external_ids"]
                    existing.url = pub_data["url"]
                else:
                    # Create new
                    publication = OrcidPublication(
                        user_id=user_id,
                        orcid_id=orcid_id,
                        put_code=pub_data["put_code"],
                        title=pub_data["title"],
                        publication_type=pub_data["type"],
                        publication_date=pub_data["publication_date"],
                        external_ids=pub_data["external_ids"],
                        url=pub_data["url"],
                    )
                    db.add(publication)
                
                synced_count += 1
            except Exception as e:
                logger.error(f"Error syncing publication {pub_data.get('put_code')}: {e}")
        
        await db.commit()
        logger.info(f"Synced {synced_count} ORCID publications for user {user_id}")
        return synced_count
    
    async def refresh_access_token(
        self,
        refresh_token: str
    ) -> Optional[Dict[str, Any]]:
        """
        Refresh an expired ORCID access token.
        
        Args:
            refresh_token: Refresh token from initial OAuth flow
        
        Returns:
            New token data or None if failed
        """
        if not settings.ORCID_CLIENT_ID or not settings.ORCID_CLIENT_SECRET:
            logger.warning("ORCID_CLIENT_ID / ORCID_CLIENT_SECRET not configured")
            return None
        
        data = {
            "client_id": settings.ORCID_CLIENT_ID,
            "client_secret": settings.ORCID_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
        
        try:
            response = await self.client.post(
                settings.ORCID_TOKEN_URL,
                data=data,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"ORCID token refresh failed: {e}")
            return None


# Singleton pattern for service instance
_orcid_singleton: Optional[ORCIDService] = None

def get_orcid_service(client: Optional[httpx.AsyncClient] = None) -> ORCIDService:
    """Get or create ORCID service instance."""
    global _orcid_singleton
    if client is not None:
        return ORCIDService(client=client)
    if _orcid_singleton is None:
        _orcid_singleton = ORCIDService()
    return _orcid_singleton


# Convenience functions that use the service
async def exchange_code_for_token(code: str) -> Optional[Dict[str, Any]]:
    """Exchange ORCID authorization code for access token."""
    service = get_orcid_service()
    return await service.exchange_code_for_token(code)

async def upsert_orcid_profile(
    db: AsyncSession,
    user_id: str,
    orcid_id: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_in: Optional[int],
) -> OrcidProfile:
    """Create or update ORCID profile for a user."""
    service = get_orcid_service()
    return await service.upsert_orcid_profile(
        db, user_id, orcid_id, access_token, refresh_token, expires_in
    )

async def sync_orcid_publications(
    db: AsyncSession,
    user_id: str,
    orcid_id: str,
    access_token: str
) -> int:
    """Sync ORCID publications to database."""
    service = get_orcid_service()
    return await service.sync_orcid_publications(
        db, user_id, orcid_id, access_token
    )


# Compatibility alias for the old name used in auth.py
async def sync_orcid_works(db: AsyncSession, user_id: str, orcid_id: str) -> int:
    """Legacy wrapper — fetches profile token and delegates to sync_orcid_publications."""
    from sqlalchemy import select
    from app.models.database import OrcidProfile

    result = await db.execute(select(OrcidProfile).where(OrcidProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile or not profile.access_token:
        return 0
    return await sync_orcid_publications(db, user_id, orcid_id, profile.access_token)
