try:
    print("Importing settings...")
    from app.core.config import settings
    print(f"Settings loaded: {settings.APP_NAME}")
    
    print("Importing app...")
    from main import app
    print("App imported successfully")
    
    print("Importing OpenAlexService...")
    from app.services.openalex_service import OpenAlexService
    service = OpenAlexService()
    print(f"Service initialized with API Key: {service.api_key}")
    
    print("All imports successful!")
except Exception as e:
    import traceback
    print(f"Error occurred: {e}")
    traceback.print_exc()
