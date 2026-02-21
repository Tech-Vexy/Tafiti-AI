from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from jose import jwt, JWTError
import time
import traceback

from app.core.logger import get_logger

logger = get_logger("security")

security = HTTPBearer()

# Clerk Configuration
import os
_CLERK_DOMAIN = os.getenv("CLERK_DOMAIN", "profound-shrimp-65.clerk.accounts.dev")
CLERK_JWKS_URL = f"https://{_CLERK_DOMAIN}/.well-known/jwks.json"
CLERK_ISSUER = f"https://{_CLERK_DOMAIN}"

# JWKS Cache
jwks_cache = {"keys": [], "expires": 0}

async def get_jwks():
    now = time.time()
    if now < jwks_cache["expires"]:
        return jwks_cache["keys"]
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(CLERK_JWKS_URL)
            if response.status_code == 200:
                jwks_cache["keys"] = response.json().get("keys", [])
                jwks_cache["expires"] = now + 3600 # Cache for 1 hour
                return jwks_cache["keys"]
        except Exception as e:
            logger.error(f"Error fetching JWKS: {e}")
    return []

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
        )
    
    token = credentials.credentials
    
    # Verify Clerk JWT
    jwks = await get_jwks()
    try:
        # Note: Clerk tokens use the RS256 algorithm
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        
        relevant_key = next((k for k in jwks if k["kid"] == kid), None)
        if not relevant_key:
            raise JWTError("Public key not found in JWKS")

        payload = jwt.decode(
            token, 
            relevant_key, 
            algorithms=["RS256"],
            audience=None, # Update if you have an audience set in Clerk
            issuer=CLERK_ISSUER
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise JWTError("Missing sub in payload")

        return {
            "user_id": user_id,
            "username": payload.get("username") or payload.get("email") or user_id,
            "email": payload.get("email")
        }
        
    except JWTError as e:
        logger.warning(f"Token validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Internal auth error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal authentication error"
        )
