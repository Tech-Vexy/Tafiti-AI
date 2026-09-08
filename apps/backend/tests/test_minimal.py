from app.core.config import settings

def test_settings_load():
    assert settings.APP_NAME == "Research Assistant API"
    assert settings.VERSION == "2.0.0"

def test_openalex_service_init():
    from app.services.openalex_service import OpenAlexService
    service = OpenAlexService()
    assert service.api_key == settings.OPENALEX_API_KEY
