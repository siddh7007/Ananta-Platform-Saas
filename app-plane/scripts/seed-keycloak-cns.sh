#!/bin/bash
# Seed Keycloak with cns-dashboard client and cnsstaff user

KEYCLOAK_URL="http://localhost:8180"
REALM="ananta-saas"

echo "=== Getting Keycloak Admin Token ==="
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Failed to get admin token"
  exit 1
fi
echo "Got admin token (length: ${#ADMIN_TOKEN})"

# Check if cns-dashboard client exists
echo ""
echo "=== Checking cns-dashboard client ==="
CLIENT_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=cns-dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | grep -c "cns-dashboard")

if [ "$CLIENT_EXISTS" -eq 0 ]; then
  echo "Creating cns-dashboard client..."
  curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "clientId": "cns-dashboard",
      "name": "CNS Dashboard",
      "description": "Component Normalization Service Dashboard",
      "enabled": true,
      "publicClient": true,
      "directAccessGrantsEnabled": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "protocol": "openid-connect",
      "redirectUris": [
        "http://localhost:27250/*",
        "http://localhost:27810/*"
      ],
      "webOrigins": [
        "http://localhost:27250",
        "http://localhost:27810",
        "+"
      ],
      "attributes": {
        "pkce.code.challenge.method": "S256"
      }
    }'
  echo "cns-dashboard client created"
else
  echo "cns-dashboard client already exists"
fi

# Check if cnsstaff user exists
echo ""
echo "=== Checking cnsstaff user ==="
USER_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=cnsstaff" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | grep -c "cnsstaff")

if [ "$USER_EXISTS" -eq 0 ]; then
  echo "Creating cnsstaff user..."
  curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "cnsstaff",
      "email": "cnsstaff@cns.local",
      "emailVerified": true,
      "enabled": true,
      "firstName": "CNS",
      "lastName": "Staff",
      "credentials": [{
        "type": "password",
        "value": "cnsstaff123",
        "temporary": false
      }],
      "realmRoles": ["super_admin", "admin", "owner"]
    }'

  # Get user ID
  USER_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=cnsstaff" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$USER_ID" ]; then
    echo "User created with ID: $USER_ID"

    # Get realm roles
    echo "Assigning realm roles..."
    SUPER_ADMIN_ROLE=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/super_admin" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    ADMIN_ROLE=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/admin" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    OWNER_ROLE=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/owner" \
      -H "Authorization: Bearer $ADMIN_TOKEN")

    # Assign roles to user
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "[$SUPER_ADMIN_ROLE, $ADMIN_ROLE, $OWNER_ROLE]"

    echo "Roles assigned to cnsstaff user"
  fi
else
  echo "cnsstaff user already exists"
fi

echo ""
echo "=== CNS Keycloak Setup Complete ==="
echo "Client: cns-dashboard"
echo "User: cnsstaff / cnsstaff123"
echo "Realm: $REALM"
