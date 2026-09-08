from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache
import os
import logging

logger = logging.getLogger("config")


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Research Assistant API"
    VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    TESTING: bool = False
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"
    
    # Security
    SECRET_KEY: str = "dev-only-not-for-production-please-change-me-32chars!!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/research_db"
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 3600
    
    # LLM Providers
    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None
    NVIDIA_BUILD_API_KEY: Optional[str] = None
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_DEFAULT_MODEL: str = "deepseek-ai/deepseek-v4-flash-0731"

    @property
    def nvidia_api_key(self) -> Optional[str]:
        """Return NVIDIA_API_KEY, falling back to NVIDIA_BUILD_API_KEY."""
        return self.NVIDIA_API_KEY or self.NVIDIA_BUILD_API_KEY
    OPENROUTER_DEFAULT_MODEL: str = "openrouter/free"
    DEFAULT_LLM_PROVIDER: str = "nvidia"
    DEFAULT_LLM_MODEL: str = "deepseek-ai/deepseek-v4-flash-0731"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2000
    
    # Vector Database (pgvector on Supabase / Neon PostgreSQL)
    VECTOR_BACKEND: str = "pgvector"  # "pgvector" or "qdrant"
    VECTOR_DIMENSION: int = 384       # Dimension for all-MiniLM-L6-v2
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "research_queries"
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    VECTOR_SEARCH_K: int = 5
    
    # OpenAlex
    OPENALEX_EMAIL: str = "test@example.com"
    OPENALEX_API_URL: str = "https://api.openalex.org"
    OPENALEX_API_KEY: Optional[str] = None
    MAX_PAPERS_PER_QUERY: int = 50
    DEFAULT_PAPERS_LIMIT: int = 10

    # Google / Gemini (Gemini 3.x Series)
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_DEFAULT_MODEL: str = "gemini-3.5-pro"

    @property
    def gemini_api_key(self) -> Optional[str]:
        """Return GEMINI_API_KEY, falling back to GOOGLE_API_KEY for backward compat."""
        return self.GEMINI_API_KEY or self.GOOGLE_API_KEY

    # Gemini Deep Research agent (Interactions API, preview)
    # https://ai.google.dev/gemini-api/docs/deep-research
    GEMINI_DEEP_RESEARCH_AGENT: str = "deep-research-preview-04-2026"
    GEMINI_DEEP_RESEARCH_MAX_AGENT: str = "deep-research-max-preview-04-2026"
    GEMINI_DEEP_RESEARCH_THINKING_SUMMARIES: str = "none"  # "auto" or "none"
    GEMINI_DEEP_RESEARCH_VISUALIZATION: str = "auto"       # "auto" or "off"
    GEMINI_DEEP_RESEARCH_COLLABORATIVE_PLANNING: bool = False

    # CORE API (https://core.ac.uk/services/api)
    CORE_API_KEY: Optional[str] = None
    CORE_API_URL: str = "https://api.core.ac.uk/v3"

    # Elsevier / Scopus (https://dev.elsevier.com)
    ELSEVIER_API_KEY: Optional[str] = None
    ELSEVIER_INST_TOKEN: Optional[str] = None   # institutional token for full-text
    SCOPUS_API_URL: str = "https://api.elsevier.com/content/search/scopus"

    # Springer Nature (https://dev.springernature.com)
    # Mirrors Meta API (versioned metadata) + Open Access API (OA full text)
    SPRINGER_META_API_KEY: Optional[str] = None
    SPRINGER_OPEN_ACCESS_API_KEY: Optional[str] = None
    SPRINGER_API_KEY: Optional[str] = None
    SPRINGER_API_URL: str = "https://api.springernature.com"
    SPRINGER_META_API_URL: str = "https://api.springernature.com/meta/v2/json"
    SPRINGER_OPENACCESS_API_URL: str = "https://api.springernature.com/openaccess/json"
    SPRINGER_RATE_LIMIT_PER_MINUTE: int = 100  # free tier: 100 hits/min (standard: 5 req/s)

    @property
    def springer_meta_key(self) -> Optional[str]:
        """Return SPRINGER_META_API_KEY, falling back to SPRINGER_API_KEY."""
        return self.SPRINGER_META_API_KEY or self.SPRINGER_API_KEY

    @property
    def springer_oa_key(self) -> Optional[str]:
        """Return SPRINGER_OPEN_ACCESS_API_KEY, falling back to SPRINGER_API_KEY."""
        return self.SPRINGER_OPEN_ACCESS_API_KEY or self.SPRINGER_API_KEY

    # DOAJ — Directory of Open Access Journals (no key required)
    DOAJ_API_URL: str = "https://doaj.org/api/search/articles"

    # AJOL — African Journals Online (OAI-PMH, no key required)
    AJOL_OAI_URL: str = "https://www.ajol.info/index.php/ajol/oai"

    # AfricArXiv via DataCite REST API (no key required)
    AFRICARXIV_API_URL: str = "https://api.datacite.org/dois"

    # Parallel Web Search API (https://parallel.ai)
    PARALLEL_API_KEY: Optional[str] = None

    # HuggingFace
    HF_TOKEN: Optional[str] = None

    # Paystack
    PAYSTACK_SECRET_KEY: Optional[str] = None
    PAYSTACK_PUBLIC_KEY: Optional[str] = None
    PAYSTACK_CALLBACK_URL: Optional[str] = None

    # Supabase (supports publishable key, service role key, or legacy anon key)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_PUBLISHABLE_KEY: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "research-pdfs"

    @property
    def supabase_key(self) -> Optional[str]:
        """Return active Supabase key (SUPABASE_KEY, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_ANON_KEY)."""
        return self.SUPABASE_KEY or self.SUPABASE_PUBLISHABLE_KEY or self.SUPABASE_ANON_KEY
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://app.tafitiai.co.ke",
        "https://www.tafitiai.co.ke",
        "https://tafitiai-app.netlify.app",
    ]

    # Clerk Configuration
    # Admin emails that get superuser on first login
    ADMIN_EMAILS: List[str] = []

    CLERK_DOMAIN: Optional[str] = None
    CLERK_AUDIENCE: List[str] = [
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

    # Pydantic AI Model Routing (Drafter & Critic via OpenRouter)
    CRITIC_MODEL: str = "openrouter:openrouter/free"
    DRAFTER_MODEL: str = "openrouter:openrouter/free"

    # Cryptographic Anchoring (SHA-256 draft hashing)
    ANCHOR_WEBHOOK_URL: Optional[str] = None

    def validate_config(self) -> None:
        """Validate critical configuration settings."""
        if self.ENVIRONMENT == "production":
            # Secrets must be set and not be the dev defaults
            _dev_key = "dev-only-not-for-production-please-change-me-32chars!!"
            if not self.SECRET_KEY or self.SECRET_KEY == _dev_key or len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be set to a unique value >= 32 chars in production")
            if not self.DATABASE_URL or "user:pass@" in self.DATABASE_URL:
                raise ValueError("DATABASE_URL must point to a real database in production")
            if not self.OPENALEX_EMAIL or self.OPENALEX_EMAIL == "test@example.com":
                raise ValueError("OPENALEX_EMAIL must be a real email in production")
            if not self.CLERK_DOMAIN:
                raise ValueError("CLERK_DOMAIN is required in production")
            if not self.gemini_api_key:
                raise ValueError("GEMINI_API_KEY is required in production")
            if not self.PAYSTACK_SECRET_KEY:
                logger.warning("PAYSTACK_SECRET_KEY not set — billing features will not work")

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance with validation."""
    settings = Settings()
    settings.validate_config()
    return settings


settings = get_settings()
