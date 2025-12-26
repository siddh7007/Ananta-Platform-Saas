#!/bin/bash
# Create admin user in Keycloak components-platform realm

# Get admin token
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" | jq -r '.access_token')

echo "Token obtained: ${#TOKEN} chars"

# Create admin user
RESULT=$(curl -s -w "%{http_code}" -X POST "http://localhost:8180/admin/realms/components-platform/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "enabled": true,
    "emailVerified": true,
    "firstName": "Platform",
    "lastName": "Admin",
    "email": "admin@components-platform.local",
    "credentials": [
      {
        "type": "password",
        "value": "admin123",
        "temporary": false
      }
    ]
  }')

HTTP_CODE="${RESULT: -3}"
BODY="${RESULT:0:${#RESULT}-3}"

if [ "$HTTP_CODE" = "201" ]; then
  echo "SUCCESS: Admin user created"
elif [ "$HTTP_CODE" = "409" ]; then
  echo "User already exists"
else
  echo "ERROR: HTTP $HTTP_CODE - $BODY"
fi

# List users to verify
echo ""
echo "Users in components-platform realm:"
curl -s "http://localhost:8180/admin/realms/components-platform/users" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | "- \(.username) (\(.email))"'
