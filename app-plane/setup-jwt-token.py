#!/usr/bin/env python3
"""
JWT Token Setup Script for CNS Testing
Sets up Keycloak user password and obtains JWT token
"""

import requests
import json
import sys

# Configuration
KEYCLOAK_URL = "http://localhost:8180"
REALM = "ananta-saas"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"

# Test user credentials
TEST_USER_EMAIL = "admin@cbp.local"
TEST_USER_PASSWORD = "Test123!@#"  # Strong password for testing

def get_admin_token():
    """Get Keycloak admin access token"""
    url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
    data = {
        "client_id": "admin-cli",
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
        "grant_type": "password"
    }

    print(f"Getting admin token from {url}...")
    response = requests.post(url, data=data)

    if response.status_code != 200:
        print(f"Error getting admin token: {response.status_code}")
        print(response.text)
        return None

    token_data = response.json()
    return token_data.get("access_token")

def get_user_id_by_email(admin_token, email):
    """Get Keycloak user ID by email"""
    url = f"{KEYCLOAK_URL}/admin/realms/{REALM}/users"
    headers = {"Authorization": f"Bearer {admin_token}"}
    params = {"email": email, "exact": "true"}

    print(f"Looking up user: {email}...")
    response = requests.get(url, headers=headers, params=params)

    if response.status_code != 200:
        print(f"Error getting user: {response.status_code}")
        print(response.text)
        return None

    users = response.json()
    if not users:
        print(f"User not found: {email}")
        return None

    return users[0]["id"]

def reset_user_password(admin_token, user_id, new_password):
    """Reset user password in Keycloak"""
    url = f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{user_id}/reset-password"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    data = {
        "type": "password",
        "value": new_password,
        "temporary": False
    }

    print(f"Resetting password for user {user_id}...")
    response = requests.put(url, headers=headers, json=data)

    if response.status_code != 204:
        print(f"Error resetting password: {response.status_code}")
        print(response.text)
        return False

    print("Password reset successfully!")
    return True

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
    print("JWT Token Setup for CNS Testing")
    print("=" * 70)
    print()

    # Step 1: Get admin token
    admin_token = get_admin_token()
    if not admin_token:
        print("Failed to get admin token")
        sys.exit(1)

    print(f"Admin token: {admin_token[:50]}...")
    print()

    # Step 2: Get user ID
    user_id = get_user_id_by_email(admin_token, TEST_USER_EMAIL)
    if not user_id:
        print("Failed to find user")
        sys.exit(1)

    print(f"User ID: {user_id}")
    print()

    # Step 3: Reset password
    if not reset_user_password(admin_token, user_id, TEST_USER_PASSWORD):
        print("Failed to reset password")
        sys.exit(1)

    print()

    # Step 4: Get user token
    token_data = get_user_token(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    if not token_data:
        print("Failed to get user token")
        sys.exit(1)

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")

    print()
    print("=" * 70)
    print("SUCCESS! JWT Token obtained")
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
    output_file = "jwt-token.txt"
    with open(output_file, "w") as f:
        f.write(f"# JWT Token for CNS Testing\n")
        f.write(f"# Email: {TEST_USER_EMAIL}\n")
        f.write(f"# Password: {TEST_USER_PASSWORD}\n")
        f.write(f"# Expires in: {expires_in} seconds\n")
        f.write(f"# Generated: $(date)\n\n")
        f.write(f"export TOKEN=\"{access_token}\"\n")

    print(f"Token saved to: {output_file}")
    print()
    print("To use in bash:")
    print(f"  source {output_file}")
    print(f"  curl -H \"Authorization: Bearer $TOKEN\" http://localhost:27200/api/...")
    print()

if __name__ == "__main__":
    main()
