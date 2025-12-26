"""
Middleware Package

Contains FastAPI middleware for authentication, logging, and request handling.
"""

from app.middleware.auth_middleware import (
    AuthMiddleware,
    setup_auth_middleware,
)
from app.middleware.rate_limit import (
    RateLimitMiddleware,
    setup_rate_limit_middleware,
)

__all__ = [
    "AuthMiddleware",
    "setup_auth_middleware",
    "RateLimitMiddleware",
    "setup_rate_limit_middleware",
]
