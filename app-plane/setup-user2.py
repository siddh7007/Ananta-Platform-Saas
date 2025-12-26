#!/usr/bin/env python3
"""
Setup second test user for cross-tenant testing
Creates user2@test.local in Keycloak and database, adds to second organization
"""

import requests
import psycopg2
import uuid
import sys
from datetime import datetime

# Configuration
KEYCLOAK_URL = "http://localhost:8180"
REALM = "ananta-saas"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"

# Database connection
DB_CONFIG = {
    "host": "localhost",
    "port": 27432,
    "database": "postgres",
    "user": "postgres",
    "password": "postgres"
}

# Second user credentials
USER2_EMAIL = "user2@test.local"
USER2_PASSWORD = "Test123!@#"
USER2_FIRST_NAME = "Test"
USER2_LAST_NAME = "User2"
ORG2_ID = "a1111111-1111-1111-1111-111111111111"

def get_admin_token():
    """Get Keycloak admin access token"""
    url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
    data = {
        "client_id": "admin-cli",
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
        "grant_type": "password"
    }

    print(f"Getting admin token...")
    response = requests.post(url, data=data)

    if response.status_code != 200:
        print(f"Error getting admin token: {response.status_code}")
        print(response.text)
        return None

    return response.json().get("access_token")

def check_user_exists(admin_token, email):
    """Check if user exists in Keycloak"""
    url = f"{KEYCLOAK_URL}/admin/realms/{REALM}/users"
    headers = {"Authorization": f"Bearer {admin_token}"}
    params = {"email": email, "exact": "true"}

    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        users = response.json()
        return users[0] if users else None
    return None

def create_keycloak_user(admin_token, email, first_name, last_name, password):
    """Create user in Keycloak"""
    url = f"{KEYCLOAK_URL}/admin/realms/{REALM}/users"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    data = {
        "username": email.split('@')[0],  # user2
        "email": email,
        "emailVerified": True,
        "firstName": first_name,
        "lastName": last_name,
        "enabled": True,
        "credentials": [{
            "type": "password",
            "value": password,
            "temporary": False
        }]
    }

    print(f"Creating Keycloak user: {email}...")
    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 201:
        # Get user ID from location header
        location = response.headers.get('Location', '')
        user_id = location.split('/')[-1]
        print(f"Created Keycloak user: {user_id}")
        return user_id
    else:
        print(f"Error creating user: {response.status_code}")
        print(response.text)
        return None

def create_db_user_and_membership(email, keycloak_user_id, org_id):
    """Create user in database and add organization membership"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        # Check if user exists in DB
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        result = cur.fetchone()

        if result:
            user_id = result[0]
            print(f"User already exists in database: {user_id}")
        else:
            # Create user
            user_id = str(uuid.uuid4())
            now = datetime.utcnow()

            cur.execute("""
                INSERT INTO users (
                    id, email, email_verified, first_name, last_name,
                    keycloak_user_id, role, is_active, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id, email, True,
                USER2_FIRST_NAME, USER2_LAST_NAME,
                keycloak_user_id, "user", True, now, now
            ))
            print(f"Created database user: {user_id}")

        # Check if membership exists
        cur.execute("""
            SELECT id FROM organization_memberships
            WHERE user_id = %s AND organization_id = %s
        """, (user_id, org_id))

        if cur.fetchone():
            print(f"User already member of organization: {org_id}")
        else:
            # Create organization membership
            membership_id = str(uuid.uuid4())
            now = datetime.utcnow()

            cur.execute("""
                INSERT INTO organization_memberships (
                    id, user_id, organization_id, role, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (membership_id, user_id, org_id, "admin", now, now))
            print(f"Created organization membership: {membership_id}")

        conn.commit()
        return user_id

    except Exception as e:
        conn.rollback()
        print(f"Database error: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def main():
    print("=" * 70)
    print("Setup Second Test User for Cross-Tenant Testing")
    print("=" * 70)
    print()

    # Get admin token
    admin_token = get_admin_token()
    if not admin_token:
        print("Failed to get admin token")
        sys.exit(1)

    # Check if user exists in Keycloak
    existing_user = check_user_exists(admin_token, USER2_EMAIL)

    if existing_user:
        print(f"User already exists in Keycloak: {existing_user['id']}")
        keycloak_user_id = existing_user['id']
    else:
        # Create user in Keycloak
        keycloak_user_id = create_keycloak_user(
            admin_token, USER2_EMAIL,
            USER2_FIRST_NAME, USER2_LAST_NAME,
            USER2_PASSWORD
        )
        if not keycloak_user_id:
            print("Failed to create Keycloak user")
            sys.exit(1)

    print()

    # Create user in database and add to organization
    db_user_id = create_db_user_and_membership(USER2_EMAIL, keycloak_user_id, ORG2_ID)

    print()
    print("=" * 70)
    print("SUCCESS! Second user created")
    print("=" * 70)
    print()
    print(f"Email: {USER2_EMAIL}")
    print(f"Password: {USER2_PASSWORD}")
    print(f"Keycloak ID: {keycloak_user_id}")
    print(f"Database ID: {db_user_id}")
    print(f"Organization: {ORG2_ID} (Ananta Platform)")
    print(f"Role: engineer")
    print()
    print("Next: Run setup-jwt-token-user2.py to get JWT token")

if __name__ == "__main__":
    main()
