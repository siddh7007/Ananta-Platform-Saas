"""
FastAPI Authentication Middleware

Middleware that validates authentication tokens and populates
request.state.auth_context for downstream handlers.
"""

import logging
import time
from collections import defaultdict
from typing import Callable, List, Optional, Set

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from shared.auth_billing.config import AuthConfig
from shared.auth_billing.auth.context import AuthContext
from shared.auth_billing.auth.roles import Role
from shared.auth_billing.auth.errors import AuthContextError, AuthErrorCode
from shared.auth_billing.auth.providers.supabase import validate_supabase_token
from shared.auth_billing.auth.providers.auth0 import validate_auth0_token

logger = logging.getLogger(__name__)


# Headers to check for auth tokens
AUTH_HEADER = "Authorization"
API_KEY_HEADER = "X-API-Key"
ACTOR_ID_HEADER = "X-Actor-ID"
ORG_ID_HEADER = "X-Organization-ID"


# Rate limiting state (in-memory - per process)
_failed_auth_attempts: dict = defaultdict(lambda: {"count": 0, "reset_at": 0})


def _check_rate_limit(client_ip: str, config: AuthConfig) -> bool:
    """Check if the client IP is rate-limited."""
    now = time.time()
    record = _failed_auth_attempts[client_ip]

    if now > record["reset_at"]:
        record["count"] = 0
        record["reset_at"] = now + config.rate_limit_window_seconds

    return record["count"] >= config.rate_limit_max_failures


def _record_auth_failure(client_ip: str, config: AuthConfig) -> None:
    """Record a failed auth attempt."""
    now = time.time()
    record = _failed_auth_attempts[client_ip]

    if now > record["reset_at"]:
        record["count"] = 1
        record["reset_at"] = now + config.rate_limit_window_seconds
    else:
        record["count"] += 1

    if record["count"] >= config.rate_limit_max_failures:
        logger.warning(f"[AuthMiddleware] Rate limit triggered: ip={client_ip}")


def _clear_auth_failures(client_ip: str) -> None:
    """Clear failed auth attempts on successful auth."""
    if client_ip in _failed_auth_attempts:
        del _failed_auth_attempts[client_ip]


def extract_bearer_token(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get(AUTH_HEADER)

    if not auth_header:
        return None

    parts = auth_header.split()

    if len(parts) != 2 or parts[0].lower() != "bearer":
        logger.debug("[AuthMiddleware] Invalid Authorization header format")
        return None

    return parts[1]


def extract_api_key(request: Request) -> Optional[str]:
    """Extract API key from X-API-Key header."""
    return request.headers.get(API_KEY_HEADER)


def extract_actor_from_headers(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Extract actor info from custom headers (service-to-service)."""
    actor_id = request.headers.get(ACTOR_ID_HEADER)
    org_id = request.headers.get(ORG_ID_HEADER)
    return actor_id, org_id


async def build_auth_context_from_token(claims: dict, provider: str) -> AuthContext:
    """Build AuthContext from validated token claims."""
    if provider == "supabase":
        user_id = claims.get("sub", "")
        email = claims.get("email", "")
        user_metadata = claims.get("user_metadata", {})
        role = user_metadata.get("role", Role.ANALYST.value)
        organization_id = user_metadata.get("organization_id", "")
        username = user_metadata.get("full_name", email)

    elif provider == "auth0":
        user_id = claims.get("sub", "")
        email = claims.get("email", "")
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


class AuthMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for authentication.

    This middleware:
    1. Checks if the path requires authentication
    2. Extracts and validates auth tokens
    3. Builds AuthContext and attaches to request.state
    4. Logs all authentication events
    """

    def __init__(
        self,
        app: ASGIApp,
        config: AuthConfig,
        require_auth: bool = False,
    ):
        """
        Initialize the auth middleware.

        Args:
            app: ASGI application
            config: AuthConfig with settings
            require_auth: If True, reject unauthenticated requests
        """
        super().__init__(app)
        self.config = config
        self.require_auth = require_auth

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP securely, handling proxy headers."""
        trusted_proxy_count = self.config.trusted_proxy_count

        # X-Real-IP is most trusted when set by reverse proxy
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

        # Check X-Forwarded-For (only if we trust proxies)
        if trusted_proxy_count > 0:
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                ips = [ip.strip() for ip in forwarded_for.split(",")]
                if len(ips) >= trusted_proxy_count:
                    trusted_index = len(ips) - trusted_proxy_count
                    return ips[trusted_index]
                elif ips:
                    return ips[0]

        # Fallback to client.host
        if request.client:
            return request.client.host

        return "unknown"

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response]
    ) -> Response:
        """Process the request through the middleware."""
        path = request.url.path
        client_ip = self._get_client_ip(request)

        # Skip auth for public paths
        if self.config.is_public_path(path):
            logger.debug(f"[AuthMiddleware] Public path, skipping auth: {path}")
            return await call_next(request)

        # Check rate limiting
        if _check_rate_limit(client_ip, self.config):
            logger.warning(f"[AuthMiddleware] Rate-limited: ip={client_ip} path={path}")
            return Response(
                content='{"detail": "Too many failed authentication attempts"}',
                status_code=429,
                media_type="application/json",
            )

        # Try to authenticate
        auth_context = None
        auth_error = None

        try:
            auth_context = await self._authenticate_request(request)
        except AuthContextError as e:
            auth_error = e
            _record_auth_failure(client_ip, self.config)
            logger.warning(f"[AuthMiddleware] Auth failed: path={path} ip={client_ip}")
        except Exception as e:
            auth_error = AuthContextError(
                error_code=AuthErrorCode.INTERNAL_ERROR,
                detail=f"Authentication error: {str(e)}",
            )
            _record_auth_failure(client_ip, self.config)
            logger.error(f"[AuthMiddleware] Unexpected error: {e}", exc_info=True)

        # Clear failures on success
        if auth_context:
            _clear_auth_failures(client_ip)

        # Attach auth context to request
        request.state.auth_context = auth_context

        # If auth required and failed, return error
        if self.require_auth and auth_context is None:
            if auth_error:
                return Response(
                    content=str(auth_error.detail),
                    status_code=auth_error.status_code,
                    media_type="application/json",
                )
            return Response(
                content='{"detail": "Authentication required"}',
                status_code=401,
                media_type="application/json",
            )

        # Log successful auth
        if auth_context:
            logger.info(
                f"[AuthMiddleware] Authenticated: user={auth_context.user_id} "
                f"org={auth_context.organization_id} role={auth_context.role} path={path}"
            )

        return await call_next(request)

    async def _authenticate_request(self, request: Request) -> Optional[AuthContext]:
        """Attempt to authenticate using available methods."""
        # Try Bearer token first
        token = extract_bearer_token(request)
        if token:
            # Check admin API token
            if self.config.admin_api_token and token == self.config.admin_api_token:
                logger.debug("[AuthMiddleware] Admin API token validated")
                return AuthContext(
                    user_id="admin",
                    organization_id="",
                    role=Role.SUPER_ADMIN.value,
                    email="admin@local",
                    username="Admin",
                    auth_provider="admin_token",
                )

            # Try Supabase validation
            if self.config.jwt_secret_key:
                claims = await validate_supabase_token(
                    token, self.config.jwt_secret_key
                )
                if claims:
                    return await build_auth_context_from_token(claims, "supabase")

            # Try Auth0 validation
            if self.config.auth0_enabled and self.config.auth0_domain:
                claims = await validate_auth0_token(
                    token,
                    auth0_domain=self.config.auth0_domain,
                    auth0_audience=self.config.auth0_audience,
                    jwks_cache_ttl_seconds=self.config.jwks_cache_ttl_seconds
                )
                if claims:
                    return await build_auth_context_from_token(claims, "auth0")

            logger.debug("[AuthMiddleware] Bearer token invalid")

        # Try custom headers (service-to-service)
        actor_id, org_id = extract_actor_from_headers(request)
        if actor_id:
            logger.debug(f"[AuthMiddleware] Using header auth: actor={actor_id}")
            return AuthContext(
                user_id=actor_id,
                organization_id=org_id or "",
                role=Role.ANALYST.value,
                auth_provider="headers",
            )

        return None


def setup_auth_middleware(
    app: FastAPI,
    config: AuthConfig,
    require_auth: bool = False,
) -> None:
    """
    Set up the authentication middleware on a FastAPI app.

    Usage:
        from shared.auth_billing.middleware import setup_auth_middleware
        from shared.auth_billing.config import AuthConfig

        config = AuthConfig(jwt_secret_key=os.environ["JWT_SECRET_KEY"])
        app = FastAPI()
        setup_auth_middleware(app, config)

    Args:
        app: FastAPI application instance
        config: AuthConfig with settings
        require_auth: If True, reject unauthenticated requests
    """
    app.add_middleware(
        AuthMiddleware,
        config=config,
        require_auth=require_auth,
    )

    logger.info(
        f"[AuthMiddleware] Initialized: require_auth={require_auth} "
        f"public_paths={len(config.public_paths)}"
    )
