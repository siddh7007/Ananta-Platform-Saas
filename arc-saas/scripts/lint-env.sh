#!/bin/bash
# =============================================================================
# Environment File Linter
# =============================================================================
# Validates .env.example files for:
# - Consistent Keycloak port defaults based on context
# - Proper port configurations
# - Required variables present
#
# Keycloak Port Rules:
# - Frontend apps (VITE_KEYCLOAK_URL): 8180 (local) or 14003 (Docker external)
# - Backend services (KEYCLOAK_HOST/KEYCLOAK_URL): 8180 (local) or keycloak:8080 (Docker internal)
#
# Usage: ./scripts/lint-env.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "  Environment File Linter"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

check_file_exists() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo -e "${YELLOW}[INFO]${NC} File not found (may be optional): $file"
        return 1
    fi
    return 0
}

# Check Keycloak URL for frontend apps (VITE_KEYCLOAK_URL)
check_frontend_keycloak_url() {
    local file="$1"

    if ! check_file_exists "$file"; then
        return
    fi

    local keycloak_line=$(grep -E "^VITE_KEYCLOAK_URL=" "$file" 2>/dev/null || true)

    if [[ -z "$keycloak_line" ]]; then
        echo -e "${YELLOW}[WARN]${NC} $file - No VITE_KEYCLOAK_URL (frontend apps need this)"
        ((WARNINGS++))
        return
    fi

    local url=$(echo "$keycloak_line" | cut -d'=' -f2)

    # Valid frontend ports: 8180 (local) or 14003 (Docker external)
    if [[ "$url" =~ :8180 ]] || [[ "$url" =~ :14003 ]]; then
        echo -e "${GREEN}[OK]${NC} $file - VITE_KEYCLOAK_URL: $url"
    elif [[ "$url" =~ keycloak:8080 ]]; then
        echo -e "${RED}[ERROR]${NC} $file - VITE_KEYCLOAK_URL uses Docker internal hostname"
        echo "         Frontend apps should use localhost:8180 or localhost:14003, not keycloak:8080"
        ((ERRORS++))
    else
        echo -e "${YELLOW}[WARN]${NC} $file - VITE_KEYCLOAK_URL: $url"
        echo "         Expected port 8180 (local) or 14003 (Docker external)"
        ((WARNINGS++))
    fi
}

# Check Keycloak config for backend services (KEYCLOAK_HOST or KEYCLOAK_URL)
check_backend_keycloak_config() {
    local file="$1"

    if ! check_file_exists "$file"; then
        return
    fi

    # Check for KEYCLOAK_HOST (used by tenant-management-service)
    local keycloak_host=$(grep -E "^KEYCLOAK_HOST=" "$file" 2>/dev/null || true)
    # Check for KEYCLOAK_URL (used by other backend services)
    local keycloak_url=$(grep -E "^KEYCLOAK_URL=" "$file" 2>/dev/null || true)

    if [[ -n "$keycloak_host" ]]; then
        local host=$(echo "$keycloak_host" | cut -d'=' -f2)
        if [[ -z "$host" ]]; then
            echo -e "${BLUE}[INFO]${NC} $file - KEYCLOAK_HOST is empty (will need to be set)"
        elif [[ "$host" =~ :8180 ]] || [[ "$host" =~ keycloak:8080 ]] || [[ "$host" =~ :14003 ]]; then
            echo -e "${GREEN}[OK]${NC} $file - KEYCLOAK_HOST: $host"
        else
            echo -e "${YELLOW}[WARN]${NC} $file - KEYCLOAK_HOST: $host"
            echo "         Expected: localhost:8180 (local), keycloak:8080 (Docker internal), or localhost:14003 (Docker external)"
            ((WARNINGS++))
        fi
    elif [[ -n "$keycloak_url" ]]; then
        local url=$(echo "$keycloak_url" | cut -d'=' -f2)
        if [[ "$url" =~ :8180 ]] || [[ "$url" =~ keycloak:8080 ]] || [[ "$url" =~ :14003 ]]; then
            echo -e "${GREEN}[OK]${NC} $file - KEYCLOAK_URL: $url"
        else
            echo -e "${YELLOW}[WARN]${NC} $file - KEYCLOAK_URL: $url"
            echo "         Expected port 8180 (local), keycloak:8080 (internal), or 14003 (Docker external)"
            ((WARNINGS++))
        fi
    else
        # No Keycloak config found - might be intentional
        echo -e "${BLUE}[INFO]${NC} $file - No KEYCLOAK_HOST or KEYCLOAK_URL found"
    fi
}

check_api_url() {
    local file="$1"
    local expected_port="$2"

    if ! check_file_exists "$file"; then
        return
    fi

    local api_line=$(grep -E "^(VITE_)?API_URL=" "$file" 2>/dev/null || true)

    if [[ -z "$api_line" ]]; then
        # Not all files need API_URL
        return
    fi

    if [[ "$api_line" =~ ":$expected_port" ]]; then
        echo -e "${GREEN}[OK]${NC} $file - API URL uses port $expected_port"
    else
        local actual_url=$(echo "$api_line" | cut -d'=' -f2)
        if [[ -z "$actual_url" ]]; then
            echo -e "${BLUE}[INFO]${NC} $file - API URL is empty (will need to be set)"
        else
            echo -e "${RED}[ERROR]${NC} $file - API URL: $actual_url"
            echo "          Expected port $expected_port (tenant-management-service)"
            ((ERRORS++))
        fi
    fi
}

check_required_vars() {
    local file="$1"
    shift
    local required_vars=("$@")

    if ! check_file_exists "$file"; then
        return
    fi

    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" "$file" 2>/dev/null; then
            echo -e "${GREEN}[OK]${NC} $file - Has $var"
        else
            echo -e "${RED}[ERROR]${NC} $file - Missing required variable: $var"
            ((ERRORS++))
        fi
    done
}

# -----------------------------------------------------------------------------
# Check Admin App
# -----------------------------------------------------------------------------
echo "--- Checking admin-app ---"
ADMIN_ENV="$ROOT_DIR/apps/admin-app/.env.example"

check_frontend_keycloak_url "$ADMIN_ENV"
check_api_url "$ADMIN_ENV" "14000"
check_required_vars "$ADMIN_ENV" \
    "VITE_KEYCLOAK_URL" \
    "VITE_KEYCLOAK_REALM" \
    "VITE_KEYCLOAK_CLIENT_ID" \
    "VITE_API_URL"

echo ""

# -----------------------------------------------------------------------------
# Check tenant-management-service
# -----------------------------------------------------------------------------
echo "--- Checking tenant-management-service ---"
TMS_ENV="$ROOT_DIR/services/tenant-management-service/.env.example"

if check_file_exists "$TMS_ENV"; then
    check_backend_keycloak_config "$TMS_ENV"
    check_required_vars "$TMS_ENV" \
        "DB_HOST" \
        "DB_PORT" \
        "JWT_SECRET"
fi

echo ""

# -----------------------------------------------------------------------------
# Check App Plane CNS Service (if exists)
# -----------------------------------------------------------------------------
echo "--- Checking app-plane CNS service ---"
CNS_ENV="$ROOT_DIR/../app-plane/services/cns-service/.env.example"

if [[ -f "$CNS_ENV" ]]; then
    check_backend_keycloak_config "$CNS_ENV"
    check_required_vars "$CNS_ENV" \
        "KEYCLOAK_URL" \
        "KEYCLOAK_REALM" \
        "DATABASE_URL"
else
    echo -e "${BLUE}[INFO]${NC} CNS service .env.example not found (app-plane may not be present)"
fi

echo ""

# -----------------------------------------------------------------------------
# Check for common misconfigurations
# -----------------------------------------------------------------------------
echo "--- Checking for common misconfigurations ---"

# Check for wrong localhost ports in any .env.example
for env_file in $(find "$ROOT_DIR" -name ".env.example" -type f 2>/dev/null); do
    # Check for localhost:3000 (often wrong for backend - Vite default)
    if grep -q "API.*localhost:3000" "$env_file" 2>/dev/null; then
        echo -e "${YELLOW}[WARN]${NC} $env_file uses localhost:3000 for API - should likely be 14000"
        ((WARNINGS++))
    fi

    # Check for localhost:5173 (Vite dev default - might be wrong for production configs)
    if grep -qE "CUSTOMER_APP.*localhost:5173" "$env_file" 2>/dev/null; then
        echo -e "${YELLOW}[WARN]${NC} $env_file uses localhost:5173 - should be 27555 for admin-app"
        ((WARNINGS++))
    fi
done

echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo ""

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}Errors: $ERRORS${NC}"
fi

if [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi

if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}All checks passed!${NC}"
fi

echo ""
echo "Port Reference:"
echo "  Keycloak:"
echo "    - Local dev:        http://localhost:8180"
echo "    - Docker external:  http://localhost:14003"
echo "    - Docker internal:  http://keycloak:8080"
echo "  Control Plane API:    http://localhost:14000"
echo "  Admin App:            http://localhost:27555"
echo ""

# Exit with error code if there are errors
if [[ $ERRORS -gt 0 ]]; then
    echo "Fix the errors above before committing."
    exit 1
fi

exit 0
