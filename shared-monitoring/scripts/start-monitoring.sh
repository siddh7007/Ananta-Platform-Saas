#!/bin/bash
# =============================================================================
# Start Monitoring Stack - Ananta Platform
# =============================================================================
# Starts the shared monitoring stack (Prometheus, Grafana, AlertManager, Blackbox)
# Ensures all prerequisite networks exist before starting.
#
# Usage:
#   ./start-monitoring.sh          # Start monitoring
#   ./start-monitoring.sh --down   # Stop monitoring
#   ./start-monitoring.sh --logs   # View logs
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"

cd "$MONITORING_DIR"

echo "============================================="
echo "Ananta Platform - Monitoring Stack"
echo "============================================="

# Handle command line arguments
case "${1:-}" in
    --down)
        echo "[STOP] Stopping monitoring stack..."
        docker-compose down
        echo "[OK] Monitoring stack stopped"
        exit 0
        ;;
    --logs)
        docker-compose logs -f
        exit 0
        ;;
    --status)
        docker-compose ps
        exit 0
        ;;
    --help)
        echo "Usage: $0 [--down|--logs|--status|--help]"
        echo ""
        echo "Commands:"
        echo "  (no args)   Start the monitoring stack"
        echo "  --down      Stop the monitoring stack"
        echo "  --logs      Follow logs from all services"
        echo "  --status    Show status of all services"
        echo "  --help      Show this help message"
        exit 0
        ;;
esac

# Step 1: Initialize networks
echo ""
echo "[STEP 1] Checking Docker networks..."
./scripts/init-networks.sh

# Step 2: Verify prerequisite services are running
echo ""
echo "[STEP 2] Checking prerequisite services..."

# Check if arc-saas is running (optional)
if docker ps --format '{{.Names}}' | grep -q "tenant-management-service" 2>/dev/null; then
    echo "[OK] Control Plane (arc-saas) is running"
else
    echo "[WARN] Control Plane (arc-saas) not detected - some targets may be unreachable"
fi

# Check if app-plane is running (optional)
if docker ps --format '{{.Names}}' | grep -q "app-plane" 2>/dev/null; then
    echo "[OK] App Plane services detected"
else
    echo "[WARN] App Plane services not detected - some targets may be unreachable"
fi

# Step 3: Start monitoring stack
echo ""
echo "[STEP 3] Starting monitoring stack..."
docker-compose up -d

# Step 4: Wait for services to be healthy
echo ""
echo "[STEP 4] Waiting for services to be healthy..."
sleep 5

# Check health of each service
for service in prometheus grafana alertmanager blackbox-exporter; do
    if docker-compose ps "$service" 2>/dev/null | grep -q "Up"; then
        echo "[OK] $service is running"
    else
        echo "[WARN] $service may not be healthy"
    fi
done

# Final summary
echo ""
echo "============================================="
echo "Monitoring Stack Started Successfully!"
echo "============================================="
echo ""
echo "Access URLs:"
echo "  Prometheus:    http://localhost:9090"
echo "  Grafana:       http://localhost:3001  (admin/admin123)"
echo "  AlertManager:  http://localhost:9093"
echo "  Blackbox:      http://localhost:9115"
echo ""
echo "Useful commands:"
echo "  View logs:     docker-compose logs -f"
echo "  Stop stack:    $0 --down"
echo "  Check status:  $0 --status"
echo ""
