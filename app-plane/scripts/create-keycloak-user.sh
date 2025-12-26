#!/bin/bash
# Create test user in Keycloak components-platform realm

KC_URL="http://localhost:8180"
REALM="components-platform"

# Get admin token
KC_TOKEN=$(curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

echo "Creating test user..."

# Create user
curl -s -X POST "$KC_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $KC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "testuser@example.com",
    "firstName": "Test",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "Test123456",
      "temporary": false
    }]
  }'

echo ""
echo "User created:"
echo "  Username: testuser"
echo "  Password: Test123456"
echo "  Email: testuser@example.com"
