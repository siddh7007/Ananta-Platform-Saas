"""
Auth0 Authentication Provider

Validates Auth0 JWT tokens using RS256 (asymmetric key) algorithm with JWKS.
"""

import base64
import json
import logging
import time
from typing import Dict, Optional

import httpx

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


# JWKS cache: stores {domain: {"keys": [...], "fetched_at": timestamp}}
_jwks_cache: Dict[str, dict] = {}


async def _fetch_jwks(domain: str, cache_ttl_seconds: int = 3600) -> Optional[dict]:
    """
    Fetch JWKS from Auth0 domain with caching.

    Args:
        domain: Auth0 domain (e.g., your-tenant.us.auth0.com)
        cache_ttl_seconds: Cache TTL in seconds (default: 1 hour)

    Returns:
        JWKS dict with "keys" array, or None on failure
    """
    now = time.time()

    # Check cache
    cached = _jwks_cache.get(domain)
    if cached and (now - cached.get("fetched_at", 0)) < cache_ttl_seconds:
        logger.debug(f"[AuthMiddleware] Using cached JWKS for {domain}")
        return cached

    # Fetch fresh JWKS
    jwks_url = f"https://{domain}/.well-known/jwks.json"
    logger.info(f"[AuthMiddleware] Fetching JWKS from {jwks_url}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            jwks = response.json()

            # Cache with timestamp
            jwks["fetched_at"] = now
            _jwks_cache[domain] = jwks

            logger.debug(f"[AuthMiddleware] Fetched {len(jwks.get('keys', []))} keys from JWKS")
            return jwks

    except httpx.HTTPError as e:
        logger.error(f"[AuthMiddleware] Failed to fetch JWKS from {jwks_url}: {e}")
        return None
    except Exception as e:
        logger.error(f"[AuthMiddleware] JWKS fetch error: {e}")
        return None


def _get_rsa_public_key(jwks: dict, kid: str):
    """
    Extract RSA public key from JWKS matching the key ID.

    Args:
        jwks: JWKS dict with "keys" array
        kid: Key ID to match

    Returns:
        RSA public key object or None
    """
    try:
        from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
        from cryptography.hazmat.backends import default_backend

        for key in jwks.get("keys", []):
            if key.get("kid") == kid and key.get("kty") == "RSA":
                # Build RSA public key from n (modulus) and e (exponent)
                n_bytes = base64.urlsafe_b64decode(key["n"] + "==")
                e_bytes = base64.urlsafe_b64decode(key["e"] + "==")

                n = int.from_bytes(n_bytes, byteorder="big")
                e = int.from_bytes(e_bytes, byteorder="big")

                public_numbers = RSAPublicNumbers(e, n)
                public_key = public_numbers.public_key(default_backend())

                return public_key

        logger.warning(f"[AuthMiddleware] No matching key found for kid={kid}")
        return None

    except ImportError:
        logger.error(
            "[AuthMiddleware] cryptography package not installed. "
            "Install with: pip install cryptography"
        )
        return None
    except Exception as e:
        logger.error(f"[AuthMiddleware] Failed to build RSA public key: {e}")
        return None


def _verify_rs256_signature(token: str, public_key) -> bool:
    """
    Verify RS256 JWT signature using RSA public key.

    Args:
        token: Full JWT token string
        public_key: RSA public key object

    Returns:
        True if signature valid, False otherwise
    """
    try:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding

        parts = token.split(".")
        if len(parts) != 3:
            return False

        # Message is header.payload
        message = f"{parts[0]}.{parts[1]}".encode("utf-8")

        # Decode signature (base64url)
        sig_padded = parts[2] + "=" * (4 - len(parts[2]) % 4)
        signature = base64.urlsafe_b64decode(sig_padded)

        # Verify using RSA-PKCS1v15 with SHA256
        public_key.verify(
            signature,
            message,
            padding.PKCS1v15(),
            hashes.SHA256()
        )

        return True

    except Exception as e:
        logger.debug(f"[AuthMiddleware] RS256 signature verification failed: {e}")
        return False


async def validate_auth0_token(
    token: str,
    auth0_domain: str,
    auth0_audience: Optional[str] = None,
    jwks_cache_ttl_seconds: int = 3600
) -> Optional[dict]:
    """
    Validate an Auth0 JWT token using RS256 algorithm.

    Auth0 uses asymmetric RS256 algorithm with public keys from JWKS endpoint.
    This fetches the public key from Auth0's /.well-known/jwks.json with caching.

    Args:
        token: JWT token string
        auth0_domain: Auth0 tenant domain (e.g., your-tenant.us.auth0.com)
        auth0_audience: API audience identifier (optional)
        jwks_cache_ttl_seconds: JWKS cache TTL

    Returns:
        Dict with user claims or None if invalid
    """
    if not auth0_domain:
        logger.debug("[AuthMiddleware] AUTH0_DOMAIN not configured")
        return None

    try:
        # Parse JWT parts
        parts = token.split(".")
        if len(parts) != 3:
            logger.debug("[AuthMiddleware] Invalid JWT format for Auth0")
            return None

        # Decode header to get algorithm and key ID
        header_json = _base64url_decode(parts[0])
        header = json.loads(header_json)

        alg = header.get("alg")
        kid = header.get("kid")

        if alg != "RS256":
            logger.debug(f"[AuthMiddleware] Auth0 token not RS256: {alg}")
            return None

        if not kid:
            logger.warning("[AuthMiddleware] Auth0 token missing kid")
            return None

        # Fetch JWKS and get public key
        jwks = await _fetch_jwks(auth0_domain, jwks_cache_ttl_seconds)
        if not jwks:
            logger.error("[AuthMiddleware] Failed to fetch Auth0 JWKS")
            return None

        public_key = _get_rsa_public_key(jwks, kid)
        if not public_key:
            logger.warning(f"[AuthMiddleware] No matching key in JWKS for kid={kid}")
            return None

        # Verify signature
        if not _verify_rs256_signature(token, public_key):
            logger.warning("[AuthMiddleware] Auth0 token signature INVALID")
            return None

        logger.debug("[AuthMiddleware] Auth0 RS256 signature verified")

        # Decode and validate payload
        payload_json = _base64url_decode(parts[1])
        payload = json.loads(payload_json)

        # Check expiration
        exp = payload.get("exp")
        if exp and time.time() > exp:
            logger.warning("[AuthMiddleware] Auth0 token expired")
            return None

        # Check not-before
        nbf = payload.get("nbf")
        if nbf and time.time() < nbf:
            logger.warning("[AuthMiddleware] Auth0 token not yet valid (nbf)")
            return None

        # Verify issuer
        expected_issuer = f"https://{auth0_domain}/"
        if payload.get("iss") != expected_issuer:
            logger.warning(
                f"[AuthMiddleware] Auth0 issuer mismatch: "
                f"expected={expected_issuer} got={payload.get('iss')}"
            )
            return None

        # Verify audience (if configured)
        if auth0_audience:
            aud = payload.get("aud")
            # aud can be string or array
            if isinstance(aud, list):
                if auth0_audience not in aud:
                    logger.warning(f"[AuthMiddleware] Auth0 audience mismatch: {aud}")
                    return None
            elif aud != auth0_audience:
                logger.warning(f"[AuthMiddleware] Auth0 audience mismatch: {aud}")
                return None

        logger.info(f"[AuthMiddleware] Auth0 token validated: sub={payload.get('sub')}")
        return payload

    except Exception as e:
        logger.error(f"[AuthMiddleware] Auth0 validation error: {e}", exc_info=True)
        return None


class Auth0AuthProvider(BaseAuthProvider):
    """
    Auth0 authentication provider using RS256/JWKS JWT validation.
    """

    def __init__(self, config: AuthConfig):
        """
        Initialize Auth0 provider.

        Args:
            config: AuthConfig with auth0_domain, auth0_audience
        """
        self.config = config

    async def validate_token(self, token: str) -> Optional[dict]:
        """Validate Auth0 JWT token."""
        if not self.config.auth0_enabled or not self.config.auth0_domain:
            return None

        return await validate_auth0_token(
            token,
            auth0_domain=self.config.auth0_domain,
            auth0_audience=self.config.auth0_audience,
            jwks_cache_ttl_seconds=self.config.jwks_cache_ttl_seconds
        )

    async def build_context(self, claims: dict) -> AuthContext:
        """Build AuthContext from Auth0 JWT claims."""
        user_id = claims.get("sub", "")
        email = claims.get("email", "")

        # Auth0 uses namespaced custom claims
        # Primary namespace: https://ananta.component.platform (used by Auth0 Action)
        # Fallback namespace: https://components-platform (legacy)
        role = (
            claims.get("https://ananta.component.platform/role") or
            claims.get("https://components-platform/role") or
            Role.ANALYST.value
        )
        organization_id = (
            claims.get("https://ananta.component.platform/organization_id") or
            claims.get("https://ananta.component.platform/org_id") or
            claims.get("https://components-platform/org_id") or
            ""
        )
        username = claims.get("name", email)

        return AuthContext(
            user_id=user_id,
            organization_id=organization_id,
            role=role,
            email=email,
            username=username,
            auth_provider="auth0",
            extra=claims,
        )
