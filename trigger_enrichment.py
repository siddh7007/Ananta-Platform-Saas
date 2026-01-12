#!/usr/bin/env python3
"""Trigger BOM enrichment manually."""
import requests
import json

# Get token from Keycloak
token_response = requests.post(
    "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token",
    data={
        "client_id": "cbp-frontend",
        "grant_type": "password",
        "username": "superadmin",
        "password": "Test123!",
        "scope": "openid profile email"
    },
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

if token_response.status_code != 200:
    print(f"Failed to get token: {token_response.text}")
    exit(1)

token = token_response.json().get("access_token")
print(f"Token obtained: {token[:50]}...")

# Trigger enrichment
bom_id = "938bb3f9-a685-46eb-8e99-b644f2c80aff"
response = requests.post(
    f"http://localhost:27200/api/boms/{bom_id}/enrichment/start",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    json={
        "organization_id": "b0000000-0000-4000-a000-000000000001",
        "project_id": "59da5d11-6ad2-4400-9de7-de2ae1454fc0",
        "priority": 5,
        "initiated_by": "manual_test"
    }
)

print(f"\nEnrichment trigger response ({response.status_code}):")
print(json.dumps(response.json(), indent=2))
