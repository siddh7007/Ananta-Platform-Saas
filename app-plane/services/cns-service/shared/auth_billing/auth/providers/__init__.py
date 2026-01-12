"""
Authentication Providers

This submodule contains provider-specific JWT validation implementations:
- Supabase (HS256 symmetric key)
- Auth0 (RS256 asymmetric key with JWKS)

Usage:
    from shared.auth_billing.auth.providers import (
        BaseAuthProvider,
        SupabaseAuthProvider,
        Auth0AuthProvider,
    )
"""

from shared.auth_billing.auth.providers.base import BaseAuthProvider
from shared.auth_billing.auth.providers.supabase import (
    SupabaseAuthProvider,
    validate_supabase_token,
)
from shared.auth_billing.auth.providers.auth0 import (
    Auth0AuthProvider,
    validate_auth0_token,
)

__all__ = [
    "BaseAuthProvider",
    "SupabaseAuthProvider",
    "validate_supabase_token",
    "Auth0AuthProvider",
    "validate_auth0_token",
]
