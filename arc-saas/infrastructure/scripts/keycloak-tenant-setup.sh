#!/bin/bash
# =============================================================================
# ARC-SaaS Keycloak Tenant Setup Script
# =============================================================================
# Creates tenant-specific configuration in Keycloak

set -euo pipefail

# Configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
REALM_NAME="${REALM_NAME:-arc-saas}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

# Tenant-specific parameters
TENANT_ID="${1:-}"
TENANT_NAME="${2:-}"
ADMIN_EMAIL="${3:-}"
ADMIN_FIRST_NAME="${4:-Admin}"
ADMIN_LAST_NAME="${5:-User}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "Usage: $0 <tenant_id> <tenant_name> <admin_email> [admin_first_name] [admin_last_name]"
    echo ""
    echo "Example:"
    echo "  $0 acme-corp 'Acme Corporation' admin@acme.com John Doe"
    exit 1
}

if [ -z "$TENANT_ID" ] || [ -z "$TENANT_NAME" ] || [ -z "$ADMIN_EMAIL" ]; then
    log_error "Missing required parameters"
    usage
fi

# Get admin access token
get_admin_token() {
    log_info "Getting admin access token..."
    TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${ADMIN_USER}" \
        -d "password=${ADMIN_PASSWORD}" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" | jq -r '.access_token')

    if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
        log_error "Failed to get admin token"
        exit 1
    fi
    export TOKEN
}

# Create tenant group
create_tenant_group() {
    log_info "Creating tenant group: ${TENANT_ID}..."

    # Check if group exists
    local exists=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/groups?search=${TENANT_ID}" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.[0].name // empty')

    if [ "$exists" == "$TENANT_ID" ]; then
        log_warn "Group ${TENANT_ID} already exists"
        return 0
    fi

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/groups" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "'"${TENANT_ID}"'",
            "attributes": {
                "tenantId": ["'"${TENANT_ID}"'"],
                "tenantName": ["'"${TENANT_NAME}"'"]
            }
        }'

    log_info "Tenant group created"
}

# Create tenant admin user
create_tenant_admin() {
    log_info "Creating tenant admin user: ${ADMIN_EMAIL}..."

    # Generate temporary password
    local temp_password=$(openssl rand -base64 12)

    # Check if user exists
    local exists=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?email=${ADMIN_EMAIL}" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.[0].id // empty')

    if [ -n "$exists" ]; then
        log_warn "User ${ADMIN_EMAIL} already exists"
        return 0
    fi

    # Create user
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "'"${ADMIN_EMAIL}"'",
            "email": "'"${ADMIN_EMAIL}"'",
            "enabled": true,
            "emailVerified": false,
            "firstName": "'"${ADMIN_FIRST_NAME}"'",
            "lastName": "'"${ADMIN_LAST_NAME}"'",
            "attributes": {
                "tenantId": ["'"${TENANT_ID}"'"]
            },
            "credentials": [{
                "type": "password",
                "value": "'"${temp_password}"'",
                "temporary": true
            }],
            "requiredActions": ["VERIFY_EMAIL", "UPDATE_PASSWORD"]
        }'

    # Get user ID
    local user_id=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?email=${ADMIN_EMAIL}" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.[0].id')

    # Get group ID
    local group_id=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/groups?search=${TENANT_ID}" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.[0].id')

    # Add user to tenant group
    if [ -n "$user_id" ] && [ -n "$group_id" ]; then
        curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${user_id}/groups/${group_id}" \
            -H "Authorization: Bearer ${TOKEN}"
        log_info "User added to tenant group"
    fi

    # Assign admin role
    local role_id=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/admin" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.id')

    if [ -n "$user_id" ] && [ -n "$role_id" ]; then
        curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${user_id}/role-mappings/realm" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d '[{"id": "'"${role_id}"'", "name": "admin"}]'
        log_info "Admin role assigned"
    fi

    log_info "Tenant admin created"
    log_info "Temporary password: ${temp_password}"
}

# Send verification email
send_verification_email() {
    log_info "Sending verification email..."

    local user_id=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?email=${ADMIN_EMAIL}" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.[0].id')

    if [ -n "$user_id" ]; then
        curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${user_id}/send-verify-email" \
            -H "Authorization: Bearer ${TOKEN}"
        log_info "Verification email sent"
    fi
}

# Main execution
main() {
    log_info "Setting up tenant in Keycloak..."
    log_info "Tenant ID: ${TENANT_ID}"
    log_info "Tenant Name: ${TENANT_NAME}"
    log_info "Admin Email: ${ADMIN_EMAIL}"

    get_admin_token
    create_tenant_group
    create_tenant_admin
    # Uncomment to send verification email (requires SMTP configuration)
    # send_verification_email

    log_info ""
    log_info "=== Tenant Setup Complete ==="
    log_info "Tenant: ${TENANT_NAME} (${TENANT_ID})"
    log_info "Admin: ${ADMIN_EMAIL}"
    log_info ""
}

main "$@"
