#!/bin/bash
# ==============================================================================
# Ananta Platform - Database Migration Script
# ==============================================================================
# This script applies all database migrations in the correct order.
# It supports both local Docker containers and Kubernetes deployments.
#
# Usage:
#   ./apply-all-migrations.sh                    # Local Docker (default)
#   ./apply-all-migrations.sh --mode k8s         # Kubernetes via kubectl exec
#   ./apply-all-migrations.sh --dry-run          # Show commands without executing
#
# Environment Variables:
#   SUPABASE_HOST      - Supabase PostgreSQL host (default: localhost)
#   SUPABASE_PORT      - Supabase PostgreSQL port (default: 27432)
#   COMPONENTS_HOST    - Components-V2 PostgreSQL host (default: localhost)
#   COMPONENTS_PORT    - Components-V2 PostgreSQL port (default: 27010)
#   CONTROL_PLANE_HOST - Control Plane PostgreSQL host (default: localhost)
#   CONTROL_PLANE_PORT - Control Plane PostgreSQL port (default: 5432)
#   POSTGRES_USER      - PostgreSQL user (default: postgres)
#   POSTGRES_PASSWORD  - PostgreSQL password (default: postgres)
#
# For Kubernetes mode:
#   K8S_NAMESPACE      - Kubernetes namespace (default: app-plane)
#   KUBECTL_PATH       - Path to kubectl binary
# ==============================================================================

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(dirname "$SCRIPT_DIR")/migrations"

# Configuration with defaults
MODE="${MODE:-docker}"
DRY_RUN=false
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

# Docker mode defaults
SUPABASE_HOST="${SUPABASE_HOST:-localhost}"
SUPABASE_PORT="${SUPABASE_PORT:-27432}"
COMPONENTS_HOST="${COMPONENTS_HOST:-localhost}"
COMPONENTS_PORT="${COMPONENTS_PORT:-27010}"
CONTROL_PLANE_HOST="${CONTROL_PLANE_HOST:-localhost}"
CONTROL_PLANE_PORT="${CONTROL_PLANE_PORT:-5432}"

# Kubernetes mode defaults
K8S_NAMESPACE="${K8S_NAMESPACE:-app-plane}"
KUBECTL_PATH="${KUBECTL_PATH:-kubectl}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --namespace)
            K8S_NAMESPACE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--mode docker|k8s] [--dry-run] [--namespace NAMESPACE]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Execute SQL command based on mode
exec_sql() {
    local db_type=$1
    local db_name=$2
    local sql_file=$3
    local cmd=""

    if [[ "$MODE" == "k8s" ]]; then
        case $db_type in
            supabase)
                cmd="$KUBECTL_PATH exec -n $K8S_NAMESPACE supabase-db-0 -- psql -U $POSTGRES_USER -d $db_name -f -"
                ;;
            components)
                cmd="$KUBECTL_PATH exec -n $K8S_NAMESPACE components-db-0 -- psql -U $POSTGRES_USER -d $db_name -f -"
                ;;
            control-plane)
                cmd="$KUBECTL_PATH exec -n database-system ananta-local-pg-1 -- psql -U $POSTGRES_USER -d $db_name -f -"
                ;;
        esac
    else
        case $db_type in
            supabase)
                cmd="PGPASSWORD=$POSTGRES_PASSWORD psql -h $SUPABASE_HOST -p $SUPABASE_PORT -U $POSTGRES_USER -d $db_name -f $sql_file"
                ;;
            components)
                cmd="PGPASSWORD=$POSTGRES_PASSWORD psql -h $COMPONENTS_HOST -p $COMPONENTS_PORT -U $POSTGRES_USER -d $db_name -f $sql_file"
                ;;
            control-plane)
                cmd="PGPASSWORD=$POSTGRES_PASSWORD psql -h $CONTROL_PLANE_HOST -p $CONTROL_PLANE_PORT -U $POSTGRES_USER -d $db_name -f $sql_file"
                ;;
        esac
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would execute: $cmd"
        return 0
    fi

    log_info "Executing: $(basename "$sql_file") on $db_type ($db_name)"

    if [[ "$MODE" == "k8s" ]]; then
        cat "$sql_file" | eval "$cmd"
    else
        eval "$cmd"
    fi
}

# Main execution
echo "=============================================="
echo " Ananta Platform - Database Migrations"
echo "=============================================="
echo "Mode: $MODE"
echo "Migrations Dir: $MIGRATIONS_DIR"
echo ""

# Check migrations directory exists
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    log_error "Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Migration order and targets
# Format: "filename|db_type|db_name"
#
# Database targets:
#   supabase      = App Plane Supabase (postgres on 27432)
#   components    = Components-V2 (components_v2 on 27010)
#   control-plane = Control Plane (ananta/arc_saas on 5432)
#
# NOTE: Migration 004 is DEPRECATED (overlaps with 003) - skipped by default
#
MIGRATIONS=(
    "001_SUPABASE_MASTER.sql|supabase|postgres"
    "002_COMPONENTS_V2_MASTER.sql|components|components_v2"
    "003_ARC_SAAS_MASTER.sql|control-plane|arc_saas"
    # "004_CONTROL_PLANE_MASTER.sql|control-plane|ananta"  # DEPRECATED - overlaps with 003
    "005_DIRECTUS_ENRICHMENT_TABLES.sql|components|components_v2"
    "006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql|control-plane|ananta"
    "007_component_catalog_table.sql|components|components_v2"
    "008_column_mapping_templates.sql|supabase|postgres"
)

# Apply migrations in order
TOTAL=${#MIGRATIONS[@]}
CURRENT=0
FAILED=0

for migration in "${MIGRATIONS[@]}"; do
    IFS='|' read -r filename db_type db_name <<< "$migration"
    CURRENT=$((CURRENT + 1))

    sql_file="$MIGRATIONS_DIR/$filename"

    echo ""
    echo "[$CURRENT/$TOTAL] Processing: $filename"
    echo "  Target: $db_type / $db_name"

    if [[ ! -f "$sql_file" ]]; then
        log_warning "Migration file not found: $filename (skipping)"
        continue
    fi

    if exec_sql "$db_type" "$db_name" "$sql_file"; then
        log_success "Applied: $filename"
    else
        log_error "Failed: $filename"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=============================================="
echo " Migration Summary"
echo "=============================================="
echo "Total: $TOTAL"
echo "Applied: $((TOTAL - FAILED))"
echo "Failed: $FAILED"

if [[ $FAILED -gt 0 ]]; then
    log_error "Some migrations failed. Check output above."
    exit 1
else
    log_success "All migrations applied successfully!"
fi
