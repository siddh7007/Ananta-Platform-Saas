"""
Role-Based Access Decorators

This module provides decorators for enforcing role requirements on endpoints.
"""

import logging
from functools import wraps
from typing import Callable, Union

from fastapi import status

from shared.auth_billing.auth.roles import Role
from shared.auth_billing.auth.errors import AuthContextError, AuthErrorCode

logger = logging.getLogger(__name__)


def require_role(required_role: Union[str, Role]):
    """
    Decorator to require a minimum role for an endpoint.

    Usage:
        @router.delete("/resource/{id}")
        @require_role(Role.ADMIN)
        async def delete_resource(
            id: str,
            auth: AuthContext = Depends(get_auth_context)
        ):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find auth context in kwargs
            auth = kwargs.get("auth")
            if auth is None:
                # Try to find it by type
                for v in kwargs.values():
                    # Check if it's an AuthContext-like object
                    if hasattr(v, 'has_role') and hasattr(v, 'user_id'):
                        auth = v
                        break

            if auth is None:
                logger.error(f"[Auth] No auth context found for role check in {func.__name__}")
                raise AuthContextError(
                    error_code=AuthErrorCode.MISSING_AUTH_CONTEXT,
                    detail="Authentication required",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

            if not auth.has_role(required_role):
                role_name = required_role.value if isinstance(required_role, Role) else required_role
                logger.warning(
                    f"[Auth] DENIED: user={auth.user_id} "
                    f"has_role={auth.role} required_role={role_name} "
                    f"endpoint={func.__name__}"
                )
                raise AuthContextError(
                    error_code=AuthErrorCode.ROLE_INSUFFICIENT,
                    detail=f"Requires {role_name} role or higher",
                    status_code=status.HTTP_403_FORBIDDEN,
                    user_id=auth.user_id,
                    organization_id=auth.organization_id,
                )

            logger.info(
                f"[Auth] Role check PASSED: user={auth.user_id} "
                f"role={auth.role} required={required_role} endpoint={func.__name__}"
            )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def require_same_org(org_id_param: str = "organization_id"):
    """
    Decorator to require the user belongs to the target organization.

    Usage:
        @router.get("/orgs/{organization_id}/data")
        @require_same_org("organization_id")
        async def get_org_data(
            organization_id: str,
            auth: AuthContext = Depends(get_auth_context)
        ):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")
            target_org = kwargs.get(org_id_param)

            if auth is None:
                logger.error(f"[Auth] No auth context for org check in {func.__name__}")
                raise AuthContextError(
                    error_code=AuthErrorCode.MISSING_AUTH_CONTEXT,
                    detail="Authentication required",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

            if target_org and not auth.can_access_organization(target_org):
                logger.warning(
                    f"[Auth] DENIED org access: user={auth.user_id} "
                    f"user_org={auth.organization_id} target_org={target_org}"
                )
                raise AuthContextError(
                    error_code=AuthErrorCode.ORG_MISMATCH,
                    detail="Not authorized for this organization",
                    status_code=status.HTTP_403_FORBIDDEN,
                    user_id=auth.user_id,
                    organization_id=target_org,
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator
