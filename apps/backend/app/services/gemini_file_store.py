"""
Gemini File Search Store Service
================================
Manages persistent document corpora in Google Gemini File Search Stores
for grounding Deep Research queries on user-uploaded academic papers.
"""

import asyncio
from typing import Optional, Dict
from google import genai

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("gemini_file_store")

# In-memory mapping of user_id -> store_name
_user_store_cache: Dict[str, str] = {}
_cache_lock = asyncio.Lock()


class GeminiFileStoreService:
    def __init__(self):
        self._client: Optional[genai.Client] = None

    def _get_client(self) -> Optional[genai.Client]:
        if not self._client and settings.gemini_api_key:
            self._client = genai.Client(api_key=settings.gemini_api_key)
        return self._client

    async def get_or_create_user_store(self, user_id: str) -> Optional[str]:
        """
        Retrieves or creates a dedicated Gemini File Search Store for the user.
        Returns the resource name of the store (e.g., 'fileSearchStores/...').
        """
        async with _cache_lock:
            if user_id in _user_store_cache:
                return _user_store_cache[user_id]

            client = self._get_client()
            if not client:
                logger.warning("Gemini API key not configured; cannot manage File Search Stores.")
                return None

            store_display_name = f"tafiti_user_{user_id}"

            try:
                # 1. Check existing stores in a background thread
                def _find_or_create():
                    try:
                        stores = list(client.file_search_stores.list())
                        for s in stores:
                            if getattr(s, "display_name", None) == store_display_name:
                                return s.name
                    except Exception as e:
                        logger.warning(f"Error listing file search stores: {e}")

                    # 2. Create store if not found
                    new_store = client.file_search_stores.create(
                        config={"display_name": store_display_name}
                    )
                    logger.info(f"Created new Gemini File Search Store: {new_store.name} for user {user_id}")
                    return new_store.name

                store_name = await asyncio.to_thread(_find_or_create)
                if store_name:
                    _user_store_cache[user_id] = store_name
                return store_name

            except Exception as e:
                logger.error(f"Failed to get or create Gemini File Search Store for user {user_id}: {e}", exc_info=True)
                return None

    async def upload_document_to_store(
        self,
        user_id: str,
        file_path: str,
        display_name: str,
    ) -> Optional[str]:
        """
        Uploads and indexes a document in the user's Gemini File Search Store.
        Returns the store name upon successful scheduling.
        """
        client = self._get_client()
        if not client:
            return None

        store_name = await self.get_or_create_user_store(user_id)
        if not store_name:
            logger.error(f"Cannot upload document: store could not be resolved for user {user_id}")
            return None

        def _upload():
            logger.info(f"Uploading document '{display_name}' to store {store_name}...")
            operation = client.file_search_stores.upload_to_file_search_store(
                file_search_store_name=store_name,
                file=file_path,
                config={"display_name": display_name[:64]}
            )
            return operation

        try:
            await asyncio.to_thread(_upload)
            logger.info(f"Document '{display_name}' upload dispatched to Gemini File Search Store {store_name}")
            return store_name
        except Exception as e:
            logger.error(f"Failed to upload document to Gemini File Search Store: {e}", exc_info=True)
            return None

    def get_cached_store(self, user_id: str) -> Optional[str]:
        """Synchronously check if a store is cached in memory for the user."""
        return _user_store_cache.get(user_id)


_file_store_singleton: Optional[GeminiFileStoreService] = None


def get_gemini_file_store_service() -> GeminiFileStoreService:
    global _file_store_singleton
    if _file_store_singleton is None:
        _file_store_singleton = GeminiFileStoreService()
    return _file_store_singleton
