#!/bin/bash
# Script to update Keycloak client redirect URIs for App Plane portals
# Supports BOTH development (Vite) AND production (Docker) ports

set -e

KC_URL="http://localhost:8180"
REALM="components-platform"

# Get admin token
echo "Getting admin token..."
KC_TOKEN=$(curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ -z "$KC_TOKEN" ] || [ "$KC_TOKEN" == "null" ]; then
  echo "ERROR: Failed to get admin token"
  exit 1
fi

echo "Token obtained successfully"

# Function to update client
update_client() {
  local client_id=$1
  local root_url=$2
  local redirect_uris=$3
  local name=$4

  echo ""
  echo "Updating client: $client_id"

  # Get client internal ID
  local client_uuid=$(curl -s "$KC_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $KC_TOKEN" | \
    jq -r ".[] | select(.clientId == \"$client_id\") | .id")

  if [ -z "$client_uuid" ] || [ "$client_uuid" == "null" ]; then
    echo "  Client $client_id not found - creating..."

    curl -s -X POST "$KC_URL/admin/realms/$REALM/clients" \
      -H "Authorization: Bearer $KC_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"clientId\": \"$client_id\",
        \"name\": \"$name\",
        \"rootUrl\": \"$root_url\",
        \"baseUrl\": \"/\",
        \"enabled\": true,
        \"publicClient\": true,
        \"standardFlowEnabled\": true,
        \"directAccessGrantsEnabled\": true,
        \"redirectUris\": $redirect_uris,
        \"webOrigins\": [\"*\"],
        \"attributes\": {
          \"pkce.code.challenge.method\": \"S256\"
        }
      }"
    echo "  Created client: $client_id"
    return
  fi

  echo "  Found client UUID: $client_uuid"

  # Update the client
  curl -s -X PUT "$KC_URL/admin/realms/$REALM/clients/$client_uuid" \
    -H "Authorization: Bearer $KC_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientId\": \"$client_id\",
      \"name\": \"$name\",
      \"rootUrl\": \"$root_url\",
      \"baseUrl\": \"/\",
      \"enabled\": true,
      \"publicClient\": true,
      \"standardFlowEnabled\": true,
      \"directAccessGrantsEnabled\": true,
      \"redirectUris\": $redirect_uris,
      \"webOrigins\": [\"*\"],
      \"attributes\": {
        \"pkce.code.challenge.method\": \"S256\"
      }
    }"

  echo "  Updated: $client_id"
}

echo ""
echo "=========================================="
echo "Updating Keycloak Clients for App Plane"
echo "Supporting BOTH Dev (Vite) and Docker ports"
echo "=========================================="

# Update backstage-portal
# Dev (Vite): 27500
update_client "backstage-portal" \
  "http://localhost:27500" \
  '["http://localhost:27500/*", "http://localhost:27150/*"]' \
  "Backstage Admin Portal"

# Update customer-portal
# Dev (Vite): 27510, Docker: 27100
update_client "customer-portal" \
  "http://localhost:27510" \
  '["http://localhost:27510/*", "http://localhost:27100/*"]' \
  "Customer Business Portal"

# Update cns-dashboard
# Dev (Vite): 27710, Docker: 27250
update_client "cns-dashboard" \
  "http://localhost:27710" \
  '["http://localhost:27710/*", "http://localhost:27250/*"]' \
  "CNS Dashboard (Staff Only)"

# Update dashboard (Next.js)
# Docker: 27400
update_client "dashboard" \
  "http://localhost:27400" \
  '["http://localhost:27400/*"]' \
  "Unified Dashboard (Next.js)"

echo ""
echo "=========================================="
echo "All clients updated!"
echo "=========================================="

# Verify updates
echo ""
echo "Verifying client configurations..."

# Re-fetch token as it may have expired
KC_TOKEN=$(curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

echo ""
echo "Portal configurations:"
curl -s "$KC_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $KC_TOKEN" | \
  jq '.[] | select(.clientId | test("backstage|customer|cns|dashboard")) | {clientId, rootUrl, redirectUris}'

echo ""
echo "=========================================="
echo "PORT REFERENCE:"
echo "=========================================="
echo "| Portal           | Dev (Vite) | Docker |"
echo "|------------------|------------|--------|"
echo "| backstage-portal | 27500      | 27150  |"
echo "| customer-portal  | 27510      | 27100  |"
echo "| cns-dashboard    | 27710      | 27810  |"
echo "| dashboard        | 3000       | 27400  |"
echo "=========================================="
