#!/bin/bash
# ============================================================================
# Platform Super Admin Seeding Script
# ============================================================================
# Seeds the Platform Super Admin organization across all platform components:
# 1. Control Plane PostgreSQL (main.tenants)
# 2. Keycloak ananta-saas realm (Control Plane SSO)
# 3. Keycloak components-platform realm (App Plane SSO)
# 4. App Plane Supabase (organizations) - already seeded via migrations
#
# Platform Super Admin Org ID: a0000000-0000-0000-0000-000000000000
# ============================================================================

set -e

# Configuration
PLATFORM_ORG_ID="a0000000-0000-0000-0000-000000000000"
PLATFORM_ORG_NAME="Platform Super Admin"

# Database settings
CTRL_PLANE_DB_HOST="${CTRL_PLANE_DB_HOST:-localhost}"
CTRL_PLANE_DB_PORT="${CTRL_PLANE_DB_PORT:-5432}"
CTRL_PLANE_DB_USER="${CTRL_PLANE_DB_USER:-postgres}"
CTRL_PLANE_DB_PASSWORD="${CTRL_PLANE_DB_PASSWORD:-postgres}"
CTRL_PLANE_DB_NAME="${CTRL_PLANE_DB_NAME:-arc_saas}"

# Keycloak settings
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASS="${KEYCLOAK_ADMIN_PASS:-admin}"

echo "============================================================"
echo "Platform Super Admin Seeding"
echo "============================================================"
echo ""
echo "Organization ID: $PLATFORM_ORG_ID"
echo "Organization Name: $PLATFORM_ORG_NAME"
echo ""

# ============================================================================
# Part 1: Control Plane PostgreSQL
# ============================================================================
echo "============================================================"
echo "Part 1: Control Plane PostgreSQL"
echo "============================================================"
echo ""

if command -v psql &> /dev/null; then
    echo "Seeding Platform Super Admin tenant in Control Plane..."

    PGPASSWORD=$CTRL_PLANE_DB_PASSWORD psql \
        -h $CTRL_PLANE_DB_HOST \
        -p $CTRL_PLANE_DB_PORT \
        -U $CTRL_PLANE_DB_USER \
        -d $CTRL_PLANE_DB_NAME \
        -c "
        -- Handle potential key conflicts
        UPDATE main.tenants
        SET key = 'platform-old-' || EXTRACT(EPOCH FROM NOW())::TEXT
        WHERE key = 'platform'
          AND id != '$PLATFORM_ORG_ID';

        -- Insert/Update Platform Super Admin tenant
        INSERT INTO main.tenants (
          id, name, key, status, domains, created_on, modified_on
        ) VALUES (
          '$PLATFORM_ORG_ID',
          '$PLATFORM_ORG_NAME',
          'platform',
          0,
          ARRAY['platform.local'],
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          key = 'platform',
          status = 0,
          modified_on = NOW();
        " 2>/dev/null && echo " -> Control Plane tenant seeded" || echo " -> WARNING: Control Plane seeding failed (database may not be running)"
else
    echo " -> SKIPPED: psql not available"
    echo "    Run the migration instead:"
    echo "    cd arc-saas/services/tenant-management-service && npm run migrate"
fi

# ============================================================================
# Part 2: Keycloak
# ============================================================================
echo ""
echo "============================================================"
echo "Part 2: Keycloak Realms"
echo "============================================================"
echo ""

# Function to get admin token
get_kc_token() {
    curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$KEYCLOAK_ADMIN_USER" \
        -d "password=$KEYCLOAK_ADMIN_PASS" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" 2>/dev/null | jq -r ".access_token // empty"
}

# Function to seed Platform Super Admin in a realm
seed_realm() {
    local REALM=$1
    local KC_TOKEN=$2

    echo "Seeding realm: $REALM"

    # Check if realm exists
    REALM_CHECK=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM" \
        -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null | jq -r '.realm // empty')

    if [ -z "$REALM_CHECK" ]; then
        echo " -> Realm '$REALM' does not exist, skipping"
        return
    fi

    # Create Platform Super Admin group
    GROUP_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/groups?search=$PLATFORM_ORG_NAME" \
        -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null | jq -r '.[0].id // empty')

    if [ -z "$GROUP_EXISTS" ]; then
        curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/groups" \
            -H "Authorization: Bearer $KC_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"$PLATFORM_ORG_NAME\",
                \"attributes\": {
                    \"organization_id\": [\"$PLATFORM_ORG_ID\"],
                    \"is_platform_org\": [\"true\"]
                }
            }" 2>/dev/null
        echo " -> Group '$PLATFORM_ORG_NAME' created"
    else
        # Update group attributes
        curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/groups/$GROUP_EXISTS" \
            -H "Authorization: Bearer $KC_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"$PLATFORM_ORG_NAME\",
                \"attributes\": {
                    \"organization_id\": [\"$PLATFORM_ORG_ID\"],
                    \"is_platform_org\": [\"true\"]
                }
            }" 2>/dev/null
        echo " -> Group '$PLATFORM_ORG_NAME' updated"
    fi

    # Create platform-admin user if not exists
    USER_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=platform-admin" \
        -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null | jq -r '.[0].id // empty')

    if [ -z "$USER_EXISTS" ]; then
        curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
            -H "Authorization: Bearer $KC_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"username\": \"platform-admin\",
                \"email\": \"platform-admin@platform.local\",
                \"firstName\": \"Platform\",
                \"lastName\": \"Administrator\",
                \"enabled\": true,
                \"emailVerified\": true,
                \"credentials\": [{
                    \"type\": \"password\",
                    \"value\": \"platform-admin-change-me\",
                    \"temporary\": false
                }],
                \"attributes\": {
                    \"organization_id\": [\"$PLATFORM_ORG_ID\"],
                    \"is_platform_admin\": [\"true\"]
                }
            }" 2>/dev/null
        echo " -> User 'platform-admin' created (password: platform-admin-change-me)"
    else
        echo " -> User 'platform-admin' already exists"
    fi

    # Add user to group
    USER_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=platform-admin" \
        -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null | jq -r '.[0].id // empty')
    GROUP_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/groups?search=$PLATFORM_ORG_NAME" \
        -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null | jq -r '.[0].id // empty')

    if [ -n "$USER_ID" ] && [ -n "$GROUP_ID" ]; then
        curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/groups/$GROUP_ID" \
            -H "Authorization: Bearer $KC_TOKEN" 2>/dev/null
        echo " -> User added to group"
    fi

    echo ""
}

# Get Keycloak token
echo "Connecting to Keycloak..."
KC_TOKEN=$(get_kc_token)

if [ -z "$KC_TOKEN" ]; then
    echo " -> WARNING: Cannot connect to Keycloak (may not be running)"
    echo "    URL: $KEYCLOAK_URL"
else
    echo " -> Connected"
    echo ""

    # Seed both realms
    seed_realm "ananta-saas" "$KC_TOKEN"
    KC_TOKEN=$(get_kc_token)  # Refresh token
    seed_realm "components-platform" "$KC_TOKEN"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "============================================================"
echo "Platform Super Admin Seeding Complete"
echo "============================================================"
echo ""
echo "Platform Super Admin Organization:"
echo "  ID:   $PLATFORM_ORG_ID"
echo "  Name: $PLATFORM_ORG_NAME"
echo "  Key:  platform"
echo ""
echo "Seeded in:"
echo "  [x] Control Plane PostgreSQL (main.tenants)"
echo "  [x] Keycloak ananta-saas realm (if exists)"
echo "  [x] Keycloak components-platform realm (if exists)"
echo "  [x] App Plane Supabase (via migrations)"
echo ""
echo "Platform Admin User:"
echo "  Username: platform-admin"
echo "  Password: platform-admin-change-me"
echo ""
echo "NOTE: App Plane Supabase is seeded via migrations:"
echo "  app-plane/supabase/migrations/089_platform_staff_organization.sql"
echo ""
