#!/bin/bash
# Keycloak SSO Setup Script for Components Platform
# This creates the realm, clients, roles, and users for SSO

KEYCLOAK_URL="http://localhost:14003"
REALM="components-platform"

# Function to get admin token
get_token() {
    curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=admin" \
        -d "password=admin" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" | jq -r ".access_token"
}

echo "=== Keycloak SSO Setup for Components Platform ==="
echo ""

# Get initial token
KC_TOKEN=$(get_token)

# Check if realm exists
REALM_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM" -H "Authorization: Bearer $KC_TOKEN" | jq -r '.realm // empty')

if [ -z "$REALM_EXISTS" ]; then
    echo "Creating $REALM realm..."
    curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "realm": "components-platform",
            "enabled": true,
            "displayName": "Components Platform",
            "registrationAllowed": false,
            "loginWithEmailAllowed": true,
            "duplicateEmailsAllowed": false,
            "resetPasswordAllowed": true,
            "bruteForceProtected": true,
            "accessTokenLifespan": 3600,
            "ssoSessionIdleTimeout": 1800,
            "ssoSessionMaxLifespan": 36000
        }'
    echo " -> Realm created"
else
    echo "Realm $REALM already exists"
fi

# Refresh token
KC_TOKEN=$(get_token)

echo ""
echo "Creating realm roles..."
for role in "super-admin:Super Administrator with full platform access" "admin:Administrator with tenant management access" "staff:Staff member with limited access"; do
    name=$(echo $role | cut -d: -f1)
    desc=$(echo $role | cut -d: -f2)
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/roles" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$name\", \"description\": \"$desc\"}" 2>/dev/null
    echo " -> Role '$name' created"
done

# Refresh token
KC_TOKEN=$(get_token)

echo ""
echo "Creating SSO clients..."

# Customer Portal
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $KC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "customer-portal",
        "name": "Customer Business Portal",
        "enabled": true,
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "rootUrl": "http://localhost:27100",
        "baseUrl": "/",
        "redirectUris": ["http://localhost:27100/*"],
        "webOrigins": ["http://localhost:27100", "+"],
        "attributes": {"pkce.code.challenge.method": "S256"}
    }' 2>/dev/null
echo " -> customer-portal client created"

# Backstage Portal
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $KC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "backstage-portal",
        "name": "Backstage Admin Portal",
        "enabled": true,
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "rootUrl": "http://localhost:27150",
        "baseUrl": "/",
        "redirectUris": ["http://localhost:27150/*"],
        "webOrigins": ["http://localhost:27150", "+"],
        "attributes": {"pkce.code.challenge.method": "S256"}
    }' 2>/dev/null
echo " -> backstage-portal client created"

# Dashboard (Next.js - confidential client)
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $KC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "dashboard",
        "name": "Unified Dashboard",
        "enabled": true,
        "publicClient": false,
        "clientAuthenticatorType": "client-secret",
        "secret": "dashboard-secret-change-in-production",
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "rootUrl": "http://localhost:27400",
        "baseUrl": "/",
        "redirectUris": ["http://localhost:27400/*"],
        "webOrigins": ["http://localhost:27400", "+"]
    }' 2>/dev/null
echo " -> dashboard client created"

# CNS Dashboard
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $KC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "clientId": "cns-dashboard",
        "name": "CNS Dashboard",
        "enabled": true,
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "rootUrl": "http://localhost:27250",
        "baseUrl": "/",
        "redirectUris": ["http://localhost:27250/*"],
        "webOrigins": ["http://localhost:27250", "+"],
        "attributes": {"pkce.code.challenge.method": "S256"}
    }' 2>/dev/null
echo " -> cns-dashboard client created"

# Refresh token
KC_TOKEN=$(get_token)

echo ""
echo "Creating test users..."

# Create users
for user in "superadmin:Super:Admin:superadmin@example.com:admin123" \
            "admin:Platform:Admin:admin@example.com:admin123" \
            "staff:Staff:User:staff@example.com:staff123" \
            "customer:Test:Customer:customer@example.com:customer123"; do
    username=$(echo $user | cut -d: -f1)
    firstname=$(echo $user | cut -d: -f2)
    lastname=$(echo $user | cut -d: -f3)
    email=$(echo $user | cut -d: -f4)
    password=$(echo $user | cut -d: -f5)

    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"$username\",
            \"email\": \"$email\",
            \"firstName\": \"$firstname\",
            \"lastName\": \"$lastname\",
            \"enabled\": true,
            \"emailVerified\": true,
            \"credentials\": [{\"type\": \"password\", \"value\": \"$password\", \"temporary\": false}]
        }" 2>/dev/null
    echo " -> User '$username' created (password: $password)"
done

# Refresh token and assign roles
KC_TOKEN=$(get_token)

echo ""
echo "Assigning roles to users..."

# Get user IDs and assign roles
for user_role in "superadmin:super-admin" "admin:admin" "staff:staff"; do
    username=$(echo $user_role | cut -d: -f1)
    role=$(echo $user_role | cut -d: -f2)

    # Get user ID
    USER_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
        -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id')

    # Get role representation
    ROLE_REP=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/$role" \
        -H "Authorization: Bearer $KC_TOKEN")

    # Assign role
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "[$ROLE_REP]" 2>/dev/null

    echo " -> Assigned '$role' to '$username'"
done

echo ""
echo "=== SSO Setup Complete ==="
echo ""
echo "Keycloak Admin Console: $KEYCLOAK_URL/admin/master/console/"
echo "Realm: $REALM"
echo ""
echo "Test Users:"
echo "  - superadmin / admin123 (super-admin role)"
echo "  - admin / admin123 (admin role)"
echo "  - staff / staff123 (staff role)"
echo "  - customer / customer123 (no role - customer access)"
echo ""
echo "Portal Clients configured for SSO:"
echo "  - customer-portal    -> http://localhost:27100"
echo "  - backstage-portal   -> http://localhost:27150"
echo "  - dashboard          -> http://localhost:27400"
echo "  - cns-dashboard      -> http://localhost:27250"
