"""
JWT Token Generator for Testing

Generates valid Supabase-format JWT tokens for API testing.
Uses HS256 (HMAC-SHA256) signature with the JWT_SECRET_KEY from environment.
"""

import json
import base64
import hmac
import hashlib
import time
import os
import uuid


# Generate consistent UUIDs for testing (deterministic from seed)
TEST_USER_UUID = "00000000-0000-4000-8000-000000000001"
TEST_ORG_UUID = "00000000-0000-4000-8000-000000000002"


def generate_test_token(
    user_id: str = TEST_USER_UUID,
    organization_id: str = TEST_ORG_UUID,
    role: str = "super_admin",
    email: str = "admin@test.local",
    expires_in: int = 3600
) -> str:
    """
    Generate a valid Supabase-format JWT for testing.

    Args:
        user_id: User identifier (sub claim)
        organization_id: Organization ID for multi-tenant access
        role: User role (analyst, engineer, admin, owner, super_admin)
        email: User email address
        expires_in: Token validity in seconds (default 1 hour)

    Returns:
        JWT token string (header.payload.signature)
    """
    # Get secret from environment or use default dev secret
    secret = os.getenv(
        "JWT_SECRET_KEY",
        "local-dev-secret-123456789012345678901234567890"
    )

    # Create header
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(
        json.dumps(header, separators=(',', ':')).encode()
    ).decode().rstrip('=')

    # Create payload with Supabase-compatible claims
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "email_verified": True,
        "exp": now + expires_in,
        "nbf": now,
        "iat": now,
        "iss": "supabase",
        "aud": "authenticated",
        "role": role,
        "user_metadata": {
            "role": role,
            "organization_id": organization_id,
            "full_name": "Test Super Admin"
        }
    }
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(',', ':')).encode()
    ).decode().rstrip('=')

    # Create signature using HMAC-SHA256
    message = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(
        secret.encode(),
        message,
        hashlib.sha256
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip('=')

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def generate_admin_token() -> str:
    """Generate a super admin token with default settings."""
    return generate_test_token(
        user_id=TEST_USER_UUID,
        organization_id=TEST_ORG_UUID,
        role="super_admin",
        email="admin@test.local"
    )


def generate_user_token(
    role: str = "analyst",
    organization_id: str = TEST_ORG_UUID
) -> str:
    """Generate a token for a regular user with specified role."""
    # Generate a deterministic UUID based on role
    role_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"test-{role}"))
    return generate_test_token(
        user_id=role_uuid,
        organization_id=organization_id,
        role=role,
        email=f"{role}@test.local"
    )


if __name__ == "__main__":
    # Generate and print a test token when run directly
    token = generate_admin_token()
    print(f"Generated Super Admin Token:\n{token}\n")

    # Decode and show payload for verification
    parts = token.split('.')
    if len(parts) == 3:
        # Add padding for base64 decode
        payload_b64 = parts[1] + '=' * (4 - len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        print("Decoded Payload:")
        print(json.dumps(payload, indent=2))
