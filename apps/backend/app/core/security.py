from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request
import asyncio
import os
import time
import traceback
from typing import Optional

from jose import jwt, JWTError

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("security")

security = HTTPBearer(auto_error=False)

# JWKS cache with async lock
jwks_cache = {"keys": [], "expires": 0}
_jwks_lock = asyncio.Lock()


def _clerk_domain() -> Optional[str]:
    """Configured Clerk instance domain (no hardcoded fallback)."""
    return os.getenv("CLERK_DOMAIN") or getattr(settings, "CLERK_DOMAIN", None)

def _clerk_jwks_url() -> Optional[str]:
    env_jwks = os.getenv("JWKS_URL") or os.getenv("CLERK_JWKS_URL") or getattr(settings, "CLERK_JWKS_URL", None)
    if env_jwks:
        return env_jwks
    domain = _clerk_domain()
    if not domain:
        return None
    return f"https://{domain}/.well-known/jwks.json"

def _clerk_issuer() -> Optional[str]:
    """Expected iss claim. Prefer an explicit override, else derive from domain."""
    env_iss = os.getenv("CLERK_ISSUER") or getattr(settings, "CLERK_ISSUER", None)
    if env_iss:
        return env_iss.rstrip("/")
    # Clerk's frontend API URL is used as the token issuer.
    frontend_api = os.getenv("FRONTEND_API_URL")
    if frontend_api and frontend_api.startswith("https://"):
        return frontend_api.rstrip("/")
    domain = _clerk_domain()
    return f"https://{domain}".rstrip("/") if domain else None


async def get_jwks(request: Request = None):
    now = time.time()
    if now < jwks_cache["expires"] and jwks_cache["keys"]:
        return jwks_cache["keys"]

    async with _jwks_lock:
        now = time.time()
        if now < jwks_cache["expires"] and jwks_cache["keys"]:
            return jwks_cache["keys"]

        url = _clerk_jwks_url()
        if not url:
            logger.warning("CLERK_DOMAIN not configured; cannot fetch JWKS")
            return []

        # Reuse shared client from app.state if available
        if request is not None and hasattr(request.app.state, "http_client"):
            client = request.app.state.http_client
            try:
                response = await client.get(url, timeout=10.0)
                if response.status_code == 200:
                    jwks_cache["keys"] = response.json().get("keys", [])
                    jwks_cache["expires"] = now + 3600
                    return jwks_cache["keys"]
            except Exception as e:
                logger.error(f"Error fetching JWKS via shared client: {e}")

        # Fallback: short-lived client
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as tmp:
                response = await tmp.get(url)
                if response.status_code == 200:
                    jwks_cache["keys"] = response.json().get("keys", [])
                    jwks_cache["expires"] = now + 3600
                    return jwks_cache["keys"]
        except Exception as e:
            logger.error(f"Error fetching JWKS: {e}")
        return jwks_cache["keys"]


async def _verify_token(request: Request, token: str) -> dict:
    """Verify a Clerk JWT (signature, expiry, issuer, audience) and return claims.

    Issuer verification FAILS CLOSED: if a Clerk issuer is configured, a token
    whose ``iss`` does not match it is rejected (no silent ``verify_iss=False``).
    Audience is only enforced when the token carries an ``aud`` claim and an
    audience list is configured — Clerk sometimes omits ``aud`` entirely.
    """
    jwks = await get_jwks(request)
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")

    relevant_key = next((k for k in jwks if k.get("kid") == kid), None)
    if not relevant_key:
        # If not in cache, refresh jwks once
        jwks_cache["expires"] = 0
        jwks = await get_jwks(request)
        relevant_key = next((k for k in jwks if k.get("kid") == kid), None)
        if not relevant_key:
            raise JWTError("Public key not found in JWKS")

    try:
        claims = jwt.get_unverified_claims(token)
    except Exception:
        claims = {}

    decode_kwargs = {"algorithms": ["RS256"]}

    issuer = _clerk_issuer()
    if issuer:
        decode_kwargs["issuer"] = issuer

    options = {}
    if "aud" in claims and settings.clerk_audience:
        decode_kwargs["audience"] = settings.clerk_audience
    else:
        options["verify_aud"] = False

    if options:
        decode_kwargs["options"] = options

    payload = jwt.decode(token, relevant_key, **decode_kwargs)

    user_id = payload.get("sub")
    if not user_id:
        raise JWTError("Missing sub in payload")
    return payload


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = await _verify_token(request, credentials.credentials)

        return {
            "user_id": payload["sub"],
            "username": payload.get("username") or payload.get("email") or payload["sub"],
            "email": payload.get("email"),
            "org_id": payload.get("org_id"),
            "org_role": payload.get("org_role"),
            "org_slug": payload.get("org_slug"),
        }

    except JWTError as e:
        logger.warning(f"Token validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Internal auth error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal authentication error",
        )


async def decode_token(token: str) -> dict:
    """Verify a Clerk JWT and return its claims (for WebSocket handshakes, etc.)."""
    try:
        return await _verify_token(request=None, token=token)
    except Exception as e:
        logger.warning(f"decode_token failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )


async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> Optional[dict]:
    """Return authenticated user if valid token present, otherwise None without raising 401."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(request, credentials)
    except Exception:
        return None

