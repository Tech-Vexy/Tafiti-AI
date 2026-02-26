import httpx
import logging
import time
import traceback
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _slowapi_available = True
except ImportError:
    _slowapi_available = False

from app.core.config import settings
from app.core.logger import setup_logging, get_logger
from app.db.session import init_db
from app.api import (
    auth, research, queries, recommendation, notes,
    uploads, billing, social, collaboration, feedback, export,
)
from app.api import ghost_profiles, bounties, sandboxes, anchors
from app.core.cache import cache
from app.db.session import AsyncSessionLocal
from app.models.database import User
from sqlalchemy import select, update

# Initialize logging
setup_logging()
logger = get_logger("main")

# Rate limiter — gracefully degraded if slowapi not installed
if _slowapi_available:
    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
else:
    limiter = None


async def _expire_subscriptions():
    """Background loop: mark expired subscriptions every hour."""
    from datetime import datetime
    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.utcnow()
                await db.execute(
                    update(User)
                    .where(
                        User.subscription_status == "active",
                        User.subscription_ends_at != None,
                        User.subscription_ends_at < now,
                    )
                    .values(subscription_status="expired")
                )
                await db.execute(
                    update(User)
                    .where(
                        User.subscription_status == "trialing",
                        User.trial_ends_at != None,
                        User.trial_ends_at < now,
                    )
                    .values(subscription_status="expired")
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Subscription expiry job failed: {e}")
        await asyncio.sleep(3600)  # run every hour


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing application services...")

    try:
        await init_db()
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

    try:
        await cache.connect()
    except Exception as e:
        logger.error(f"Redis cache connection failed: {e}")

    # Initialize shared httpx client
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
    )
    logger.info("Shared HTTP client initialized.")

    # Start subscription expiry background task
    expiry_task = asyncio.create_task(_expire_subscriptions())
    logger.info("Subscription expiry background job started.")

    yield

    expiry_task.cancel()
    try:
        await expiry_task
    except asyncio.CancelledError:
        pass

    # Shutdown
    logger.info("Shutting down application services...")
    await app.state.http_client.aclose()
    await cache.disconnect()
    logger.info("Shared HTTP client closed.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Rate limiting via slowapi
if _slowapi_available and limiter:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# GZip compression — compresses JSON/text responses ≥ 1 KB by ~60-80%
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS — must be added after GZip so CORS headers survive compression
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing and logging middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Incoming request: {request.method} {request.url}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        logger.info(f"Processed {request.method} {request.url} in {process_time:.4f}s - Status: {response.status_code}")
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(f"Failed processing {request.method} {request.url} in {process_time:.4f}s - Error: {str(e)}")
        raise e


# Exception handlers
@app.exception_handler(HTTPException if 'HTTPException' in globals() else 404) # Placeholder for more specific handlers if needed
async def custom_http_exception_handler(request: Request, exc):
    return JSONResponse(
        status_code=exc.status_code if hasattr(exc, 'status_code') else 404,
        content={"detail": exc.detail if hasattr(exc, 'detail') else "Resource not found"}
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    tb = traceback.format_exc()
    logger.error(f"Unhandled 500 error: {str(exc)}\n{tb}")
    
    # Explicitly add CORS headers to ensure the browser can see the error
    response = JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error.",
            "error_type": type(exc).__name__,
            "error_msg": str(exc),
            "traceback": tb.splitlines()[-10:] # Show last 10 lines of traceback
        }
    )
    
    # Match the origins from settings
    origin = request.headers.get("origin")
    if origin in settings.ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
    return response


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "timestamp": time.time()
    }


# API routes
app.include_router(auth.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Authentication"])
app.include_router(research.router, prefix=f"{settings.API_V1_PREFIX}/research", tags=["Research"])
app.include_router(recommendation.router, prefix=f"{settings.API_V1_PREFIX}/research", tags=["Recommendations"])
app.include_router(queries.router, prefix=f"{settings.API_V1_PREFIX}/queries", tags=["Saved Queries"])
app.include_router(notes.router, prefix=f"{settings.API_V1_PREFIX}/notes", tags=["Research Notes"])
app.include_router(uploads.router, prefix=f"{settings.API_V1_PREFIX}/uploads", tags=["File Uploads"])
app.include_router(billing.router, prefix=f"{settings.API_V1_PREFIX}/billing", tags=["Billing & Subscription"])
app.include_router(social.router, prefix=f"{settings.API_V1_PREFIX}/social", tags=["Social Networking"])
app.include_router(collaboration.router, prefix=f"{settings.API_V1_PREFIX}/collaboration", tags=["Collaboration"])
app.include_router(feedback.router, prefix=f"{settings.API_V1_PREFIX}/feedback", tags=["Feedback"])
app.include_router(ghost_profiles.router, prefix=f"{settings.API_V1_PREFIX}/ghost-profiles", tags=["Ghost Profiles"])
app.include_router(bounties.router, prefix=f"{settings.API_V1_PREFIX}/bounties", tags=["Micro-Bounties"])
app.include_router(sandboxes.router, prefix=f"{settings.API_V1_PREFIX}/sandboxes", tags=["Institutional Sandboxes"])
app.include_router(anchors.router, prefix=f"{settings.API_V1_PREFIX}/anchors", tags=["Cryptographic Anchoring"])
app.include_router(export.router, prefix=f"{settings.API_V1_PREFIX}/export", tags=["PDF Export"])


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
        reload=settings.DEBUG
    )
