#!/usr/bin/env python3
"""
JWT Token Setup Script for Second Test User (user2@test.local)
Gets JWT token for cross-tenant testing
"""

import requests
import json
import sys

# Configuration
KEYCLOAK_URL = "http://localhost:8180"
REALM = "ananta-saas"

# Second test user credentials
TEST_USER_EMAIL = "user2@test.local"
TEST_USER_PASSWORD = "Test123!@#"

def get_user_token(email, password):
    """Get JWT token for user"""
    url = f"{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token"
    data = {
        "client_id": "admin-cli",
        "username": email,
        "password": password,
        "grant_type": "password"
    }

    print(f"Getting JWT token for {email}...")
    response = requests.post(url, data=data)

    if response.status_code != 200:
        print(f"Error getting token: {response.status_code}")
        print(response.text)
        return None

    token_data = response.json()
    return token_data

def main():
    print("=" * 70)
    print("JWT Token Setup for Second Test User")
    print("=" * 70)
    print()

    # Get user token
    token_data = get_user_token(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    if not token_data:
        print("Failed to get user token")
        sys.exit(1)

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")

    print()
    print("=" * 70)
    print("SUCCESS! JWT Token obtained for User 2")
    print("=" * 70)
    print()
    print(f"Email: {TEST_USER_EMAIL}")
    print(f"Password: {TEST_USER_PASSWORD}")
    print(f"Token expires in: {expires_in} seconds ({expires_in//60} minutes)")
    print()
    print("Access Token (first 100 chars):")
    print(access_token[:100])
    print()
    print("Full Access Token:")
    print(access_token)
    print()

    # Save to file
    output_file = "jwt-token-user2.txt"
    with open(output_file, "w") as f:
        f.write(f"# JWT Token for Second Test User (Cross-Tenant Testing)\n")
        f.write(f"# Email: {TEST_USER_EMAIL}\n")
        f.write(f"# Password: {TEST_USER_PASSWORD}\n")
        f.write(f"# Organization: a1111111-1111-1111-1111-111111111111 (Ananta Platform)\n")
        f.write(f"# Expires in: {expires_in} seconds\n")
        f.write(f"# Generated: $(date)\n\n")
        f.write(f"export TOKEN_USER2=\"{access_token}\"\n")

    print(f"Token saved to: {output_file}")
    print()
    print("To use in bash:")
    print(f"  source {output_file}")
    print(f"  curl -H \"Authorization: Bearer $TOKEN_USER2\" http://localhost:27200/api/...")
    print()

if __name__ == "__main__":
    main()
