"""
Authentication Error Definitions

This module defines structured error codes and exceptions for
authentication and authorization failures.
"""

from enum import Enum
from typing import Optional

from fastapi import HTTPException, status


class AuthErrorCode(str, Enum):
    """Structured error codes for authorization failures."""

    MISSING_AUTH_CONTEXT = "AUTH_MISSING_CONTEXT"
    MISSING_USER_ID = "AUTH_MISSING_USER_ID"
    MISSING_ORG_ID = "AUTH_MISSING_ORG_ID"
    ORG_MISMATCH = "AUTH_ORG_MISMATCH"
    ROLE_INSUFFICIENT = "AUTH_ROLE_INSUFFICIENT"
    MEMBERSHIP_NOT_FOUND = "AUTH_MEMBERSHIP_NOT_FOUND"
    TOKEN_INVALID = "AUTH_TOKEN_INVALID"
    TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    INTERNAL_ERROR = "AUTH_INTERNAL_ERROR"


class AuthContextError(HTTPException):
    """Custom exception for authorization errors with structured responses."""

    def __init__(
        self,
        error_code: AuthErrorCode,
        detail: str,
        status_code: int = status.HTTP_403_FORBIDDEN,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
    ):
        self.error_code = error_code
        self.user_id = user_id
        self.organization_id = organization_id

        super().__init__(
            status_code=status_code,
            detail={
                "detail": detail,
                "error_code": error_code.value,
                "user_id": user_id,
                "organization_id": organization_id,
            }
        )
