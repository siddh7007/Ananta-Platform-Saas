#!/bin/bash
# =============================================================================
# Network Initialization Script - Ananta Platform Monitoring
# =============================================================================
# Creates Docker networks required for cross-stack communication between:
# - Control Plane (arc-saas)
# - App Plane (app-plane)
# - Shared Monitoring Stack
#
# Run this BEFORE starting any services for the first time.
# =============================================================================

set -e

echo "============================================="
echo "Ananta Platform - Network Initialization"
echo "============================================="

# Create arc-saas network (Control Plane)
if docker network inspect arc-saas >/dev/null 2>&1; then
    echo "[OK] Network 'arc-saas' already exists"
else
    echo "[CREATE] Creating network 'arc-saas'..."
    docker network create arc-saas
    echo "[OK] Network 'arc-saas' created"
fi

# Create app-plane network (App Plane)
if docker network inspect app-plane >/dev/null 2>&1; then
    echo "[OK] Network 'app-plane' already exists"
else
    echo "[CREATE] Creating network 'app-plane'..."
    docker network create app-plane
    echo "[OK] Network 'app-plane' created"
fi

# Create shared-temporal-network (Temporal Workflow Engine)
if docker network inspect shared-temporal-network >/dev/null 2>&1; then
    echo "[OK] Network 'shared-temporal-network' already exists"
else
    echo "[CREATE] Creating network 'shared-temporal-network'..."
    docker network create shared-temporal-network
    echo "[OK] Network 'shared-temporal-network' created"
fi

# Create shared-monitoring network (Prometheus, Grafana, AlertManager)
if docker network inspect shared-monitoring >/dev/null 2>&1; then
    echo "[OK] Network 'shared-monitoring' already exists"
else
    echo "[CREATE] Creating network 'shared-monitoring'..."
    docker network create shared-monitoring
    echo "[OK] Network 'shared-monitoring' created"
fi

echo ""
echo "============================================="
echo "Network Summary"
echo "============================================="
echo ""
docker network ls --filter "name=arc-saas" --filter "name=app-plane" --filter "name=shared-temporal" --filter "name=shared-monitoring" --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"
echo ""
echo "[DONE] All networks initialized successfully!"
echo ""
echo "Next steps:"
echo "  1. Start Control Plane:  cd arc-saas && docker-compose up -d"
echo "  2. Start App Plane:      cd app-plane && docker-compose up -d"
echo "  3. Start Monitoring:     cd shared-monitoring && docker-compose up -d"
echo ""
