"""Tests for the Gemini File Search Store Service."""
import pytest
from unittest.mock import MagicMock, patch
from types import SimpleNamespace

from app.services.gemini_file_store import (
    GeminiFileStoreService,
    get_gemini_file_store_service,
    _user_store_cache,
)
from app.core.config import settings


@pytest.fixture(autouse=True)
def clean_cache():
    _user_store_cache.clear()
    yield
    _user_store_cache.clear()


class TestGeminiFileStoreService:
    @pytest.mark.asyncio
    async def test_get_or_create_user_store_from_cache(self):
        service = GeminiFileStoreService()
        _user_store_cache["test_user_1"] = "fileSearchStores/cached-store-123"

        result = await service.get_or_create_user_store("test_user_1")
        assert result == "fileSearchStores/cached-store-123"

    @pytest.mark.asyncio
    async def test_get_or_create_user_store_finds_existing(self, monkeypatch):
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-gemini-key")
        service = GeminiFileStoreService()

        mock_store = SimpleNamespace(
            name="fileSearchStores/existing-store-999",
            display_name="tafiti_user_user_abc",
        )
        mock_client = MagicMock()
        mock_client.file_search_stores.list.return_value = [mock_store]

        with patch.object(service, "_get_client", return_value=mock_client):
            store_name = await service.get_or_create_user_store("user_abc")

        assert store_name == "fileSearchStores/existing-store-999"
        assert _user_store_cache["user_abc"] == "fileSearchStores/existing-store-999"

    @pytest.mark.asyncio
    async def test_get_or_create_user_store_creates_new(self, monkeypatch):
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-gemini-key")
        service = GeminiFileStoreService()

        mock_new_store = SimpleNamespace(
            name="fileSearchStores/newly-created-store-555",
            display_name="tafiti_user_user_new",
        )
        mock_client = MagicMock()
        mock_client.file_search_stores.list.return_value = []
        mock_client.file_search_stores.create.return_value = mock_new_store

        with patch.object(service, "_get_client", return_value=mock_client):
            store_name = await service.get_or_create_user_store("user_new")

        assert store_name == "fileSearchStores/newly-created-store-555"
        mock_client.file_search_stores.create.assert_called_once_with(
            config={"display_name": "tafiti_user_user_new"}
        )

    @pytest.mark.asyncio
    async def test_upload_document_to_store_success(self, monkeypatch):
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-gemini-key")
        service = GeminiFileStoreService()

        mock_client = MagicMock()
        mock_client.file_search_stores.upload_to_file_search_store.return_value = SimpleNamespace(name="operations/123")

        with patch.object(service, "_get_client", return_value=mock_client):
            with patch.object(service, "get_or_create_user_store", return_value="fileSearchStores/store-xyz"):
                res = await service.upload_document_to_store(
                    user_id="user_123",
                    file_path="/path/to/paper.pdf",
                    display_name="paper.pdf",
                )

        assert res == "fileSearchStores/store-xyz"
        mock_client.file_search_stores.upload_to_file_search_store.assert_called_once_with(
            file_search_store_name="fileSearchStores/store-xyz",
            file="/path/to/paper.pdf",
            config={"display_name": "paper.pdf"},
        )

    def test_singleton(self):
        s1 = get_gemini_file_store_service()
        s2 = get_gemini_file_store_service()
        assert s1 is s2
