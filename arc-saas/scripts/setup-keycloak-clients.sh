#!/bin/bash
# Setup Keycloak clients for ARC SaaS apps

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

echo "Setting up Keycloak clients..."
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

# Create admin-app client
echo "Creating admin-app client..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/master/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "admin-app",
    "name": "ARC SaaS Admin App",
    "enabled": true,
    "publicClient": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": false,
    "redirectUris": ["http://localhost:5000/*", "http://localhost:5001/*", "http://localhost:5173/*"],
    "webOrigins": ["http://localhost:5000", "http://localhost:5001", "http://localhost:5173"],
    "protocol": "openid-connect",
    "attributes": {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": "http://localhost:5000##http://localhost:5001##http://localhost:5173"
    }
  }'

echo ""
echo "Admin-app client created (or already exists)"

# Create a demo tenant realm and client for customer app testing
echo "Creating demo tenant realm..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "tenant-demo",
    "enabled": true,
    "displayName": "Demo Company",
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true
  }'

echo ""
echo "Demo tenant realm created (or already exists)"

# Get new token for the demo realm operations
sleep 1

# Create demo-app client in tenant-demo realm
echo "Creating demo-app client in tenant-demo realm..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/tenant-demo/clients" \
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
echo "Demo-app client created (or already exists)"

# Create a test user in tenant-demo realm
echo "Creating test user in tenant-demo realm..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/tenant-demo/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo@example.com",
    "email": "demo@example.com",
    "firstName": "Demo",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "demo123",
      "temporary": false
    }]
  }'

echo ""
echo "Test user created (or already exists)"
echo ""
echo "Setup complete!"
echo ""
echo "Admin App:"
echo "  - URL: http://localhost:5001"
echo "  - Login via Keycloak master realm"
echo "  - Default admin: admin / admin"
echo ""
echo "Customer App (Demo Tenant):"
echo "  - URL: http://localhost:5173"
echo "  - Login via Keycloak tenant-demo realm"
echo "  - Test user: demo@example.com / demo123"
