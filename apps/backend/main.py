import asyncio
import hashlib
import httpx
import time
import uuid as _uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logger import setup_logging, get_logger, bind_request_id
from app.core.tracing import init_tracing, mount_metrics
from app.models.responses import HealthCheckResponse
from app.db.session import init_db
from app.db.migrate import run_migrations
from app.api import (
    auth, research, queries, recommendation, notes,
    uploads, billing, social, feedback, export,
)
from app.api import intelligence
from app.api import teams
from app.api import thesis
from app.api import writing_assist
from app.api import thesis_collaboration
from app.api import citations
from app.api import outline
from app.api import yjs_sync
from app.api import research_timeline
from app.api import systematic_review
from app.mcp.academic_server import academic_mcp
from app.core.cache import cache
from app.core.rate_limit import rate_limiter
from sqlalchemy import text

# Initialize logging
setup_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing application services...")

    migration_ok = False
    try:
        await run_migrations()
        migration_ok = True
    except FileNotFoundError:
        raise
    except Exception:
        if settings.ENVIRONMENT == "production":
            raise RuntimeError("database_migration_failed")
        logger.error("database_migration_failed")
    # Outside production, only ensure tables exist if Alembic was unavailable.
    if not migration_ok and settings.ENVIRONMENT != "production":
        try:
            await init_db()
        except Exception:
            logger.error("database_fallback_init_failed")

    try:
        await cache.connect()
    except Exception:
        logger.error("redis_connection_failed")

    # Background rate-limit entry cleanup (in-memory fallback only).
    rate_limiter.start_cleanup()

    # Initialize shared httpx client
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
    )
    logger.info("Shared HTTP client initialized.")

    # Distributed tracing (only when OTEL endpoint is configured).
    init_tracing(app)

    # Scheduled background work (subscription/trial expiry, task timeout
    # enforcement, crash recovery) runs inside Supabase via pg_cron.
    yield

    # Graceful shutdown — checkpoint all running sessions before exit
    try:
        from app.db.session import AsyncSessionLocal
        from app.services.research_checkpoint import checkpoint_service
        from sqlalchemy import select
        from app.models.database import ResearchSessionState
        async with AsyncSessionLocal() as shutdown_db:
            running = (await shutdown_db.execute(
                select(ResearchSessionState).where(
                    ResearchSessionState.status == "running"
                )
            )).scalars().all()
            for session in running:
                try:
                    await checkpoint_service.create_checkpoint(
                        session.question_id, shutdown_db,
                        trigger="shutdown",
                        summary="Graceful shutdown checkpoint"
                    )
                    session.status = "paused"
                    session.paused_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    logger.info(f"shutdown_checkpoint question={session.question_id}")
                except Exception as e:
                    logger.error(f"shutdown_checkpoint_failed question={session.question_id} error={e}")
            await shutdown_db.commit()
    except Exception as e:
        logger.error(f"graceful_shutdown_failed: {e}")

    # Shutdown
    logger.info("Shutting down application services...")
    await app.state.http_client.aclose()
    await cache.disconnect()
    try:
        from app.db.surreal import close_shared_surreal_client
        await close_shared_surreal_client()
    except Exception as e:
        logger.warning(f"Failed to close SurrealDB client: {e}")
    logger.info("Shared HTTP client closed.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# GZip compression — compresses JSON/text responses ≥ 1 KB by ~60-80%
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS — must be added after GZip so CORS headers survive compression
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)


# Request timing and structured logging middleware
SLOW_REQUEST_THRESHOLD_S: float = 1.0  # warn if request takes > 1 s

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()

    # Accept client request ID or generate one
    request_id = request.headers.get("X-Request-ID") or str(_uuid.uuid4())
    bind_request_id(request_id)

    # Resolve client IP (respect X-Forwarded-For behind reverse proxy)
    forwarded = request.headers.get("x-forwarded-for")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )



    logger.info(
        "request_started",
        extra={
            "method": request.method,
            "path_url": request.url.path,
            "client_ip": client_ip,
            "status_code": "pending",
        },
    )

    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = f"{process_time:.4f}"
        response.headers["X-Request-ID"] = request_id
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Rate limit headers — lets clients self-throttle
        rl_info = getattr(request.state, "rate_limit", None)
        if rl_info and rl_info.get("limit", 0) > 0:
            response.headers["X-RateLimit-Limit"] = str(rl_info["limit"])
            response.headers["X-RateLimit-Remaining"] = str(rl_info["remaining"])
            response.headers["X-RateLimit-Reset"] = str(rl_info["reset"])

        log_data = {
            "method": request.method,
            "path_url": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(process_time * 1000, 2),
            "client_ip": client_ip,
        }
        if process_time >= SLOW_REQUEST_THRESHOLD_S:
            logger.warning("request_slow", extra=log_data)
        elif response.status_code >= 500:
            logger.error("request_error", extra=log_data)
        elif response.status_code >= 400:
            logger.warning("request_client_error", extra=log_data)
        else:
            logger.info("request_completed", extra=log_data)

        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            "request_failed",
            extra={
                "method": request.method,
                "path_url": request.url.path,
                "duration_ms": round(process_time * 1000, 2),
                "client_ip": client_ip,
            },
        )
        raise e


# Exception handlers
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with proper logging and CORS headers."""
    logger.warning(
        "http_exception",
        extra={
            "status_code": exc.status_code,
            "path_url": request.url.path,
            "method": request.method,
        },
    )
    
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

    # Preserve headers carried on the exception (e.g. WWW-Authenticate from a
    # failed auth, Retry-After from a 429 rate-limit rejection).
    if exc.headers:
        response.headers.update(exc.headers)

    # Ensure CORS headers are present
    origin = request.headers.get("origin")
    if origin and origin in settings.ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(
        "unhandled_error",
        extra={
            "path_url": request.url.path,
            "method": request.method,
        },
    )

    # NEVER expose internals to the client — log full details server-side only
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."}
    )

    origin = request.headers.get("origin")
    if origin and origin in settings.ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response


# Health check
# External services probed by /health — name -> (configured_url, default_url)
EXTERNAL_SERVICES = {
    "openalex": (settings.OPENALEX_API_URL, "https://api.openalex.org"),
    "core": (settings.CORE_API_URL, "https://api.core.ac.uk"),
    "elsevier": (settings.SCOPUS_API_URL, "https://api.elsevier.com"),
    "springer": (settings.SPRINGER_API_URL, "https://api.springernature.com"),
    "parallel": ("https://api.parallel.ai", "https://api.parallel.ai"),
}

# Probe results are cached so a poller hitting /health every few seconds doesn't
# hammer every upstream vendor.
_external_health_cache: dict = {}
EXTERNAL_HEALTH_CACHE_TTL_S = 120


async def _probe_external(service_name: str, url: str) -> str:
    """Return the health status for an upstream service, cached for TTL seconds."""
    now = time.time()
    cached = _external_health_cache.get(service_name)
    if cached and now - cached["at"] < EXTERNAL_HEALTH_CACHE_TTL_S:
        return cached["status"]
    try:
        response = await app.state.http_client.get(
            url, timeout=5.0, follow_redirects=True
        )
        status = "healthy" if response.status_code < 500 else "degraded"
    except Exception:
        status = "unreachable"
    _external_health_cache[service_name] = {"status": status, "at": now}
    return status


@app.get("/health/live")
async def health_live():
    """Liveness: the process is up and serving requests."""
    return {"status": "ok", "version": settings.VERSION}


@app.get("/ready")
async def ready():
    """Readiness: core dependencies (DB + cache) are reachable."""
    from app.db.session import engine

    dependencies = {}
    ready = True

    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        dependencies["database"] = "healthy"
    except Exception:
        dependencies["database"] = "unhealthy"
        ready = False

    try:
        await cache.ping()
        dependencies["redis"] = "healthy"
    except Exception:
        dependencies["redis"] = "unhealthy"
        ready = False

    return {
        "status": "ready" if ready else "not_ready",
        "dependencies": dependencies,
    }


@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Comprehensive health check with dependency status."""
    from app.db.session import engine
    
    dependencies = {}
    overall_status = "healthy"
    
    # Check database connection
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        dependencies["database"] = "healthy"
    except Exception:
        dependencies["database"] = "unhealthy"
        overall_status = "degraded"
        logger.error("health_check_failed", extra={"dependency": "database"})

    # Check Redis connection
    try:
        await cache.ping()
        dependencies["redis"] = "healthy"
    except Exception:
        dependencies["redis"] = "unhealthy"
        overall_status = "degraded"
        logger.error("health_check_failed", extra={"dependency": "redis"})

    # Check Vector Store (pgvector / Supabase) — sync SDK in a worker thread
    try:
        from app.services.vector_service import vector_store
        await asyncio.to_thread(vector_store.get_collection_stats)
        dependencies["vector_store"] = "healthy"
    except Exception as e:
        dependencies["vector_store"] = "degraded"
        logger.warning(f"Vector store health check note: {e}")
    
    # Check Supabase Storage (if configured)
    if settings.SUPABASE_URL:
        try:
            from app.services.supabase_storage import get_supabase_client
            sb = await asyncio.to_thread(get_supabase_client)
            if sb:
                dependencies["supabase"] = "healthy"
            else:
                dependencies["supabase"] = "unreachable"
                overall_status = "degraded"
        except Exception:
            dependencies["supabase"] = "unreachable"
            overall_status = "degraded"
            logger.error("health_check_failed", extra={"dependency": "supabase"})

    # Check external services (basic connectivity for configured services in .env)
    if settings.TESTING:
        # Skip upstream probes in tests
        for service_name, (service_url, default_url) in EXTERNAL_SERVICES.items():
            if service_url:
                dependencies[service_name] = "healthy"
    else:
        for service_name, (service_url, default_url) in EXTERNAL_SERVICES.items():
            if not service_url:
                continue
            status = await _probe_external(service_name, service_url)
            dependencies[service_name] = status
            if status == "degraded":
                # Unreachable externals don't degrade the overall health.
                overall_status = "degraded"
    
    return HealthCheckResponse(
        status=overall_status,
        version=settings.VERSION,
        dependencies=dependencies
    )


# Rate limit tiers: (max_requests, window_seconds)
_RL_AUTH     = (60, 60)    # 60/min — sensitive auth operations
_RL_WRITE    = (120, 60)   # 120/min — create/update/delete
_RL_READ     = (300, 60)   # 300/min — list/get/read
_RL_BURST    = (60, 60)    # 60/min  — AI, export, search
_RL_WEBHOOK  = (200, 60)   # 200/min — payment callbacks


async def _rate_limit(request: Request, _max: int = 60, _window: int = 60):
    """Lightweight per-request rate limiter injected via router dependencies."""
    if settings.TESTING or settings.DEBUG:
        request.state.rate_limit = {"limit": _max, "remaining": _max, "reset": _window}
        return  # skip enforcement in tests and debug mode

    # Determine unique client identifier with proxy support
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    identifier = client_ip
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Hash the full token so identifiers are stable per session without
        # exposing token material (e.g. via header mirrors/logs).
        token_hash = hashlib.sha256(auth_header[7:].encode()).hexdigest()[:32]
        identifier = f"user:{token_hash}"

    # Localhost exemption is only for development; never trust it in production.
    if not settings.ENVIRONMENT == "production" and identifier in ("127.0.0.1", "localhost", "::1"):
        request.state.rate_limit = {"limit": _max, "remaining": _max, "reset": _window}
        return

    allowed, remaining, reset_in = await rate_limiter.is_allowed(identifier, _max, _window)
    request.state.rate_limit = {"limit": _max, "remaining": remaining, "reset": reset_in}
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(reset_in)}
        )


def _rl(max_requests: int, window_seconds: int = 60):
    """Return a Depends that enforces the given rate limit."""
    async def _dep(request: Request):
        return await _rate_limit(request, max_requests, window_seconds)
    return Depends(_dep)


# API routes (with per-group rate limiting)
app.include_router(auth.router,          prefix=f"{settings.API_V1_PREFIX}/auth",          tags=["Authentication"],       dependencies=[_rl(*_RL_AUTH)])
app.include_router(research.router,      prefix=f"{settings.API_V1_PREFIX}/research",      tags=["Research"],             dependencies=[_rl(*_RL_BURST)])
app.include_router(recommendation.router,prefix=f"{settings.API_V1_PREFIX}/research",      tags=["Recommendations"],      dependencies=[_rl(*_RL_BURST)])
app.include_router(queries.router,       prefix=f"{settings.API_V1_PREFIX}/queries",       tags=["Saved Queries"],        dependencies=[_rl(*_RL_WRITE)])
app.include_router(notes.router,         prefix=f"{settings.API_V1_PREFIX}/notes",         tags=["Research Notes"],       dependencies=[_rl(*_RL_WRITE)])
app.include_router(uploads.router,       prefix=f"{settings.API_V1_PREFIX}/uploads",       tags=["File Uploads"],         dependencies=[_rl(*_RL_AUTH)])
app.include_router(billing.router,       prefix=f"{settings.API_V1_PREFIX}/billing",       tags=["Billing & Subscription"],dependencies=[_rl(*_RL_AUTH)])
app.include_router(social.router,        prefix=f"{settings.API_V1_PREFIX}/social",        tags=["Social Networking"],    dependencies=[_rl(*_RL_WRITE)])
app.include_router(feedback.router,      prefix=f"{settings.API_V1_PREFIX}/feedback",      tags=["Feedback"],             dependencies=[_rl(*_RL_WRITE)])
app.include_router(export.router,        prefix=f"{settings.API_V1_PREFIX}/export",        tags=["PDF Export"],            dependencies=[_rl(*_RL_BURST)])
app.include_router(intelligence.router, prefix=f"{settings.API_V1_PREFIX}/intelligence", tags=["Research Intelligence"], dependencies=[_rl(*_RL_BURST)])
app.include_router(teams.router,          prefix=f"{settings.API_V1_PREFIX}",              tags=["Research Teams"],               dependencies=[_rl(*_RL_WRITE)])
app.include_router(thesis.router,        prefix=f"{settings.API_V1_PREFIX}/thesis",        tags=["Thesis Editor"],              dependencies=[_rl(*_RL_WRITE)])
app.include_router(writing_assist.router, prefix=f"{settings.API_V1_PREFIX}/thesis",   tags=["Writing Assistance"],          dependencies=[_rl(*_RL_BURST)])
app.include_router(thesis_collaboration.router, prefix=f"{settings.API_V1_PREFIX}/thesis", tags=["Thesis Collaboration"],        dependencies=[_rl(*_RL_WRITE)])
app.include_router(citations.router,       prefix=f"{settings.API_V1_PREFIX}/thesis", tags=["Citations"],                   dependencies=[_rl(*_RL_WRITE)])
app.include_router(outline.router,        prefix=f"{settings.API_V1_PREFIX}/thesis", tags=["Thesis Outline"],                 dependencies=[_rl(*_RL_BURST)])
app.include_router(yjs_sync.router,      prefix=f"{settings.API_V1_PREFIX}/yjs", tags=["Yjs CRDT Sync"],                    dependencies=[_rl(*_RL_WRITE)])
app.include_router(research_timeline.router, prefix=f"{settings.API_V1_PREFIX}/enhancement", tags=["Research Timeline"], dependencies=[_rl(*_RL_BURST)])
app.include_router(systematic_review.router, prefix=f"{settings.API_V1_PREFIX}/enhancement", tags=["Systematic Review"], dependencies=[_rl(*_RL_WRITE)])

# Model Context Protocol (MCP) SSE server for external tool access (Gemini Deep Research)
app.mount(f"{settings.API_V1_PREFIX}/mcp", academic_mcp.sse_app())

# Prometheus metrics endpoint (only when ENABLE_PROMETHEUS is set).
mount_metrics(app)


@app.get("/")
async def root():
    return {
        "message": "Tafiti AI",
        "version": settings.VERSION,
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        reload_dirs=["app"] if settings.DEBUG else None,
        reload_excludes=[".venv", "__pycache__", "*.pyc", "*.log", "tests", ".pytest_cache"] if settings.DEBUG else None,
    )
