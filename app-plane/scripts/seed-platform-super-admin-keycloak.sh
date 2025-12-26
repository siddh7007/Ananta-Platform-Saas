#!/bin/bash
# ============================================================================
# Seed Platform Super Admin Organization in Keycloak
# ============================================================================
# This script creates the Platform Super Admin group and user attributes
# in Keycloak to match the Platform Super Admin organization in:
# - App Plane Supabase: organizations.id = a0000000-0000-0000-0000-000000000000
# - Control Plane: main.tenants.id = a0000000-0000-0000-0000-000000000000
#
# PURPOSE:
# - Enable SSO users to be associated with Platform Super Admin org
# - Support platform staff authentication with org context
# - Match the org ID used across all platform components
# ============================================================================

set -e

# Configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
REALM="${KEYCLOAK_REALM:-components-platform}"
PLATFORM_ORG_ID="a0000000-0000-0000-0000-000000000000"
PLATFORM_ORG_NAME="Platform Super Admin"

echo "=============================================="
echo "Seeding Platform Super Admin in Keycloak"
echo "=============================================="
echo ""
echo "Keycloak URL: $KEYCLOAK_URL"
echo "Realm: $REALM"
echo "Platform Org ID: $PLATFORM_ORG_ID"
echo ""

# Function to get admin token
get_token() {
    local token=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${KEYCLOAK_ADMIN_USERNAME:-admin}" \
        -d "password=${KEYCLOAK_ADMIN_PASSWORD:-admin}" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" 2>/dev/null | jq -r ".access_token // empty")

    if [ -z "$token" ]; then
        echo "ERROR: Failed to get Keycloak admin token"
        exit 1
    fi
    echo "$token"
}

# Get initial token
echo "Authenticating with Keycloak..."
KC_TOKEN=$(get_token)
echo " -> Authenticated"

# ============================================================================
# Step 1: Create Platform Super Admin Group
# ============================================================================
echo ""
echo "Step 1: Creating Platform Super Admin group..."

# Check if group exists
GROUP_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/groups?search=$PLATFORM_ORG_NAME" \
    -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')

if [ -z "$GROUP_EXISTS" ]; then
    # Create the group
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/groups" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$PLATFORM_ORG_NAME\",
            \"attributes\": {
                \"organization_id\": [\"$PLATFORM_ORG_ID\"],
                \"organization_name\": [\"$PLATFORM_ORG_NAME\"],
                \"is_platform_org\": [\"true\"],
                \"description\": [\"System organization for platform administration and shared test data\"]
            }
        }" 2>/dev/null

    # Get the group ID
    GROUP_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/groups?search=$PLATFORM_ORG_NAME" \
        -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')

    if [ -n "$GROUP_ID" ]; then
        echo " -> Group created: $GROUP_ID"
    else
        echo " -> WARNING: Group creation may have failed"
    fi
else
    GROUP_ID=$GROUP_EXISTS
    echo " -> Group already exists: $GROUP_ID"

    # Update attributes
    curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/groups/$GROUP_ID" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$PLATFORM_ORG_NAME\",
            \"attributes\": {
                \"organization_id\": [\"$PLATFORM_ORG_ID\"],
                \"organization_name\": [\"$PLATFORM_ORG_NAME\"],
                \"is_platform_org\": [\"true\"],
                \"description\": [\"System organization for platform administration and shared test data\"]
            }
        }" 2>/dev/null
    echo " -> Group attributes updated"
fi

# Refresh token
KC_TOKEN=$(get_token)

# ============================================================================
# Step 2: Create Platform Admin User (if not exists)
# ============================================================================
echo ""
echo "Step 2: Creating Platform Admin user..."

PLATFORM_USER="platform-admin"
PLATFORM_EMAIL="platform-admin@platform.local"
PLATFORM_PASSWORD="platform-admin-change-me"

# Check if user exists
USER_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$PLATFORM_USER" \
    -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')

if [ -z "$USER_EXISTS" ]; then
    # Create platform admin user
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"$PLATFORM_USER\",
            \"email\": \"$PLATFORM_EMAIL\",
            \"firstName\": \"Platform\",
            \"lastName\": \"Administrator\",
            \"enabled\": true,
            \"emailVerified\": true,
            \"credentials\": [{
                \"type\": \"password\",
                \"value\": \"$PLATFORM_PASSWORD\",
                \"temporary\": false
            }],
            \"attributes\": {
                \"organization_id\": [\"$PLATFORM_ORG_ID\"],
                \"is_platform_admin\": [\"true\"]
            }
        }" 2>/dev/null

    USER_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$PLATFORM_USER" \
        -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id // empty')

    if [ -n "$USER_ID" ]; then
        echo " -> User created: $USER_ID"
    else
        echo " -> WARNING: User creation may have failed"
    fi
else
    USER_ID=$USER_EXISTS
    echo " -> User already exists: $USER_ID"

    # Update user attributes
    curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"attributes\": {
                \"organization_id\": [\"$PLATFORM_ORG_ID\"],
                \"is_platform_admin\": [\"true\"]
            }
        }" 2>/dev/null
    echo " -> User attributes updated"
fi

# Refresh token
KC_TOKEN=$(get_token)

# ============================================================================
# Step 3: Add Platform Admin User to Platform Super Admin Group
# ============================================================================
echo ""
echo "Step 3: Adding user to Platform Super Admin group..."

if [ -n "$USER_ID" ] && [ -n "$GROUP_ID" ]; then
    curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/groups/$GROUP_ID" \
        -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null
    echo " -> User added to group"
else
    echo " -> WARNING: Could not add user to group (missing IDs)"
fi

# ============================================================================
# Step 4: Assign super-admin role to Platform Admin User
# ============================================================================
echo ""
echo "Step 4: Assigning super-admin role..."

# Get super-admin role
ROLE_REP=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/super-admin" \
    -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null)

ROLE_ID=$(echo "$ROLE_REP" | jq -r '.id // empty')

if [ -n "$ROLE_ID" ] && [ -n "$USER_ID" ]; then
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
        -H "Authorization: Bearer $KC_TOKEN" \
        -H "Content-Type: application/json" \
        -d "[$ROLE_REP]" 2>/dev/null
    echo " -> super-admin role assigned"
else
    echo " -> NOTE: super-admin role not found or user missing"
    echo "    Run setup-keycloak-sso.sh first to create roles"
fi

# ============================================================================
# Step 5: Add existing super-admin users to Platform Super Admin group
# ============================================================================
echo ""
echo "Step 5: Adding existing super-admin users to Platform group..."

# Get all users with super-admin role
if [ -n "$ROLE_ID" ] && [ -n "$GROUP_ID" ]; then
    SUPER_ADMINS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/super-admin/users" \
        -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null | jq -r '.[].id // empty')

    for SA_USER_ID in $SUPER_ADMINS; do
        if [ -n "$SA_USER_ID" ]; then
            curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/users/$SA_USER_ID/groups/$GROUP_ID" \
                -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null
            echo " -> Added user $SA_USER_ID to Platform Super Admin group"
        fi
    done
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "=============================================="
echo "Platform Super Admin Seeding Complete"
echo "=============================================="
echo ""
echo "Platform Super Admin Organization:"
echo "  ID:    $PLATFORM_ORG_ID"
echo "  Name:  $PLATFORM_ORG_NAME"
echo "  Group: $GROUP_ID"
echo ""
echo "Platform Admin User:"
echo "  Username: $PLATFORM_USER"
echo "  Email:    $PLATFORM_EMAIL"
echo "  Password: $PLATFORM_PASSWORD"
echo "  User ID:  $USER_ID"
echo ""
echo "This organization is used for:"
echo "  - Platform administration and testing"
echo "  - Shared demo/test BOMs accessible to all staff"
echo "  - System-level operations that don't belong to customers"
echo ""
echo "The organization_id attribute ($PLATFORM_ORG_ID) will be"
echo "included in JWT tokens for users in this group."
echo ""
