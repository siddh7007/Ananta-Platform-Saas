"""
Authentication Middleware

This middleware validates authentication tokens and populates request.state.auth_context
for downstream handlers. It is designed to be auth-provider agnostic and supports:

- Supabase JWT tokens (with signature verification)
- Auth0 JWT tokens (future)
- API keys (future)
- Service-to-service tokens (future)

Architecture Decision:
    This middleware extracts auth information from incoming requests and creates
    an AuthContext object. The actual authorization logic is in authorization.py.

Security Features:
    - JWT signature verification using HS256 algorithm
    - Token expiration checking
    - Rate limiting on failed auth attempts (via Redis)
    - Structured error responses

Revert Strategy:
    To disable this middleware, remove the setup_auth_middleware() call from main.py.

Usage:
    # In main.py
    from app.middleware import setup_auth_middleware
    setup_auth_middleware(app)
"""

import hashlib
import hmac
import logging
import time
from collections import defaultdict
from typing import Callable, Dict, List, Optional, Set

import httpx
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.authorization import AuthContext, AuthContextError, AuthErrorCode, Role
from app.config import settings

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

# Paths that don't require authentication
PUBLIC_PATHS: Set[str] = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/health",
    "/api/docs",
    "/api/redoc",
    "/api/auth/provision-user",  # Called by Auth0 Action
    "/api/auth/lookup-user",     # Called by Auth0 Action (prefix match below)
    "/api/auth/accept-invite",   # Called by Auth0 Action
}

# Path prefixes that don't require authentication
# NOTE: /api/admin/ is INTENTIONALLY NOT listed - admin routes MUST require auth
PUBLIC_PATH_PREFIXES: List[str] = [
    "/api/docs",
    "/api/health",
    "/api/auth/lookup-user/",  # Auth0 Action lookup (has path param)
    "/static/",
    "/_next/",
]

# Path prefixes that accept auth via query parameter (for SSE/EventSource)
# EventSource API doesn't support custom headers, so we accept ?token=<jwt>
QUERY_PARAM_AUTH_PREFIXES: List[str] = [
    "/api/enrichment/stream/",  # SSE endpoint for enrichment progress
]

# Headers to check for auth tokens
AUTH_HEADER = "Authorization"
API_KEY_HEADER = "X-API-Key"
ACTOR_ID_HEADER = "X-Actor-ID"
ORG_ID_HEADER = "X-Organization-ID"
WORKSPACE_ID_HEADER = "X-Workspace-ID"
USER_EMAIL_HEADER = "X-User-Email"


# =============================================================================
# Rate Limiting (In-Memory - LIMITATIONS APPLY)
# =============================================================================
#
# ⚠️ PRODUCTION LIMITATIONS (In-Memory Rate Limiter):
#
# 1. PER-PROCESS STATE: Each worker process has its own counter dictionary.
#    - Multiple gunicorn/uvicorn workers = separate rate limit tracking
#    - Attacker can distribute requests across workers to bypass limits
#    - Example: 4 workers × 10 attempts = 40 attempts before any blocking
#
# 2. NOT PERSISTENT: Counters reset on worker restart/redeploy.
#    - An attacker can trigger restarts to reset their rate limit
#    - Rolling deploys continuously reset counters
#
# 3. NOT DISTRIBUTED: Single-server only.
#    - Horizontal scaling (multiple containers/nodes) = no shared state
#    - Load balancer distributes requests, defeating per-node limits
#
# RECOMMENDED FOR PRODUCTION:
#    Migrate to Redis-backed rate limiting (see slowapi or custom implementation):
#    - Shared state across workers/nodes
#    - Survives restarts
#    - Supports distributed deployments
#
# IP EXTRACTION SECURITY:
# - X-Forwarded-For spoofing is mitigated by settings.trusted_proxy_count:
#    - Set to 0 (default): Ignores X-Forwarded-For entirely (most secure for direct connections)
#    - Set to 1: Trusts only the rightmost IP (single reverse proxy like nginx)
#    - Set to 2: Trusts second-from-right IP (CDN + load balancer)
#    Configure TRUSTED_PROXY_COUNT in .env based on your infrastructure.
# - X-Real-IP header (if set by your proxy) takes precedence as it's set by the proxy itself.
#
# TODO: Implement Redis-backed rate limiting for production deployments
#

# Track failed auth attempts per IP (in-memory, resets on restart)
_failed_auth_attempts: dict = defaultdict(lambda: {"count": 0, "reset_at": 0})
_RATE_LIMIT_WINDOW_SECONDS = 300  # 5 minutes
_RATE_LIMIT_MAX_FAILURES = 10  # Max failures before blocking


def _check_rate_limit(client_ip: str) -> bool:
    """
    Check if the client IP is rate-limited due to failed auth attempts.

    Args:
        client_ip: Client IP address

    Returns:
        True if rate-limited, False otherwise
    """
    now = time.time()
    record = _failed_auth_attempts[client_ip]

    # Reset if window expired
    if now > record["reset_at"]:
        record["count"] = 0
        record["reset_at"] = now + _RATE_LIMIT_WINDOW_SECONDS

    return record["count"] >= _RATE_LIMIT_MAX_FAILURES


def _record_auth_failure(client_ip: str) -> None:
    """Record a failed auth attempt for rate limiting."""
    now = time.time()
    record = _failed_auth_attempts[client_ip]

    if now > record["reset_at"]:
        record["count"] = 1
        record["reset_at"] = now + _RATE_LIMIT_WINDOW_SECONDS
    else:
        record["count"] += 1

    if record["count"] >= _RATE_LIMIT_MAX_FAILURES:
        logger.warning(
            f"[AuthMiddleware] Rate limit triggered: ip={client_ip} "
            f"failures={record['count']}"
        )


def _clear_auth_failures(client_ip: str) -> None:
    """Clear failed auth attempts on successful auth."""
    if client_ip in _failed_auth_attempts:
        del _failed_auth_attempts[client_ip]


# =============================================================================
# Token Extraction
# =============================================================================

def extract_bearer_token(request: Request) -> Optional[str]:
    """
    Extract Bearer token from Authorization header.

    Args:
        request: FastAPI request object

    Returns:
        Token string or None
    """
    auth_header = request.headers.get(AUTH_HEADER)

    if not auth_header:
        return None

    parts = auth_header.split()

    if len(parts) != 2 or parts[0].lower() != "bearer":
        logger.debug(f"[AuthMiddleware] Invalid Authorization header format")
        return None

    return parts[1]


def extract_api_key(request: Request) -> Optional[str]:
    """
    Extract API key from X-API-Key header.

    Args:
        request: FastAPI request object

    Returns:
        API key string or None
    """
    return request.headers.get(API_KEY_HEADER)


def extract_actor_from_headers(request: Request) -> tuple[Optional[str], Optional[str]]:
    """
    Extract actor information from custom headers.

    This is used for service-to-service calls or when auth is handled
    at the API gateway level.

    Args:
        request: FastAPI request object

    Returns:
        Tuple of (actor_id, organization_id)
    """
    actor_id = request.headers.get(ACTOR_ID_HEADER)
    org_id = request.headers.get(ORG_ID_HEADER)
    return actor_id, org_id


# =============================================================================
# Token Validation (Provider-Specific)
# =============================================================================

def _base64url_decode(data: str) -> bytes:
    """Decode base64url encoded data with proper padding."""
    # Add padding if needed
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    import base64
    return base64.urlsafe_b64decode(data)


def _verify_jwt_signature(token: str, secret: str, algorithm: str = "HS256") -> bool:
    """
    Verify JWT signature using HMAC-SHA256.

    SECURITY CRITICAL: This function verifies the token hasn't been tampered with.

    Args:
        token: Full JWT token string (header.payload.signature)
        secret: Secret key for verification
        algorithm: Algorithm to use (only HS256 supported currently)

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


async def validate_supabase_token(token: str, verify_signature: bool = True) -> Optional[dict]:
    """
    Validate a Supabase JWT token with signature verification.

    SECURITY: This function now verifies the JWT signature using HS256 algorithm.
    The secret is read from settings.jwt_secret_key (JWT_SECRET_KEY env var).

    Args:
        token: JWT token string
        verify_signature: If True, verify signature (default: True for security)

    Returns:
        Dict with user claims or None if invalid/forged
    """
    try:
        import json

        # JWT format: header.payload.signature
        parts = token.split(".")
        if len(parts) != 3:
            logger.debug("[AuthMiddleware] Invalid JWT format")
            return None

        # SECURITY: Verify signature BEFORE trusting any claims
        if verify_signature:
            jwt_secret = getattr(settings, 'jwt_secret_key', None)

            if not jwt_secret:
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
            if not _verify_jwt_signature(token, jwt_secret, "HS256"):
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


"""
# =============================================================================
# JWKS Cache for Auth0 RS256 Validation
# =============================================================================
"""

# JWKS cache: stores {domain: {"keys": [...], "fetched_at": timestamp}}
_jwks_cache: Dict[str, dict] = {}
_JWKS_CACHE_TTL_SECONDS = 3600  # 1 hour


async def _fetch_jwks(domain: str) -> Optional[dict]:
    """
    Fetch JWKS from Auth0 domain with caching.

    Args:
        domain: Auth0 domain (e.g., your-tenant.us.auth0.com)

    Returns:
        JWKS dict with "keys" array, or None on failure
    """
    now = time.time()

    # Check cache
    cached = _jwks_cache.get(domain)
    if cached and (now - cached.get("fetched_at", 0)) < _JWKS_CACHE_TTL_SECONDS:
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
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend
        import base64

        for key in jwks.get("keys", []):
            if key.get("kid") == kid and key.get("kty") == "RSA":
                # Build RSA public key from n (modulus) and e (exponent)
                n_bytes = base64.urlsafe_b64decode(key["n"] + "==")
                e_bytes = base64.urlsafe_b64decode(key["e"] + "==")

                n = int.from_bytes(n_bytes, byteorder="big")
                e = int.from_bytes(e_bytes, byteorder="big")

                from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
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
        import base64

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


async def validate_auth0_token(token: str) -> Optional[dict]:
    """
    Validate an Auth0 JWT token using RS256 algorithm.

    Auth0 uses asymmetric RS256 algorithm with public keys from JWKS endpoint.
    This fetches the public key from Auth0's /.well-known/jwks.json with caching.

    Required config:
    - AUTH0_ENABLED: Set to true to enable Auth0 validation
    - AUTH0_DOMAIN: Your Auth0 tenant domain (e.g., your-tenant.us.auth0.com)
    - AUTH0_AUDIENCE: API audience identifier

    Args:
        token: JWT token string

    Returns:
        Dict with user claims or None if invalid
    """
    import json

    # Check if Auth0 is enabled
    auth0_enabled = getattr(settings, 'auth0_enabled', False)
    logger.info(f"[AuthMiddleware] Auth0 validation - enabled={auth0_enabled}")

    if not auth0_enabled:
        logger.warning("[AuthMiddleware] Auth0 NOT ENABLED, skipping validation")
        return None

    auth0_domain = getattr(settings, 'auth0_domain', None)
    auth0_audience = getattr(settings, 'auth0_audience', None)

    logger.info(f"[AuthMiddleware] Auth0 config: domain={auth0_domain}, audience={auth0_audience}")

    if not auth0_domain:
        logger.error("[AuthMiddleware] AUTH0_DOMAIN not configured")
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
        jwks = await _fetch_jwks(auth0_domain)
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


async def validate_api_key(api_key: str) -> Optional[dict]:
    """
    Validate an API key.

    TODO: Implement API key validation against database.

    Args:
        api_key: API key string

    Returns:
        Dict with associated user/service claims or None if invalid
    """
    # Placeholder for API key validation
    logger.debug("[AuthMiddleware] API key validation not yet implemented")
    return None


# =============================================================================
# Auth0 Management API (for syncing app_metadata after auto-provision)
# =============================================================================

# Cache for Auth0 Management API token
_auth0_mgmt_token_cache: dict = {"token": None, "expires_at": 0}


async def _get_auth0_management_token() -> Optional[str]:
    """
    Get Auth0 Management API token with caching.

    Returns:
        Access token for Auth0 Management API, or None if not configured
    """
    import time

    now = time.time()

    # Return cached token if still valid (with 60s buffer)
    if _auth0_mgmt_token_cache["token"] and _auth0_mgmt_token_cache["expires_at"] > now + 60:
        return _auth0_mgmt_token_cache["token"]

    # Get credentials from config (use M2M app credentials)
    auth0_domain = getattr(settings, 'auth0_domain', None)
    client_id = getattr(settings, 'auth0_m2m_client_id', None) or getattr(settings, 'auth0_client_id', None)
    client_secret = getattr(settings, 'auth0_m2m_client_secret', None) or getattr(settings, 'auth0_client_secret', None)

    if not all([auth0_domain, client_id, client_secret]):
        logger.debug("[Auth0Mgmt] Management API not configured (missing credentials)")
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"https://{auth0_domain}/oauth/token",
                json={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "audience": f"https://{auth0_domain}/api/v2/",
                    "grant_type": "client_credentials"
                }
            )

            if response.status_code != 200:
                logger.warning(f"[Auth0Mgmt] Failed to get token: {response.status_code}")
                return None

            data = response.json()
            token = data.get("access_token")
            expires_in = data.get("expires_in", 86400)  # Default 24h

            # Cache the token
            _auth0_mgmt_token_cache["token"] = token
            _auth0_mgmt_token_cache["expires_at"] = now + expires_in

            logger.info("[Auth0Mgmt] Obtained Management API token")
            return token

    except Exception as e:
        logger.error(f"[Auth0Mgmt] Failed to get token: {e}")
        return None


async def _update_auth0_app_metadata(
    auth0_user_id: str,
    auth0_org_id: str,
    supabase_org_id: str,
    supabase_user_id: str,
    customer_role: Optional[str] = None
) -> bool:
    """
    Update Auth0 user's app_metadata so next login has org_id and role in JWT.

    This syncs the auto-provisioned data back to Auth0, so subsequent
    logins will have the org_id and role claims without needing middleware lookup.

    Args:
        auth0_user_id: Auth0 user ID (e.g., "google-oauth2|123...")
        auth0_org_id: Synthetic org ID (e.g., "personal_abc123")
        supabase_org_id: Supabase organization UUID
        supabase_user_id: Supabase user UUID
        customer_role: Customer org role (owner, admin, engineer, analyst, member, viewer)

    Returns:
        True if updated successfully, False otherwise
    """
    auth0_domain = getattr(settings, 'auth0_domain', None)
    if not auth0_domain:
        logger.debug("[Auth0Mgmt] Domain not configured, skipping metadata update")
        return False

    token = await _get_auth0_management_token()
    if not token:
        logger.debug("[Auth0Mgmt] No token available, skipping metadata update")
        return False

    try:
        # Build app_metadata with all fields
        app_metadata = {
            "auth0_org_id": auth0_org_id,
            "supabase_org_id": supabase_org_id,
            "supabase_user_id": supabase_user_id
        }

        # Add customer role if provided
        if customer_role:
            app_metadata["customer_role"] = customer_role

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(
                f"https://{auth0_domain}/api/v2/users/{auth0_user_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={"app_metadata": app_metadata}
            )

            if response.status_code == 200:
                logger.info(f"[Auth0Mgmt] Updated app_metadata for {auth0_user_id} (role={customer_role})")
                return True
            else:
                logger.warning(
                    f"[Auth0Mgmt] Failed to update metadata: "
                    f"{response.status_code} - {response.text[:200]}"
                )
                return False

    except Exception as e:
        logger.error(f"[Auth0Mgmt] Error updating metadata: {e}")
        return False


async def sync_role_to_auth0(auth0_user_id: str, customer_role: str) -> bool:
    """
    Sync a customer role change to Auth0 app_metadata.

    This should be called whenever an organization membership role is updated,
    so the role is included in the JWT on next login.

    Args:
        auth0_user_id: Auth0 user ID (e.g., "google-oauth2|123...")
        customer_role: Updated customer org role (owner, admin, engineer, analyst, member, viewer)

    Returns:
        True if synced successfully, False otherwise
    """
    auth0_domain = getattr(settings, 'auth0_domain', None)
    if not auth0_domain:
        logger.debug("[Auth0Mgmt] Domain not configured, skipping role sync")
        return False

    token = await _get_auth0_management_token()
    if not token:
        logger.debug("[Auth0Mgmt] No token available, skipping role sync")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(
                f"https://{auth0_domain}/api/v2/users/{auth0_user_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "app_metadata": {
                        "customer_role": customer_role
                    }
                }
            )

            if response.status_code == 200:
                logger.info(f"[Auth0Mgmt] Synced role to Auth0: user={auth0_user_id}, role={customer_role}")
                return True
            else:
                logger.warning(
                    f"[Auth0Mgmt] Failed to sync role: "
                    f"{response.status_code} - {response.text[:200]}"
                )
                return False

    except Exception as e:
        logger.error(f"[Auth0Mgmt] Error syncing role: {e}")
        return False


# =============================================================================
# Auto-Provisioning Fallback (for local dev when Auth0 Action can't reach backend)
# =============================================================================

async def _auto_provision_user_if_needed(
    auth0_user_id: str,
    email: str,
    name: str = ""
) -> tuple[str, str]:
    """
    Auto-provision user if they don't exist in database.

    This is a fallback for local development when Auth0 Action can't reach
    the backend to provision users. In production, Auth0 Action handles this.

    Args:
        auth0_user_id: Auth0 user ID (sub claim)
        email: User email
        name: User display name

    Returns:
        Tuple of (organization_id, auth0_org_id) or ("", "") if provisioning fails
    """
    try:
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text
        import secrets

        dual_db = get_dual_database()
        session = dual_db.SupabaseSession()

        try:
            # Check if user already exists
            existing = session.execute(
                text("""
                    SELECT u.id, u.organization_id, o.auth0_org_id
                    FROM users u
                    LEFT JOIN organizations o ON o.id = u.organization_id
                    WHERE u.auth0_user_id = :auth0_id OR u.email = :email
                    LIMIT 1
                """),
                {"auth0_id": auth0_user_id, "email": email}
            ).fetchone()

            if existing:
                logger.debug(f"[AutoProvision] User exists: {existing.id}")
                return (str(existing.organization_id) if existing.organization_id else "",
                        existing.auth0_org_id or "")

            # User doesn't exist - provision them
            logger.info(f"[AutoProvision] Provisioning new user: {email}")

            # Generate synthetic org ID
            user_hash = secrets.token_hex(6)
            auth0_org_id = f"personal_{user_hash}"

            # Generate org slug
            base_slug = email.split("@")[0].lower()
            slug = "".join(c if c.isalnum() else "-" for c in base_slug)
            slug_suffix = secrets.token_hex(3)
            org_slug = f"{slug}-{slug_suffix}"

            # Create organization
            org_name = f"{name or email.split('@')[0]}'s Organization"
            org_result = session.execute(
                text("""
                    INSERT INTO organizations (name, slug, auth0_org_id, org_type, max_users, created_at)
                    VALUES (:name, :slug, :auth0_org_id, 'individual', 1, NOW())
                    RETURNING id
                """),
                {"name": org_name, "slug": org_slug, "auth0_org_id": auth0_org_id}
            ).fetchone()

            org_id = org_result.id

            # Create user
            user_result = session.execute(
                text("""
                    INSERT INTO users (email, full_name, auth0_user_id, organization_id, created_at)
                    VALUES (:email, :name, :auth0_id, :org_id, NOW())
                    RETURNING id
                """),
                {"email": email, "name": name or email.split("@")[0],
                 "auth0_id": auth0_user_id, "org_id": org_id}
            ).fetchone()

            user_id = user_result.id

            # Create membership with owner role
            session.execute(
                text("""
                    INSERT INTO organization_memberships (organization_id, user_id, role, created_at)
                    VALUES (:org_id, :user_id, 'owner', NOW())
                """),
                {"org_id": org_id, "user_id": user_id}
            )

            session.commit()
            logger.info(f"[AutoProvision] User provisioned: user={user_id}, org={org_id}")

            # Sync back to Auth0 so next login has org_id in JWT
            # This runs in background - don't block on it
            try:
                await _update_auth0_app_metadata(
                    auth0_user_id=auth0_user_id,
                    auth0_org_id=auth0_org_id,
                    supabase_org_id=str(org_id),
                    supabase_user_id=str(user_id)
                )
            except Exception as e:
                # Don't fail provisioning if Auth0 sync fails
                logger.warning(f"[AutoProvision] Auth0 sync failed (non-blocking): {e}")

            return (str(org_id), auth0_org_id)

        except Exception as e:
            session.rollback()
            logger.error(f"[AutoProvision] Failed: {e}")
            return ("", "")
        finally:
            session.close()

    except Exception as e:
        logger.error(f"[AutoProvision] Setup error: {e}")
        return ("", "")


# =============================================================================
# Auth Context Building
# =============================================================================

async def build_auth_context_from_token(claims: dict, provider: str) -> AuthContext:
    """
    Build AuthContext from validated token claims.

    Args:
        claims: Decoded JWT claims
        provider: Auth provider name (supabase, auth0, etc.)

    Returns:
        AuthContext instance
    """
    # Extract common fields (provider-specific mapping)
    if provider == "supabase":
        user_id = claims.get("sub", "")
        email = claims.get("email", "")
        # Supabase stores custom claims in user_metadata, but also check top-level claims
        user_metadata = claims.get("user_metadata", {})
        # Check user_metadata first, then top-level claims as fallback
        role = user_metadata.get("role", claims.get("role", Role.ANALYST.value))
        organization_id = user_metadata.get("organization_id", claims.get("organization_id", claims.get("org_id", "")))
        username = user_metadata.get("full_name", claims.get("name", email))

    elif provider == "supabase_direct":
        # Supabase with organization_id at top level (used by middleware-api)
        user_id = claims.get("sub", "")
        email = claims.get("email", "")
        role = claims.get("role", Role.ANALYST.value)
        organization_id = claims.get("organization_id", claims.get("org_id", ""))
        username = claims.get("name", claims.get("full_name", email))

    elif provider == "auth0":
        user_id = claims.get("sub", "")
        # Auth0 uses namespaced custom claims - configurable via AUTH0_NAMESPACE env var
        namespace = getattr(settings, 'auth0_namespace', 'https://ananta.component.platform')
        # Auth0 access tokens don't include email by default - check namespaced claims too
        email = claims.get("email", "") or claims.get(f"{namespace}/email", "")

        # First check custom claim /role (customer org role: owner, admin, engineer, analyst, member, viewer)
        role = claims.get(f"{namespace}/role", "")

        # If no custom /role claim, check for platform:* roles (CNS staff only)
        if not role:
            auth0_roles = claims.get(f"{namespace}/roles", [])
            if isinstance(auth0_roles, list):
                # Map Auth0 RBAC platform roles to system roles (CNS staff only)
                if any(r in ['platform:super_admin', 'super_admin'] for r in auth0_roles):
                    role = Role.SUPER_ADMIN.value
                elif any(r in ['platform:admin', 'admin', 'platform:staff'] for r in auth0_roles):
                    role = Role.ADMIN.value
                elif any(r in ['platform:engineer', 'engineer'] for r in auth0_roles):
                    role = Role.ENGINEER.value
                else:
                    # No platform role found - this is a regular customer
                    # Role should be in JWT from Auth0 action, but if missing, default to analyst
                    role = Role.ANALYST.value
                logger.info(f"[AuthMiddleware] Derived role from Auth0 platform roles: {auth0_roles} -> {role}")
            else:
                # No roles array - default to analyst for regular customers
                role = Role.ANALYST.value

        organization_id = claims.get(f"{namespace}/organization_id", "")
        # For platform admins, use org_id if organization_id not set
        if not organization_id:
            organization_id = claims.get(f"{namespace}/org_id", "")

        username = claims.get("name", email)

        # AUTO-PROVISION FALLBACK: For local dev when Auth0 Action can't reach backend
        # If user has valid Auth0 token but no org_id, auto-provision them
        if not organization_id and user_id and email:
            logger.info(f"[AuthMiddleware] No org_id in JWT, attempting auto-provision for {email}")
            org_id_result, auth0_org_id = await _auto_provision_user_if_needed(
                auth0_user_id=user_id,
                email=email,
                name=username or email.split("@")[0]
            )
            if org_id_result:
                organization_id = org_id_result
                logger.info(f"[AuthMiddleware] Auto-provisioned: org_id={organization_id}")

    else:
        user_id = claims.get("sub", claims.get("user_id", ""))
        email = claims.get("email", "")
        role = claims.get("role", Role.ANALYST.value)
        organization_id = claims.get("organization_id", claims.get("org_id", ""))
        username = claims.get("name", claims.get("username", email))

    return AuthContext(
        user_id=user_id,
        organization_id=organization_id,
        role=role,
        email=email,
        username=username,
        auth_provider=provider,
        extra=claims,
    )


# =============================================================================
# Middleware Implementation
# =============================================================================

class AuthMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for authentication.

    This middleware:
    1. Checks if the path requires authentication
    2. Extracts and validates auth tokens
    3. Builds AuthContext and attaches to request.state
    4. Logs all authentication events

    Configuration:
        - PUBLIC_PATHS: Set of paths that don't require auth
        - PUBLIC_PATH_PREFIXES: List of path prefixes that don't require auth
    """

    def __init__(
        self,
        app: ASGIApp,
        public_paths: Optional[Set[str]] = None,
        public_prefixes: Optional[List[str]] = None,
        require_auth: bool = False,
    ):
        """
        Initialize the auth middleware.

        Args:
            app: ASGI application
            public_paths: Additional public paths (merged with defaults)
            public_prefixes: Additional public prefixes (merged with defaults)
            require_auth: If True, reject unauthenticated requests to protected paths
        """
        super().__init__(app)
        self.public_paths = PUBLIC_PATHS | (public_paths or set())
        self.public_prefixes = PUBLIC_PATH_PREFIXES + (public_prefixes or [])
        self.require_auth = require_auth

    def is_public_path(self, path: str) -> bool:
        """Check if the path is public (no auth required)."""
        if path in self.public_paths:
            return True

        for prefix in self.public_prefixes:
            if path.startswith(prefix):
                return True

        return False

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, handling proxies securely.

        SECURITY: X-Forwarded-For can be spoofed by attackers. We use
        settings.trusted_proxy_count to determine which proxy hop to trust:
        - 0: Ignore X-Forwarded-For entirely (most secure, use when not behind proxy)
        - 1: Trust only the last entry (single reverse proxy like nginx)
        - 2: Trust second-to-last entry (CDN + load balancer)

        The rightmost IPs in X-Forwarded-For are added by trusted proxies,
        while leftmost IPs can be forged by clients.
        """
        from app.config import settings

        trusted_proxy_count = getattr(settings, 'trusted_proxy_count', 0)

        # X-Real-IP is set by the reverse proxy itself (most trusted when available)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

        # Check X-Forwarded-For header (only if we trust proxies)
        if trusted_proxy_count > 0:
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                # Split and get the IP from the trusted proxy position
                # Example with trusted_proxy_count=1: "spoofed, real, proxy" -> "real"
                ips = [ip.strip() for ip in forwarded_for.split(",")]
                if len(ips) >= trusted_proxy_count:
                    # Get the IP that was added by the first trusted proxy
                    # (counting from the right)
                    trusted_index = len(ips) - trusted_proxy_count
                    return ips[trusted_index]
                elif ips:
                    # Not enough hops - use the first IP (may be spoofed)
                    # This happens if client connects directly without expected proxies
                    logger.warning(
                        f"[AuthMiddleware] X-Forwarded-For has fewer IPs ({len(ips)}) "
                        f"than trusted_proxy_count ({trusted_proxy_count})"
                    )
                    return ips[0]

        # Fallback to client.host (direct connection IP)
        if request.client:
            return request.client.host

        return "unknown"

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response]
    ) -> Response:
        """
        Process the request through the middleware.

        Args:
            request: Incoming request
            call_next: Next middleware/handler in chain

        Returns:
            Response from downstream handler
        """
        path = request.url.path
        method = request.method
        client_ip = self._get_client_ip(request)

        # Check if this is a public path - we'll still TRY to authenticate
        # (if token provided) but won't REQUIRE it
        is_public = self.is_public_path(path)
        if is_public:
            logger.debug(f"[AuthMiddleware] Public path, auth optional: {path}")

        # Check rate limiting BEFORE attempting authentication
        if _check_rate_limit(client_ip):
            logger.warning(
                f"[AuthMiddleware] Rate-limited request: ip={client_ip} path={path}"
            )
            return Response(
                content='{"detail": "Too many failed authentication attempts. Please try again later."}',
                status_code=429,
                media_type="application/json",
            )

        # Try to extract and validate auth
        auth_context = None
        auth_error = None

        try:
            auth_context = await self._authenticate_request(request)
        except AuthContextError as e:
            auth_error = e
            _record_auth_failure(client_ip)
            logger.warning(
                f"[AuthMiddleware] Auth failed: path={path} ip={client_ip} error={e.detail}"
            )
        except Exception as e:
            auth_error = AuthContextError(
                error_code=AuthErrorCode.INTERNAL_ERROR,
                detail=f"Authentication error: {str(e)}",
            )
            _record_auth_failure(client_ip)
            logger.error(
                f"[AuthMiddleware] Unexpected auth error: path={path} ip={client_ip} error={e}",
                exc_info=True
            )

        # Clear failures on successful auth
        if auth_context:
            _clear_auth_failures(client_ip)

        # Attach auth context to request (even if None)
        request.state.auth_context = auth_context

        # If auth required and failed, return error
        # BUT for public paths, don't require auth even if require_auth is True
        if self.require_auth and auth_context is None and not is_public:
            if auth_error:
                return Response(
                    content=str(auth_error.detail),
                    status_code=auth_error.status_code,
                    media_type="application/json",
                )
            else:
                return Response(
                    content='{"detail": "Authentication required"}',
                    status_code=401,
                    media_type="application/json",
                )

        # Log successful auth
        if auth_context:
            logger.info(
                f"[AuthMiddleware] Authenticated: user={auth_context.user_id} "
                f"org={auth_context.organization_id} role={auth_context.role} "
                f"path={path}"
            )

        # Continue to handler
        return await call_next(request)

    async def _authenticate_request(self, request: Request) -> Optional[AuthContext]:
        """
        Attempt to authenticate the request using available methods.

        Priority:
        1. Admin API token (for CNS Dashboard internal requests)
        2. Bearer token (Supabase/Auth0)
        3. Query param token (for SSE/EventSource endpoints)
        4. API key
        5. Custom headers (X-Actor-ID)

        Returns:
            AuthContext if authenticated, None otherwise
        """
        # Try Bearer token first
        token = extract_bearer_token(request)

        # For SSE/EventSource paths, also check query param (EventSource can't send headers)
        if not token:
            path = request.url.path
            for prefix in QUERY_PARAM_AUTH_PREFIXES:
                if path.startswith(prefix):
                    query_token = request.query_params.get("token")
                    if query_token:
                        logger.info(f"[AuthMiddleware] Using query param token for SSE path: {path}")
                        token = query_token
                    break
        if token:
            # Check if this is the admin API token (for CNS Dashboard)
            admin_token = getattr(settings, 'admin_api_token', None)
            if admin_token and token == admin_token:
                logger.debug("[AuthMiddleware] Admin API token validated")
                return AuthContext(
                    user_id="cns-admin",
                    organization_id="",  # Empty = super admin access to all orgs
                    role=Role.SUPER_ADMIN.value,
                    email="admin@cns.local",
                    username="CNS Admin",
                    auth_provider="admin_token",
                )

            # Determine provider by checking JWT algorithm
            import json
            try:
                parts = token.split(".")
                if len(parts) == 3:
                    header_json = _base64url_decode(parts[0])
                    header = json.loads(header_json)
                    alg = header.get("alg", "HS256")

                    # Route to appropriate validator based on algorithm
                    if alg == "RS256":
                        # Auth0 uses RS256
                        logger.info("[AuthMiddleware] Detected RS256 token, trying Auth0")
                        claims = await validate_auth0_token(token)
                        if claims:
                            logger.info(f"[AuthMiddleware] Auth0 validation SUCCESS: sub={claims.get('sub')}")
                            auth_ctx = await build_auth_context_from_token(claims, "auth0")

                            # Use header fallbacks for Auth0 tokens (email/org often not in access tokens)
                            needs_rebuild = False
                            new_org_id = auth_ctx.organization_id
                            new_email = auth_ctx.email

                            if not auth_ctx.organization_id:
                                header_org_id = request.headers.get(ORG_ID_HEADER)
                                if header_org_id:
                                    logger.info(f"[AuthMiddleware] Using X-Organization-Id header: {header_org_id}")
                                    new_org_id = header_org_id
                                    needs_rebuild = True

                            if not auth_ctx.email:
                                header_email = request.headers.get(USER_EMAIL_HEADER)
                                if header_email:
                                    logger.info(f"[AuthMiddleware] Using X-User-Email header: {header_email}")
                                    new_email = header_email
                                    needs_rebuild = True

                            if needs_rebuild:
                                auth_ctx = AuthContext(
                                    user_id=auth_ctx.user_id,
                                    organization_id=new_org_id,
                                    role=auth_ctx.role,
                                    email=new_email,
                                    username=auth_ctx.username,
                                    auth_provider=auth_ctx.auth_provider,
                                    extra=auth_ctx.extra,
                                )
                            return auth_ctx
                        logger.warning("[AuthMiddleware] Auth0 validation FAILED")
                    elif alg == "HS256":
                        # Supabase uses HS256
                        logger.info("[AuthMiddleware] Detected HS256 token, trying Supabase")
                        claims = await validate_supabase_token(token)
                        if claims:
                            return await build_auth_context_from_token(claims, "supabase")
                    else:
                        logger.warning(f"[AuthMiddleware] Unsupported JWT algorithm: {alg}")
            except Exception as e:
                logger.error(f"[AuthMiddleware] Failed to detect token type: {e}")

            logger.debug("[AuthMiddleware] Bearer token invalid")

        # Try API key
        api_key = extract_api_key(request)
        if api_key:
            claims = await validate_api_key(api_key)
            if claims:
                return await build_auth_context_from_token(claims, "api_key")

            logger.debug("[AuthMiddleware] API key invalid")

        # Try custom headers (for service-to-service or gateway-authenticated requests)
        actor_id, org_id = extract_actor_from_headers(request)
        if actor_id:
            logger.debug(
                f"[AuthMiddleware] Using header auth: actor={actor_id} org={org_id}"
            )
            return AuthContext(
                user_id=actor_id,
                organization_id=org_id or "",
                role=Role.ANALYST.value,
                auth_provider="headers",
            )

        # No auth found
        logger.debug("[AuthMiddleware] No authentication credentials found")
        return None


# =============================================================================
# Setup Function
# =============================================================================

def setup_auth_middleware(
    app: FastAPI,
    public_paths: Optional[Set[str]] = None,
    public_prefixes: Optional[List[str]] = None,
    require_auth: bool = False,
) -> None:
    """
    Set up the authentication middleware on a FastAPI app.

    Usage:
        from app.middleware import setup_auth_middleware

        app = FastAPI()
        setup_auth_middleware(app, require_auth=False)  # Optional auth
        # or
        setup_auth_middleware(app, require_auth=True)   # Required auth

    Args:
        app: FastAPI application instance
        public_paths: Additional paths that don't require auth
        public_prefixes: Additional path prefixes that don't require auth
        require_auth: If True, reject unauthenticated requests
    """
    app.add_middleware(
        AuthMiddleware,
        public_paths=public_paths,
        public_prefixes=public_prefixes,
        require_auth=require_auth,
    )

    logger.info(
        f"[AuthMiddleware] Initialized: require_auth={require_auth} "
        f"public_paths={len(PUBLIC_PATHS | (public_paths or set()))} "
        f"public_prefixes={len(PUBLIC_PATH_PREFIXES + (public_prefixes or []))}"
    )
