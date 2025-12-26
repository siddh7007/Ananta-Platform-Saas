#!/bin/bash
# =============================================================================
# ARC-SaaS Keycloak Bootstrap Script
# =============================================================================
# Configures Keycloak realm, clients, and roles for the SaaS platform

set -euo pipefail

# Configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
REALM_NAME="${REALM_NAME:-arc-saas}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for Keycloak to be ready
wait_for_keycloak() {
    log_info "Waiting for Keycloak to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s "${KEYCLOAK_URL}/health/ready" | grep -q '"status": "UP"'; then
            log_info "Keycloak is ready!"
            return 0
        fi
        log_info "Attempt $attempt/$max_attempts - Keycloak not ready yet..."
        sleep 5
        ((attempt++))
    done

    log_error "Keycloak failed to become ready"
    exit 1
}

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
    log_info "Admin token obtained successfully"
}

# Create realm
create_realm() {
    log_info "Creating realm: ${REALM_NAME}..."

    # Check if realm exists
    local exists=$(curl -s -o /dev/null -w "%{http_code}" \
        "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}" \
        -H "Authorization: Bearer ${TOKEN}")

    if [ "$exists" == "200" ]; then
        log_warn "Realm ${REALM_NAME} already exists, skipping..."
        return 0
    fi

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "realm": "'"${REALM_NAME}"'",
            "enabled": true,
            "displayName": "ARC-SaaS",
            "displayNameHtml": "<div class=\"kc-logo-text\"><span>ARC-SaaS</span></div>",
            "loginTheme": "keycloak",
            "accountTheme": "keycloak.v2",
            "adminTheme": "keycloak.v2",
            "emailTheme": "keycloak",
            "sslRequired": "external",
            "registrationAllowed": false,
            "registrationEmailAsUsername": true,
            "rememberMe": true,
            "verifyEmail": true,
            "loginWithEmailAllowed": true,
            "duplicateEmailsAllowed": false,
            "resetPasswordAllowed": true,
            "editUsernameAllowed": false,
            "bruteForceProtected": true,
            "permanentLockout": false,
            "maxFailureWaitSeconds": 900,
            "minimumQuickLoginWaitSeconds": 60,
            "waitIncrementSeconds": 60,
            "quickLoginCheckMilliSeconds": 1000,
            "maxDeltaTimeSeconds": 43200,
            "failureFactor": 5,
            "accessTokenLifespan": 3600,
            "accessTokenLifespanForImplicitFlow": 900,
            "ssoSessionIdleTimeout": 1800,
            "ssoSessionMaxLifespan": 36000,
            "offlineSessionIdleTimeout": 2592000,
            "offlineSessionMaxLifespanEnabled": false,
            "offlineSessionMaxLifespan": 5184000,
            "accessCodeLifespan": 60,
            "accessCodeLifespanUserAction": 300,
            "accessCodeLifespanLogin": 1800,
            "actionTokenGeneratedByAdminLifespan": 43200,
            "actionTokenGeneratedByUserLifespan": 300,
            "passwordPolicy": "length(8) and digits(1) and upperCase(1) and lowerCase(1) and specialChars(1)"
        }'

    log_info "Realm ${REALM_NAME} created successfully"
}

# Create realm roles
create_realm_roles() {
    log_info "Creating realm roles..."

    local roles=("super-admin" "admin" "staff" "user")

    for role in "${roles[@]}"; do
        local exists=$(curl -s -o /dev/null -w "%{http_code}" \
            "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/${role}" \
            -H "Authorization: Bearer ${TOKEN}")

        if [ "$exists" == "200" ]; then
            log_warn "Role ${role} already exists, skipping..."
            continue
        fi

        curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "'"${role}"'",
                "description": "'"${role^}"' role for ARC-SaaS",
                "composite": false
            }'

        log_info "Role ${role} created"
    done
}

# Create admin-app client
create_admin_app_client() {
    log_info "Creating admin-app client..."

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "clientId": "admin-app",
            "name": "Admin Application",
            "enabled": true,
            "publicClient": true,
            "standardFlowEnabled": true,
            "implicitFlowEnabled": false,
            "directAccessGrantsEnabled": true,
            "serviceAccountsEnabled": false,
            "authorizationServicesEnabled": false,
            "redirectUris": [
                "http://localhost:27555/*",
                "https://admin.arc-saas.local/*",
                "https://admin.*.arc-saas.com/*"
            ],
            "webOrigins": [
                "http://localhost:27555",
                "https://admin.arc-saas.local",
                "+"
            ],
            "attributes": {
                "pkce.code.challenge.method": "S256",
                "post.logout.redirect.uris": "+"
            },
            "protocol": "openid-connect",
            "fullScopeAllowed": true,
            "defaultClientScopes": ["web-origins", "acr", "profile", "roles", "email"],
            "optionalClientScopes": ["address", "phone", "offline_access"]
        }'

    log_info "admin-app client created"
}

# Create tenant-management-service client (backend)
create_backend_client() {
    log_info "Creating tenant-management-service client..."

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "clientId": "tenant-management-service",
            "name": "Tenant Management Service",
            "enabled": true,
            "publicClient": false,
            "standardFlowEnabled": false,
            "implicitFlowEnabled": false,
            "directAccessGrantsEnabled": false,
            "serviceAccountsEnabled": true,
            "authorizationServicesEnabled": true,
            "protocol": "openid-connect",
            "secret": "'"${BACKEND_CLIENT_SECRET:-change-me-in-production}"'"
        }'

    log_info "tenant-management-service client created"
}

# Create customer-portal client
create_customer_portal_client() {
    log_info "Creating customer-portal client..."

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "clientId": "customer-portal",
            "name": "Customer Portal",
            "enabled": true,
            "publicClient": true,
            "standardFlowEnabled": true,
            "implicitFlowEnabled": false,
            "directAccessGrantsEnabled": false,
            "serviceAccountsEnabled": false,
            "authorizationServicesEnabled": false,
            "redirectUris": [
                "http://localhost:3000/*",
                "https://portal.arc-saas.local/*",
                "https://portal.*.arc-saas.com/*"
            ],
            "webOrigins": [
                "http://localhost:3000",
                "https://portal.arc-saas.local",
                "+"
            ],
            "attributes": {
                "pkce.code.challenge.method": "S256",
                "post.logout.redirect.uris": "+"
            },
            "protocol": "openid-connect",
            "fullScopeAllowed": true,
            "defaultClientScopes": ["web-origins", "acr", "profile", "roles", "email"],
            "optionalClientScopes": ["address", "phone", "offline_access"]
        }'

    log_info "customer-portal client created"
}

# Create tenant ID mapper for clients
create_tenant_mapper() {
    log_info "Creating tenant ID mapper..."

    # Get admin-app client ID
    local client_id=$(curl -s "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=admin-app" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.[0].id')

    if [ "$client_id" != "null" ]; then
        curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients/${client_id}/protocol-mappers/models" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "tenant_id",
                "protocol": "openid-connect",
                "protocolMapper": "oidc-usermodel-attribute-mapper",
                "consentRequired": false,
                "config": {
                    "userinfo.token.claim": "true",
                    "user.attribute": "tenantId",
                    "id.token.claim": "true",
                    "access.token.claim": "true",
                    "claim.name": "tenantId",
                    "jsonType.label": "String"
                }
            }'
        log_info "Tenant ID mapper created for admin-app"
    fi
}

# Create initial admin user
create_initial_admin() {
    log_info "Creating initial platform admin user..."

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "platform-admin",
            "email": "admin@arc-saas.local",
            "enabled": true,
            "emailVerified": true,
            "firstName": "Platform",
            "lastName": "Admin",
            "attributes": {
                "tenantId": ["platform"]
            },
            "credentials": [{
                "type": "password",
                "value": "'"${PLATFORM_ADMIN_PASSWORD:-Admin@123}"'",
                "temporary": true
            }],
            "realmRoles": ["super-admin", "admin"]
        }'

    log_info "Platform admin user created (username: platform-admin)"
}

# Main execution
main() {
    log_info "Starting Keycloak bootstrap for ARC-SaaS..."
    log_info "Keycloak URL: ${KEYCLOAK_URL}"
    log_info "Realm: ${REALM_NAME}"

    wait_for_keycloak
    get_admin_token
    create_realm
    create_realm_roles
    create_admin_app_client
    create_backend_client
    create_customer_portal_client
    create_tenant_mapper
    create_initial_admin

    log_info "Keycloak bootstrap completed successfully!"
    log_info ""
    log_info "=== IMPORTANT ==="
    log_info "Platform Admin credentials:"
    log_info "  Username: platform-admin"
    log_info "  Password: ${PLATFORM_ADMIN_PASSWORD:-Admin@123} (temporary, must change on first login)"
    log_info ""
    log_info "Keycloak Admin Console: ${KEYCLOAK_URL}/admin/master/console/"
}

main "$@"
