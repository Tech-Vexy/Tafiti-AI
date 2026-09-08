"""Tests for /api/v1/export endpoints."""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_export_pdf(client: AsyncClient, seeded_user):
    """Test PDF export returns a PDF response."""
    mock_html_instance = MagicMock()
    mock_html_instance.write_pdf.return_value = b"%PDF-1.4 fake pdf content"

    with patch("app.api.export._render_html", return_value="<html><body>Test</body></html>"):
        import sys
        mock_weasyprint = MagicMock()
        mock_weasyprint.HTML.return_value = mock_html_instance
        sys.modules["weasyprint"] = mock_weasyprint
        try:
            resp = await client.post("/api/v1/export/pdf", json={
                "title": "My Research",
                "synthesis": "AI is artificial intelligence. This synthesis covers the main findings.",
                "query": "What is AI?",
                "authors": ["Author One"],
            })
        finally:
            sys.modules.pop("weasyprint", None)

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
