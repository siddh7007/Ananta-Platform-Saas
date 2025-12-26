"""
Middleware Module

This submodule contains middleware adapters for web frameworks:
- FastAPI middleware for authentication

Usage:
    from shared.auth_billing.middleware import AuthMiddleware, setup_auth_middleware
"""

from shared.auth_billing.middleware.fastapi import (
    AuthMiddleware,
    setup_auth_middleware,
)

__all__ = [
    "AuthMiddleware",
    "setup_auth_middleware",
]
