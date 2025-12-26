#!/bin/bash
# Setup CBP-Users Realm with proper roles matching Customer Portal
# This script creates a separate realm for Customer Business Portal users

KEYCLOAK_URL="http://localhost:8180"
ADMIN_USER="admin"
ADMIN_PASS="admin"

echo "=== Getting Keycloak Admin Token ==="
KC_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}&password=${ADMIN_PASS}&grant_type=password&client_id=admin-cli" \
  | jq -r '.access_token')

if [ -z "$KC_TOKEN" ] || [ "$KC_TOKEN" == "null" ]; then
    echo "ERROR: Failed to get Keycloak admin token"
    exit 1
fi
echo "Got token: ${KC_TOKEN:0:50}..."

echo ""
echo "=== Current Realms ==="
curl -s "${KEYCLOAK_URL}/admin/realms" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[].realm'

echo ""
echo "=== Current Roles in components-platform ==="
curl -s "${KEYCLOAK_URL}/admin/realms/components-platform/roles" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[].name'

echo ""
echo "=== Creating CBP-Users Realm ==="
# Create the realm
curl -s -X POST "${KEYCLOAK_URL}/admin/realms" \
  -H "Authorization: Bearer $KC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "cbp-users",
    "displayName": "Customer Business Portal Users",
    "enabled": true,
    "registrationAllowed": false,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": false,
    "sslRequired": "external",
    "accessTokenLifespan": 3600
  }'

echo "Realm created."

# Refresh token since operations take time
KC_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}&password=${ADMIN_PASS}&grant_type=password&client_id=admin-cli" \
  | jq -r '.access_token')

echo ""
echo "=== Creating Roles in CBP-Users Realm ==="
# These roles match the CBP frontend permissions.ts hierarchy:
# super_admin (5) > owner (4) > admin (3) > engineer (2) > analyst (1)

for role in "super_admin" "owner" "admin" "engineer" "analyst"; do
  echo "Creating role: $role"
  case $role in
    "super_admin")
      desc="Platform-wide access (Ananta staff only)"
      ;;
    "owner")
      desc="Organization owner - billing, delete org"
      ;;
    "admin")
      desc="Organization management (Enterprise only)"
      ;;
    "engineer")
      desc="Can manage BOMs, components"
      ;;
    "analyst")
      desc="Read-only + reports (lowest customer role)"
      ;;
  esac

  curl -s -X POST "${KEYCLOAK_URL}/admin/realms/cbp-users/roles" \
    -H "Authorization: Bearer $KC_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$role\", \"description\": \"$desc\"}"
done

# Refresh token
KC_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}&password=${ADMIN_PASS}&grant_type=password&client_id=admin-cli" \
  | jq -r '.access_token')

echo ""
echo "=== Creating Customer Portal Client in CBP-Users Realm ==="
curl -s -X POST "${KEYCLOAK_URL}/admin/realms/cbp-users/clients" \
  -H "Authorization: Bearer $KC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "customer-portal",
    "name": "Customer Business Portal",
    "description": "React-based customer portal for BOM management",
    "enabled": true,
    "publicClient": true,
    "directAccessGrantsEnabled": true,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "serviceAccountsEnabled": false,
    "protocol": "openid-connect",
    "rootUrl": "http://localhost:27100",
    "baseUrl": "/",
    "redirectUris": [
      "http://localhost:27100/*",
      "http://localhost:5173/*",
      "http://localhost:3000/*"
    ],
    "webOrigins": [
      "http://localhost:27100",
      "http://localhost:5173",
      "http://localhost:3000",
      "+"
    ],
    "attributes": {
      "pkce.code.challenge.method": "S256"
    }
  }'

echo ""
echo "=== Verifying Setup ==="

# Final token refresh
KC_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}&password=${ADMIN_PASS}&grant_type=password&client_id=admin-cli" \
  | jq -r '.access_token')

echo "Realms:"
curl -s "${KEYCLOAK_URL}/admin/realms" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[].realm'

echo ""
echo "CBP-Users Roles:"
curl -s "${KEYCLOAK_URL}/admin/realms/cbp-users/roles" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[].name'

echo ""
echo "CBP-Users Clients:"
curl -s "${KEYCLOAK_URL}/admin/realms/cbp-users/clients" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[].clientId'

echo ""
echo "=== Done! ==="
echo "CBP-Users realm created with roles: super_admin, owner, admin, engineer, analyst"
echo "Customer Portal client configured for http://localhost:27100"
