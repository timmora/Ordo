import logging
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import SUPABASE_URL

logger = logging.getLogger(__name__)

security = HTTPBearer()

jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Validate Supabase JWT and return the user_id."""
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        user_id: str = payload["sub"]
        return user_id
    except (jwt.ExpiredSignatureError, jwt.InvalidAudienceError, jwt.DecodeError) as e:
        logger.warning("JWT validation failed: %s: %s", type(e).__name__, e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        logger.error("Unexpected auth error: %s: %s", type(e).__name__, e)
        raise HTTPException(status_code=401, detail="Authentication service error")
