"""
Supabase Storage Service
=========================
Stores research PDFs in a
Supabase Storage bucket with user-scoped paths.

Bucket structure:
    research-pdfs/
        {user_id}/
            {timestamp}_{filename}
"""

from typing import Optional
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("supabase_storage")

_client = None


def _get_client():
    """Lazy-initialise the Supabase client (singleton)."""
    global _client
    if _client is None:
        key = settings.supabase_key or settings.SUPABASE_KEY
        if not settings.SUPABASE_URL or not key:
            logger.error("Supabase credentials not configured")
            return None
        try:
            from supabase import create_client
            _client = create_client(settings.SUPABASE_URL, key)
        except Exception as e:
            logger.error(f"Failed to create Supabase client: {e}")
            return None
    return _client


async def upload_file(
    file_content: bytes,
    filename: str,
    user_id: str,
    content_type: str = "application/pdf",
) -> Optional[str]:
    """
    Upload a file to Supabase Storage and return the storage path.

    Files are stored under: {bucket}/{user_id}/{filename}
    """
    client = _get_client()
    if not client:
        return None

    import time
    safe_filename = f"{int(time.time())}_{filename}"
    path = f"{user_id}/{safe_filename}"
    bucket = settings.SUPABASE_STORAGE_BUCKET

    try:
        # Ensure bucket exists (idempotent)
        try:
            client.storage.get_bucket(bucket)
        except Exception:
            try:
                client.storage.create_bucket(bucket, options={"public": False})
                logger.info(f"Created storage bucket: {bucket}")
            except Exception as bucket_err:
                # Bucket may already exist (race condition)
                if "already exists" not in str(bucket_err).lower():
                    logger.warning(f"Bucket creation issue: {bucket_err}")

        result = client.storage.from_(bucket).upload(
            path=path,
            file=file_content,
            file_options={"content-type": content_type, "upsert": "false"},
        )

        logger.info(f"File uploaded to Supabase Storage: {bucket}/{path}")
        return path

    except Exception as e:
        logger.error(f"Failed to upload to Supabase Storage: {e}")
        return None


async def get_signed_url(path: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a signed URL for a stored file.
    """
    client = _get_client()
    if not client:
        return None

    bucket = settings.SUPABASE_STORAGE_BUCKET

    try:
        result = client.storage.from_(bucket).create_signed_url(
            path=path,
            expires_in=expires_in,
        )
        return result.get("signedURL") or result.get("signed_url")
    except Exception as e:
        logger.error(f"Failed to generate signed URL: {e}")
        return None


async def delete_file(path: str) -> bool:
    """
    Delete a file from Supabase Storage.
    """
    client = _get_client()
    if not client:
        return False

    bucket = settings.SUPABASE_STORAGE_BUCKET

    try:
        client.storage.from_(bucket).remove([path])
        logger.info(f"File deleted from Supabase Storage: {bucket}/{path}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete from Supabase Storage: {e}")
        return False


def get_supabase_client():
    """Return the raw Supabase client for health checks."""
    return _get_client()
