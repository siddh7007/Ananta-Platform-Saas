#!/bin/bash
# Test Credentials for App Plane Services
# Usage: source test-credentials.sh && echo $TOKEN

# =============================================================================
# Keycloak Configuration
# =============================================================================
export KEYCLOAK_URL="http://localhost:8180"
export KEYCLOAK_REALM="ananta-saas"
export KEYCLOAK_CLIENT="admin-cli"

# =============================================================================
# Test Users (Keycloak ananta-saas realm)
# =============================================================================

# CNS Staff User (super_admin role)
export CNS_STAFF_USER="cnsstaff"
export CNS_STAFF_PASS="Test123!"

# CBP Admin User (owner role)
export CBP_ADMIN_USER="cbpadmin"
export CBP_ADMIN_PASS="Test123!"

# =============================================================================
# Service URLs
# =============================================================================
export CNS_API_URL="http://localhost:27200"
export CNS_DASHBOARD_URL="http://localhost:27250"
export CUSTOMER_PORTAL_URL="http://localhost:27100"
export SUPABASE_API_URL="http://localhost:27810"

# =============================================================================
# Functions to get tokens
# =============================================================================

# Get token for CNS Staff user
get_cns_token() {
    curl -s -X POST "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${CNS_STAFF_USER}" \
        -d "password=${CNS_STAFF_PASS}" \
        -d "grant_type=password" \
        -d "client_id=${KEYCLOAK_CLIENT}" | jq -r '.access_token'
}

# Get token for CBP Admin user
get_cbp_token() {
    curl -s -X POST "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${CBP_ADMIN_USER}" \
        -d "password=${CBP_ADMIN_PASS}" \
        -d "grant_type=password" \
        -d "client_id=${KEYCLOAK_CLIENT}" | jq -r '.access_token'
}

# Export token (default: CNS Staff)
refresh_token() {
    export TOKEN=$(get_cns_token)
    echo "TOKEN refreshed (expires in ~1 hour)"
}

# =============================================================================
# Test BOM IDs (for reference)
# =============================================================================
export TEST_BOM_ID="ffaac87c-d3de-4b31-ba1a-839786f0e089"
export TEST_ORG_ID="a0000000-0000-0000-0000-000000000000"
export TEST_WORKSPACE_ID="c13f4caa-fee3-4e9b-805c-a8282bfd59ed"

# =============================================================================
# Quick Test Commands
# =============================================================================
# After sourcing this file, you can run:
#
# refresh_token                                    # Get fresh JWT token
# curl -s "${CNS_API_URL}/health" | jq .          # Health check
# curl -s "${CNS_API_URL}/api/boms" -H "Authorization: Bearer $TOKEN" | jq .

echo "Test credentials loaded. Run 'refresh_token' to get a JWT."
