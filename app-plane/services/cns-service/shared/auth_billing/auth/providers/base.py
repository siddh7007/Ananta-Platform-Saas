"""
Base Authentication Provider

Abstract base class for authentication providers.
"""

from abc import ABC, abstractmethod
from typing import Optional

from shared.auth_billing.auth.context import AuthContext


class BaseAuthProvider(ABC):
    """
    Abstract base class for authentication providers.

    Each provider implementation handles:
    - Token validation (signature, expiration, etc.)
    - Claims extraction
    - Building AuthContext from claims

    Usage:
        class MyCustomProvider(BaseAuthProvider):
            async def validate_token(self, token: str) -> Optional[dict]:
                # Custom validation logic
                return claims

            async def build_context(self, claims: dict) -> AuthContext:
                # Build AuthContext from provider-specific claims
                return AuthContext(...)
    """

    @abstractmethod
    async def validate_token(self, token: str) -> Optional[dict]:
        """
        Validate a token and return claims.

        Args:
            token: JWT token string

        Returns:
            Dict of claims if valid, None if invalid/expired
        """
        pass

    @abstractmethod
    async def build_context(self, claims: dict) -> AuthContext:
        """
        Build AuthContext from validated claims.

        Args:
            claims: Decoded JWT claims

        Returns:
            AuthContext instance
        """
        pass

    async def authenticate(self, token: str) -> Optional[AuthContext]:
        """
        Full authentication flow: validate token and build context.

        Args:
            token: JWT token string

        Returns:
            AuthContext if valid, None if invalid
        """
        claims = await self.validate_token(token)
        if claims:
            return await self.build_context(claims)
        return None
