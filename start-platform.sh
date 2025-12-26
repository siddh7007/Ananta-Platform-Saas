#!/bin/bash
# ==============================================
# Ananta Platform Unified Startup Script
# ==============================================
# This script starts both Control Plane and App Plane services
# with a shared Temporal instance from Components V2
#
# Usage:
#   ./start-platform.sh              # Start all services
#   ./start-platform.sh control      # Start Control Plane only (requires App Plane Temporal)
#   ./start-platform.sh app          # Start App Plane only (includes Temporal)
#   ./start-platform.sh stop         # Stop all services
#   ./start-platform.sh logs         # View logs from all services
#
# ==============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROL_PLANE_DIR="$SCRIPT_DIR/arc-saas"
APP_PLANE_DIR="$SCRIPT_DIR/app-plane"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "=============================================="
    echo "  Ananta Platform - Multi-Tenant SaaS"
    echo "=============================================="
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

start_app_plane() {
    print_status "Starting App Plane (Components Platform V2)..."
    print_status "This includes the shared Temporal instance..."

    cd "$APP_PLANE_DIR"

    # Check if .env exists
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Copying from .env.example..."
        cp .env.example .env
        print_warning "Please edit app-plane/.env with your configuration!"
    fi

    # Create the network if it doesn't exist
    docker network create components-v2-network 2>/dev/null || true

    # Start App Plane services (includes Temporal)
    print_status "Starting App Plane infrastructure (Temporal, Supabase, Redis)..."
    docker-compose up -d

    # Wait for Temporal to be ready
    print_status "Waiting for Temporal to be healthy..."
    sleep 15

    # Initialize namespaces
    print_status "Initializing Temporal namespaces (arc-saas, default, enrichment)..."
    if [ -f "temporal/init-namespaces.sh" ]; then
        docker exec components-v2-temporal sh -c "
            for i in 1 2 3 4 5; do
                temporal operator namespace create arc-saas --address temporal:7233 2>/dev/null && break || sleep 5
            done
            temporal operator namespace create default --address temporal:7233 2>/dev/null || true
            temporal operator namespace create enrichment --address temporal:7233 2>/dev/null || true
        " 2>/dev/null || print_warning "Namespaces may already exist"
    fi

    print_status "App Plane started!"
    echo ""
    echo "App Plane Services:"
    echo "  - Temporal Server:   localhost:27020 (shared)"
    echo "  - Temporal UI:       http://localhost:27021"
    echo "  - Webhook Bridge:    http://localhost:27600"
    echo "  - Supabase DB:       localhost:27432"
    echo "  - Supabase Studio:   http://localhost:27800"
    echo "  - Supabase API:      http://localhost:27810"
    echo ""
}

start_control_plane() {
    print_status "Starting Control Plane (ARC SaaS)..."

    # Check if App Plane Temporal is running
    if ! docker ps | grep -q "components-v2-temporal"; then
        print_warning "Temporal (components-v2-temporal) is not running!"
        print_warning "Starting App Plane first to get Temporal..."
        start_app_plane
    fi

    cd "$CONTROL_PLANE_DIR"

    # Create control plane network
    docker network create arc-saas 2>/dev/null || true

    # Start core infrastructure (PostgreSQL, Redis, Keycloak)
    print_status "Starting Control Plane infrastructure..."
    docker-compose up -d postgres redis keycloak

    # Wait for dependencies
    print_status "Waiting for Control Plane dependencies..."
    sleep 10

    # Start Novu
    print_status "Starting Novu (Notifications)..."
    docker-compose up -d novu-mongodb novu-redis minio minio-init novu-api novu-ws novu-worker novu-web

    # Start observability
    print_status "Starting Jaeger (Tracing)..."
    docker-compose up -d jaeger

    print_status "Control Plane infrastructure started!"
    echo ""
    echo "Control Plane Services:"
    echo "  - PostgreSQL:    localhost:5432"
    echo "  - Redis:         localhost:6379"
    echo "  - Keycloak:      http://localhost:8180 (admin/admin)"
    echo "  - Novu Web:      http://localhost:14200"
    echo "  - Novu API:      http://localhost:13100"
    echo "  - Jaeger:        http://localhost:16686"
    echo "  - MinIO:         http://localhost:9001 (minioadmin/minioadmin123)"
    echo ""
    echo "NOTE: Temporal is provided by App Plane at localhost:27020"
    echo ""
}

stop_all() {
    print_status "Stopping all services..."

    cd "$CONTROL_PLANE_DIR"
    docker-compose down 2>/dev/null || true

    cd "$APP_PLANE_DIR"
    docker-compose down 2>/dev/null || true

    print_status "All services stopped!"
}

show_logs() {
    print_status "Showing logs from all services (Ctrl+C to exit)..."

    # Follow logs from both compose files
    cd "$CONTROL_PLANE_DIR"
    docker-compose logs -f &
    PID1=$!

    cd "$APP_PLANE_DIR"
    docker-compose logs -f &
    PID2=$!

    trap "kill $PID1 $PID2 2>/dev/null" EXIT
    wait
}

show_status() {
    print_header

    echo "=== Shared Temporal (from App Plane) ==="
    docker ps --filter "name=components-v2-temporal" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (not running)"
    echo ""

    echo "=== Control Plane Containers ==="
    cd "$CONTROL_PLANE_DIR"
    docker-compose ps 2>/dev/null || echo "  (not running)"
    echo ""

    echo "=== App Plane Containers ==="
    cd "$APP_PLANE_DIR"
    docker-compose ps 2>/dev/null || echo "  (not running)"
    echo ""
}

# Main
print_header

case "${1:-all}" in
    control)
        start_control_plane
        ;;
    app)
        start_app_plane
        ;;
    stop)
        stop_all
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    all|"")
        # Start App Plane first (provides Temporal)
        start_app_plane
        echo ""
        # Then start Control Plane
        start_control_plane
        echo ""
        print_status "Platform startup complete!"
        echo ""
        echo "=============================================="
        echo "  Platform Summary"
        echo "=============================================="
        echo ""
        echo "Shared Services:"
        echo "  - Temporal:          localhost:27020 (UI: http://localhost:27021)"
        echo ""
        echo "Control Plane (ARC SaaS):"
        echo "  - Tenant Mgmt API:   http://localhost:14000 (run npm start:dev)"
        echo "  - Admin Portal:      http://localhost:3000 (run npm start)"
        echo "  - Keycloak:          http://localhost:8180"
        echo ""
        echo "App Plane (Components Platform):"
        echo "  - Webhook Bridge:    http://localhost:27600"
        echo "  - Customer Portal:   http://localhost:27100"
        echo "  - Django Backend:    http://localhost:27000"
        echo ""
        echo "Next steps:"
        echo "  1. cd arc-saas/services/tenant-management-service && npm run start:dev"
        echo "  2. cd arc-saas/services/temporal-worker-service && npm run start:dev"
        echo "  3. Access Temporal UI: http://localhost:27021 (select arc-saas namespace)"
        echo ""
        ;;
    *)
        echo "Usage: $0 [control|app|stop|logs|status|all]"
        echo ""
        echo "Commands:"
        echo "  control  - Start Control Plane only (requires App Plane for Temporal)"
        echo "  app      - Start App Plane only (includes shared Temporal)"
        echo "  stop     - Stop all services"
        echo "  logs     - View logs from all services"
        echo "  status   - Show status of all services"
        echo "  all      - Start everything (default)"
        exit 1
        ;;
esac
