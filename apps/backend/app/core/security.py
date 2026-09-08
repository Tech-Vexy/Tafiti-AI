from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request
import asyncio
import time
import traceback

from jose import jwt, JWTError

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("security")

security = HTTPBearer()

# JWKS cache with async lock
jwks_cache = {"keys": [], "expires": 0}
_jwks_lock = asyncio.Lock()


def _clerk_domain() -> str:
    # Prefer settings, fall back to env via settings model; no hardcoded prod domain
    domain = getattr(settings, "CLERK_DOMAIN", None)
    if domain:
        return domain
    import os
    return os.getenv("CLERK_DOMAIN", "")

def _clerk_jwks_url() -> str:
    domain = _clerk_domain()
    if not domain:
        return ""
    return f"https://{domain}/.well-known/jwks.json"

def _clerk_issuer() -> str:
    domain = _clerk_domain()
    if not domain:
        return ""
    return f"https://{domain}"


async def get_jwks(request: Request = None):
    now = time.time()
    if now < jwks_cache["expires"] and jwks_cache["keys"]:
        return jwks_cache["keys"]

    async with _jwks_lock:
        # double-check after acquiring lock
        now = time.time()
        if now < jwks_cache["expires"] and jwks_cache["keys"]:
            return jwks_cache["keys"]

        url = _clerk_jwks_url()
        if not url:
            logger.warning("CLERK_DOMAIN not configured; cannot fetch JWKS")
            return []

        # Reuse shared client from app.state if available
        client = None
        if request is not None and hasattr(request.app.state, "http_client"):
            client = request.app.state.http_client
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    jwks_cache["keys"] = response.json().get("keys", [])
                    jwks_cache["expires"] = now + 3600
                    return jwks_cache["keys"]
            except Exception as e:
                logger.error(f"Error fetching JWKS via shared client: {e}")
                return jwks_cache["keys"]
            return []

        # Fallback: short-lived client (e.g. in tests without lifespan)
        import httpx
        async with httpx.AsyncClient(timeout=10) as tmp:
            try:
                response = await tmp.get(url)
                if response.status_code == 200:
                    jwks_cache["keys"] = response.json().get("keys", [])
                    jwks_cache["expires"] = now + 3600
                    return jwks_cache["keys"]
            except Exception as e:
                logger.error(f"Error fetching JWKS: {e}")
        return jwks_cache["keys"]

def decode_token(token: str) -> dict:
    """Decode and verify a Clerk JWT token without FastAPI dependency context.
    Used by WebSocket handlers that can't use Depends().
    """
    import httpx
    import os

    # Fetch JWKS synchronously for WebSocket context
    domain = getattr(settings, "CLERK_DOMAIN", None) or os.getenv("CLERK_DOMAIN", "")
    if not domain:
        raise JWTError("CLERK_DOMAIN not configured")

    jwks_url = f"https://{domain}/.well-known/jwks.json"
    issuer = f"https://{domain}"

    # Use cached JWKS if available and fresh
    now = time.time()
    keys = jwks_cache["keys"] if now < jwks_cache["expires"] else []
    if not keys:
        response = httpx.get(jwks_url, timeout=10)
        if response.status_code == 200:
            keys = response.json().get("keys", [])
            jwks_cache["keys"] = keys
            jwks_cache["expires"] = now + 3600
        else:
            raise JWTError(f"Failed to fetch JWKS: {response.status_code}")

    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    relevant_key = next((k for k in keys if k["kid"] == kid), None)
    if not relevant_key:
        raise JWTError("Public key not found in JWKS")

    payload = jwt.decode(
        token,
        relevant_key,
        algorithms=["RS256"],
        audience=settings.CLERK_AUDIENCE,
        issuer=issuer or None,
    )
    return payload


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
        )

    token = credentials.credentials

    # Verify Clerk JWT
    jwks = await get_jwks(request)
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        relevant_key = next((k for k in jwks if k["kid"] == kid), None)
        if not relevant_key:
            raise JWTError("Public key not found in JWKS")

        payload = jwt.decode(
            token,
            relevant_key,
            algorithms=["RS256"],
            audience=settings.CLERK_AUDIENCE,
            issuer=_clerk_issuer() or None,
        )

        user_id = payload.get("sub")
        if not user_id:
            raise JWTError("Missing sub in payload")

        return {
            "user_id": user_id,
            "username": payload.get("username") or payload.get("email") or user_id,
            "email": payload.get("email"),
        }

    except JWTError as e:
        logger.warning(f"Token validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Internal auth error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal authentication error",
        )
