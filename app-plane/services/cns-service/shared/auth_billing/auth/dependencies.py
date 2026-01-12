"""
FastAPI Dependencies for Authentication

This module provides FastAPI dependency functions for extracting
AuthContext from requests.
"""

import logging
from typing import Optional

from fastapi import Request, status

from shared.auth_billing.auth.context import AuthContext
from shared.auth_billing.auth.errors import AuthContextError, AuthErrorCode

logger = logging.getLogger(__name__)


async def get_auth_context(request: Request) -> AuthContext:
    """
    FastAPI dependency to extract AuthContext from request.

    The auth middleware populates request.state.auth_context. This dependency
    retrieves it and raises appropriate errors if missing.

    Usage:
        @router.get("/resource")
        async def get_resource(auth: AuthContext = Depends(get_auth_context)):
            ...

    Raises:
        AuthContextError: If auth context is missing or invalid
    """
    try:
        auth_context = getattr(request.state, "auth_context", None)

        if auth_context is None:
            logger.error("[Auth] No auth context found in request state")
            raise AuthContextError(
                error_code=AuthErrorCode.MISSING_AUTH_CONTEXT,
                detail="Authentication required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if not isinstance(auth_context, AuthContext):
            logger.error(f"[Auth] Invalid auth context type: {type(auth_context)}")
            raise AuthContextError(
                error_code=AuthErrorCode.INTERNAL_ERROR,
                detail="Invalid authentication state",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.debug(
            f"[Auth] Context retrieved: user={auth_context.user_id} "
            f"org={auth_context.organization_id} role={auth_context.role}"
        )

        return auth_context

    except AuthContextError:
        raise
    except Exception as e:
        logger.error(f"[Auth] Error extracting auth context: {str(e)}", exc_info=True)
        raise AuthContextError(
            error_code=AuthErrorCode.INTERNAL_ERROR,
            detail="Authentication error",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


async def get_optional_auth_context(request: Request) -> Optional[AuthContext]:
    """
    FastAPI dependency for optional authentication.

    Returns None if no auth context is present instead of raising an error.
    Useful for endpoints that have different behavior for authenticated vs
    unauthenticated users.
    """
    try:
        return await get_auth_context(request)
    except AuthContextError:
        return None
