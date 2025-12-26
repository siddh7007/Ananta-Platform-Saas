#!/bin/bash
set -e

KEYCLOAK_URL="http://localhost:8180"
ADMIN_USER="admin"
ADMIN_PASS="admin"

echo "Setting up Keycloak for Ananta SaaS Admin Portal..."

# Get admin access token
echo "Getting admin token..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ "$ADMIN_TOKEN" = "null" ]; then
  echo "❌ Failed to get admin token"
  exit 1
fi

echo "✅ Got admin token"

# Create ananta-saas realm
echo "Creating ananta-saas realm..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "ananta-saas",
    "enabled": true,
    "displayName": "Ananta SaaS",
    "loginTheme": "keycloak",
    "accessTokenLifespan": 3600,
    "ssoSessionIdleTimeout": 1800,
    "ssoSessionMaxLifespan": 36000
  }'

echo "✅ Realm created"

# Create admin-app client
echo "Creating admin-app client..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/ananta-saas/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "admin-app",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": true,
    "directAccessGrantsEnabled": true,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "redirectUris": [
      "http://localhost:27555/*"
    ],
    "webOrigins": [
      "http://localhost:27555"
    ],
    "attributes": {
      "pkce.code.challenge.method": "S256"
    }
  }'

echo "✅ Client created"

# Create test admin user
echo "Creating test admin user..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/ananta-saas/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@ananta-saas.local",
    "firstName": "Admin",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "admin123",
      "temporary": false
    }]
  }'

echo "✅ User created"

echo ""
echo "========================================="
echo "✅ Keycloak Setup Complete!"
echo "========================================="
echo ""
echo "Realm: ananta-saas"
echo "Client: admin-app"
echo "Test User:"
echo "  Username: admin"
echo "  Email: admin@ananta-saas.local"
echo "  Password: admin123"
echo ""
echo "Admin Portal: http://localhost:27555"
echo "========================================="
