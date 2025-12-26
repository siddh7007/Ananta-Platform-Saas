#!/bin/bash
# Update Keycloak client redirect URIs for the demo-app client

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

echo "Updating demo-app client redirect URIs..."
echo "Keycloak URL: $KEYCLOAK_URL"

# Get admin token
echo "Getting admin token..."
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get admin token. Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "Token obtained successfully"

# Get the demo-app client ID (internal UUID)
echo "Finding demo-app client..."
CLIENT_RESPONSE=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/tenant-demo/clients?clientId=demo-app" \
  -H "Authorization: Bearer $TOKEN")

CLIENT_UUID=$(echo $CLIENT_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_UUID" ]; then
  echo "Could not find demo-app client. Response: $CLIENT_RESPONSE"
  exit 1
fi

echo "Found demo-app client with UUID: $CLIENT_UUID"

# Update the client with new redirect URIs
echo "Updating redirect URIs..."
curl -s -X PUT "$KEYCLOAK_URL/admin/realms/tenant-demo/clients/$CLIENT_UUID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "demo-app",
    "name": "Demo Company App",
    "enabled": true,
    "publicClient": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": false,
    "redirectUris": ["http://localhost:5173/*", "http://localhost:5174/*", "http://localhost:5175/*", "http://localhost:4000/*"],
    "webOrigins": ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:4000"],
    "protocol": "openid-connect",
    "attributes": {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": "http://localhost:5173##http://localhost:5174##http://localhost:5175##http://localhost:4000"
    }
  }'

echo ""
echo "Redirect URIs updated!"
echo ""
echo "Allowed redirect URIs:"
echo "  - http://localhost:5173/*"
echo "  - http://localhost:5174/*"
echo "  - http://localhost:5175/*"
echo "  - http://localhost:4000/*"
