"""
Supabase Authentication Provider

Validates Supabase JWT tokens using HS256 (symmetric key) algorithm.
"""

import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Optional

from shared.auth_billing.auth.context import AuthContext
from shared.auth_billing.auth.roles import Role
from shared.auth_billing.auth.providers.base import BaseAuthProvider
from shared.auth_billing.config import AuthConfig

logger = logging.getLogger(__name__)


def _base64url_decode(data: str) -> bytes:
    """Decode base64url encoded data with proper padding."""
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def _verify_jwt_signature(token: str, secret: str, algorithm: str = "HS256") -> bool:
    """
    Verify JWT signature using HMAC-SHA256.

    SECURITY CRITICAL: This function verifies the token hasn't been tampered with.

    Args:
        token: Full JWT token string (header.payload.signature)
        secret: Secret key for verification
        algorithm: Algorithm to use (only HS256 supported)

    Returns:
        True if signature is valid, False otherwise
    """
    if algorithm != "HS256":
        logger.error(f"[AuthMiddleware] Unsupported JWT algorithm: {algorithm}")
        return False

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False

        # The signature is computed over header.payload
        message = f"{parts[0]}.{parts[1]}".encode("utf-8")
        signature = _base64url_decode(parts[2])

        # Compute expected signature using HMAC-SHA256
        expected_signature = hmac.new(
            secret.encode("utf-8"),
            message,
            hashlib.sha256
        ).digest()

        # Use constant-time comparison to prevent timing attacks
        is_valid = hmac.compare_digest(signature, expected_signature)

        if not is_valid:
            logger.warning("[AuthMiddleware] JWT signature verification FAILED")

        return is_valid

    except Exception as e:
        logger.error(f"[AuthMiddleware] JWT signature verification error: {e}")
        return False


async def validate_supabase_token(
    token: str,
    jwt_secret_key: str,
    verify_signature: bool = True
) -> Optional[dict]:
    """
    Validate a Supabase JWT token with signature verification.

    SECURITY: This function verifies the JWT signature using HS256 algorithm.

    Args:
        token: JWT token string
        jwt_secret_key: Secret key for HS256 verification
        verify_signature: If True, verify signature (default: True for security)

    Returns:
        Dict with user claims or None if invalid/forged
    """
    try:
        # JWT format: header.payload.signature
        parts = token.split(".")
        if len(parts) != 3:
            logger.debug("[AuthMiddleware] Invalid JWT format")
            return None

        # SECURITY: Verify signature BEFORE trusting any claims
        if verify_signature:
            if not jwt_secret_key:
                logger.error(
                    "[AuthMiddleware] JWT_SECRET_KEY not configured - "
                    "REJECTING all tokens for security"
                )
                return None

            # Verify the header specifies HS256
            try:
                header_json = _base64url_decode(parts[0])
                header = json.loads(header_json)
                alg = header.get("alg", "")

                if alg != "HS256":
                    logger.warning(
                        f"[AuthMiddleware] Unsupported JWT algorithm: {alg} "
                        "(only HS256 supported)"
                    )
                    return None
            except Exception as e:
                logger.warning(f"[AuthMiddleware] Failed to decode JWT header: {e}")
                return None

            # Verify signature
            if not _verify_jwt_signature(token, jwt_secret_key, "HS256"):
                logger.warning("[AuthMiddleware] Token signature INVALID - possible forgery")
                return None

            logger.debug("[AuthMiddleware] JWT signature verified successfully")

        # Decode payload (middle part)
        payload_json = _base64url_decode(parts[1])
        payload = json.loads(payload_json)

        # Check expiration
        exp = payload.get("exp")
        if exp and time.time() > exp:
            logger.warning("[AuthMiddleware] Token expired")
            return None

        # Check not-before time (nbf)
        nbf = payload.get("nbf")
        if nbf and time.time() < nbf:
            logger.warning("[AuthMiddleware] Token not yet valid (nbf)")
            return None

        logger.debug(f"[AuthMiddleware] Supabase token validated: sub={payload.get('sub')}")
        return payload

    except Exception as e:
        logger.error(f"[AuthMiddleware] Failed to validate Supabase token: {e}")
        return None


class SupabaseAuthProvider(BaseAuthProvider):
    """
    Supabase authentication provider using HS256 JWT validation.
    """

    def __init__(self, config: AuthConfig):
        """
        Initialize Supabase provider.

        Args:
            config: AuthConfig with jwt_secret_key
        """
        self.config = config

    async def validate_token(self, token: str) -> Optional[dict]:
        """Validate Supabase JWT token."""
        return await validate_supabase_token(
            token,
            jwt_secret_key=self.config.jwt_secret_key,
            verify_signature=True
        )

    async def build_context(self, claims: dict) -> AuthContext:
        """Build AuthContext from Supabase JWT claims."""
        user_id = claims.get("sub", "")
        email = claims.get("email", "")

        # Supabase stores custom claims in user_metadata
        user_metadata = claims.get("user_metadata", {})
        role = user_metadata.get("role", Role.ANALYST.value)
        organization_id = user_metadata.get("organization_id", "")
        username = user_metadata.get("full_name", email)

        return AuthContext(
            user_id=user_id,
            organization_id=organization_id,
            role=role,
            email=email,
            username=username,
            auth_provider="supabase",
            extra=claims,
        )
