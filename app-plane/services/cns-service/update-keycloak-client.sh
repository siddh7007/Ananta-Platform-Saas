#!/bin/bash
# Update cns-dashboard client in Keycloak to allow /cns/ redirect URIs

# Get admin token
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" | jq -r '.access_token')

echo "Got token: ${TOKEN:0:50}..."

# Get cns-dashboard client ID
CLIENT_DATA=$(curl -s "http://localhost:8180/admin/realms/components-platform/clients?clientId=cns-dashboard" \
  -H "Authorization: Bearer $TOKEN")

echo "Client data: $CLIENT_DATA"

CLIENT_ID=$(echo $CLIENT_DATA | jq -r '.[0].id')
echo "Client UUID: $CLIENT_ID"

if [ "$CLIENT_ID" == "null" ] || [ -z "$CLIENT_ID" ]; then
  echo "cns-dashboard client not found, creating it..."

  # Create the client with proper redirect URIs
  curl -s -X POST "http://localhost:8180/admin/realms/components-platform/clients" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "clientId": "cns-dashboard",
      "enabled": true,
      "publicClient": true,
      "directAccessGrantsEnabled": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "redirectUris": [
        "http://localhost:27250/*",
        "http://localhost:27250/cns/*",
        "http://localhost:27810/*",
        "http://localhost:27710/*"
      ],
      "webOrigins": [
        "http://localhost:27250",
        "http://localhost:27810",
        "http://localhost:27710",
        "+"
      ],
      "attributes": {
        "pkce.code.challenge.method": "S256"
      }
    }'
  echo "Client created"
else
  echo "Updating client $CLIENT_ID..."

  # Update the client with proper redirect URIs
  curl -s -X PUT "http://localhost:8180/admin/realms/components-platform/clients/$CLIENT_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "clientId": "cns-dashboard",
      "enabled": true,
      "publicClient": true,
      "directAccessGrantsEnabled": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "redirectUris": [
        "http://localhost:27250/*",
        "http://localhost:27250/cns/*",
        "http://localhost:27810/*",
        "http://localhost:27710/*"
      ],
      "webOrigins": [
        "http://localhost:27250",
        "http://localhost:27810",
        "http://localhost:27710",
        "+"
      ],
      "attributes": {
        "pkce.code.challenge.method": "S256"
      }
    }'
  echo "Client updated"
fi

echo "Done!"
