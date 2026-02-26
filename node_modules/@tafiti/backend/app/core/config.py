from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Research Assistant API"
    VERSION: str = "2.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/research_db"
    DATABASE_ECHO: bool = False
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 3600
    
    # LLM Providers
    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    DEFAULT_LLM_PROVIDER: str = "groq"
    DEFAULT_LLM_MODEL: str = "llama3-70b-8192"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2000
    
    # Vector Database
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "research_queries"
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    VECTOR_SEARCH_K: int = 5
    
    # OpenAlex
    OPENALEX_EMAIL: str
    OPENALEX_API_URL: str = "https://api.openalex.org"
    OPENALEX_API_KEY: Optional[str] = None
    MAX_PAPERS_PER_QUERY: int = 50
    DEFAULT_PAPERS_LIMIT: int = 10

    # Google / Gemini
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_DEFAULT_MODEL: str = "gemini-1.5-flash"

    # CORE API (https://core.ac.uk/services/api)
    CORE_API_KEY: Optional[str] = None
    CORE_API_URL: str = "https://api.core.ac.uk/v3"

    # Elsevier / Scopus (https://dev.elsevier.com)
    ELSEVIER_API_KEY: Optional[str] = None
    ELSEVIER_INST_TOKEN: Optional[str] = None   # institutional token for full-text
    SCOPUS_API_URL: str = "https://api.elsevier.com/content/search/scopus"

    # PubMed / NCBI E-utilities (https://www.ncbi.nlm.nih.gov/home/develop/api/)
    PUBMED_API_KEY: Optional[str] = None        # raises rate limit 3→10 req/s
    PUBMED_API_URL: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    # DOAJ — Directory of Open Access Journals (no key required)
    DOAJ_API_URL: str = "https://doaj.org/api/search/articles"

    # AJOL — African Journals Online (OAI-PMH, no key required)
    AJOL_OAI_URL: str = "https://www.ajol.info/index.php/ajol/oai"

    # AfricArXiv via DataCite REST API (no key required)
    AFRICARXIV_API_URL: str = "https://api.datacite.org/dois"

    # HuggingFace
    HF_TOKEN: Optional[str] = None

    # Paystack
    PAYSTACK_SECRET_KEY: Optional[str] = None
    PAYSTACK_PUBLIC_KEY: Optional[str] = None
    PAYSTACK_CALLBACK_URL: Optional[str] = None

    # Pinata (IPFS)
    PINATA_API_KEY: Optional[str] = None
    PINATA_API_SECRET: Optional[str] = None
    PINATA_JWT: Optional[str] = None
    PINATA_GATEWAY: Optional[str] = None
    
    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://app.tafitiai.co.ke",
        "https://www.tafitiai.co.ke",
        "https://tafitiai-app.netlify.app",
    ]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ORCID OAuth
    ORCID_CLIENT_ID: Optional[str] = None
    ORCID_CLIENT_SECRET: Optional[str] = None
    ORCID_API_URL: str = "https://pub.orcid.org/v3.0"
    ORCID_TOKEN_URL: str = "https://orcid.org/oauth/token"

    # Email / SMTP (for Ghost Profile invites)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@tafitiai.co.ke"
    FRONTEND_URL: str = "https://app.tafitiai.co.ke"

    # Pydantic AI Model Routing
    CRITIC_MODEL: str = "groq:llama-3.3-70b-versatile"
    DRAFTER_MODEL: str = "gemini-1.5-pro"

    # Cryptographic Anchoring (SHA-256 draft hashing)
    ANCHOR_WEBHOOK_URL: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
