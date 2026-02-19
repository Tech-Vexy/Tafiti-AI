import pytest
from app.core.config import settings

def test_settings_load():
    assert settings.APP_NAME == "Research Assistant API"
    assert settings.OPENALEX_API_KEY == "Cc2t4kmuDyoZuNw6EdCKXd"

def test_openalex_service_init():
    from app.services.openalex_service import OpenAlexService
    service = OpenAlexService()
    assert service.api_key == "Cc2t4kmuDyoZuNw6EdCKXd"
