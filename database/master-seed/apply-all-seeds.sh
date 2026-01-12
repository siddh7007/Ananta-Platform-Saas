#!/bin/bash
# =============================================================================
# Apply All Master Seed Data
# =============================================================================
# This script applies seed data to all databases in the correct order.
#
# Usage:
#   ./apply-all-seeds.sh [environment]
#
# Environments:
#   kubernetes (default) - Apply to Kubernetes pods
#   docker               - Apply to Docker containers
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-kubernetes}"

echo "========================================"
echo "  Ananta Platform - Master Seed Data"
echo "========================================"
echo "Environment: $ENVIRONMENT"
echo "Script Dir: $SCRIPT_DIR"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# =============================================================================
# KUBERNETES MODE
# =============================================================================
apply_kubernetes() {
    echo "Applying seeds to Kubernetes..."

    # Check kubectl is available
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
    fi

    # 1. Control Plane Database (arc_saas)
    echo ""
    echo "1. Applying Control Plane seed (arc_saas)..."
    POSTGRES_POD=$(kubectl get pods -n control-plane -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -z "$POSTGRES_POD" ]; then
        # Try alternative label
        POSTGRES_POD=$(kubectl get pods -n control-plane -l app.kubernetes.io/name=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    fi

    if [ -n "$POSTGRES_POD" ]; then
        kubectl exec -i -n control-plane "$POSTGRES_POD" -- psql -U postgres -d arc_saas < "$SCRIPT_DIR/01_CONTROL_PLANE.sql"
        success "Control Plane seed applied"
    else
        warn "Control Plane Postgres pod not found - skipping"
    fi

    # 2. Supabase Database (App Plane)
    echo ""
    echo "2. Applying Supabase App Plane seed..."
    SUPABASE_POD=$(kubectl get pods -n app-plane -l app=supabase-db -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -z "$SUPABASE_POD" ]; then
        SUPABASE_POD=$(kubectl get pods -n app-plane -l app.kubernetes.io/name=supabase-db -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    fi

    if [ -n "$SUPABASE_POD" ]; then
        kubectl exec -i -n app-plane "$SUPABASE_POD" -- psql -U postgres -d postgres < "$SCRIPT_DIR/02_SUPABASE_APP_PLANE.sql"
        success "Supabase App Plane seed applied"
    else
        warn "Supabase pod not found - skipping"
    fi

    # 3. Components V2 Database
    echo ""
    echo "3. Applying Components V2 seed..."
    COMPONENTS_POD=$(kubectl get pods -n app-plane -l app=components-db -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -z "$COMPONENTS_POD" ]; then
        COMPONENTS_POD=$(kubectl get pods -n app-plane -l app.kubernetes.io/name=components-db -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    fi

    if [ -n "$COMPONENTS_POD" ]; then
        kubectl exec -i -n app-plane "$COMPONENTS_POD" -- psql -U postgres -d components_v2 < "$SCRIPT_DIR/03_COMPONENTS_V2.sql"
        success "Components V2 seed applied"
    else
        warn "Components DB pod not found - skipping"
    fi
}

# =============================================================================
# DOCKER MODE
# =============================================================================
apply_docker() {
    echo "Applying seeds to Docker containers..."

    # 1. Control Plane Database
    echo ""
    echo "1. Applying Control Plane seed (arc_saas)..."
    if docker ps | grep -q "arc-saas-postgres"; then
        docker exec -i arc-saas-postgres psql -U postgres -d arc_saas < "$SCRIPT_DIR/01_CONTROL_PLANE.sql"
        success "Control Plane seed applied"
    else
        warn "arc-saas-postgres container not running - skipping"
    fi

    # 2. Supabase Database
    echo ""
    echo "2. Applying Supabase App Plane seed..."
    if docker ps | grep -q "app-plane-supabase-db"; then
        docker exec -i app-plane-supabase-db psql -U postgres -d postgres < "$SCRIPT_DIR/02_SUPABASE_APP_PLANE.sql"
        success "Supabase App Plane seed applied"
    else
        warn "app-plane-supabase-db container not running - skipping"
    fi

    # 3. Components V2 Database
    echo ""
    echo "3. Applying Components V2 seed..."
    if docker ps | grep -q "app-plane-components-v2-postgres"; then
        docker exec -i app-plane-components-v2-postgres psql -U postgres -d components_v2 < "$SCRIPT_DIR/03_COMPONENTS_V2.sql"
        success "Components V2 seed applied"
    else
        warn "app-plane-components-v2-postgres container not running - skipping"
    fi
}

# =============================================================================
# MAIN
# =============================================================================
case "$ENVIRONMENT" in
    kubernetes|k8s)
        apply_kubernetes
        ;;
    docker)
        apply_docker
        ;;
    *)
        error "Unknown environment: $ENVIRONMENT (use 'kubernetes' or 'docker')"
        ;;
esac

echo ""
echo "========================================"
echo "  Seed Data Application Complete"
echo "========================================"
echo ""
echo "Verify with:"
echo "  kubectl exec -n control-plane deploy/postgres -- psql -U postgres -d arc_saas -c 'SELECT COUNT(*) FROM tenant_management.tenants;'"
echo "  kubectl exec -n app-plane deploy/supabase-db -- psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM organizations;'"
