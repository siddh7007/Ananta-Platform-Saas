#!/bin/bash
# =============================================================================
# Temporal Namespace Initialization Script
# =============================================================================
# This script creates all required namespaces for both Control Plane and App Plane
# Run this after Temporal server is ready
#
# Namespaces:
#   - arc-saas: Control Plane workflows (tenant provisioning, user invitation)
#   - default: App Plane component workflows
#   - enrichment: App Plane BOM enrichment workflows
#
# Usage:
#   From local: ./init-namespaces.sh
#   From Docker: docker exec shared-temporal-admin ./init-namespaces.sh
# =============================================================================

set -e

# Shared Temporal instance configuration
# Docker internal: shared-temporal:7233
# Local access:    localhost:27020
TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS:-localhost:27020}

echo "=============================================="
echo "  Temporal Namespace Initialization"
echo "=============================================="
echo "Temporal Address: $TEMPORAL_ADDRESS"
echo ""

echo "Waiting for Temporal to be ready..."
for i in {1..30}; do
    if temporal operator cluster health --address "$TEMPORAL_ADDRESS" 2>/dev/null | grep -q "SERVING"; then
        echo "✓ Temporal is ready"
        break
    fi
    echo "  Attempt $i/30 - waiting for Temporal..."
    sleep 2
done

# =============================================================================
# Control Plane Namespace (ARC SaaS)
# =============================================================================
echo ""
echo "Creating Control Plane namespace: arc-saas"
temporal operator namespace create arc-saas \
    --address "$TEMPORAL_ADDRESS" \
    --description "Control Plane - Tenant provisioning and management workflows" \
    --retention 168h \
    --history-archival-state Disabled \
    --visibility-archival-state Disabled \
    2>/dev/null && echo "  ✓ Namespace 'arc-saas' created" || echo "  ℹ Namespace 'arc-saas' already exists"

# =============================================================================
# App Plane Namespaces (Components Platform V2)
# =============================================================================
echo ""
echo "Creating App Plane namespace: default"
temporal operator namespace create default \
    --address "$TEMPORAL_ADDRESS" \
    --description "App Plane - Default namespace for component workflows" \
    --retention 72h \
    --history-archival-state Disabled \
    --visibility-archival-state Disabled \
    2>/dev/null && echo "  ✓ Namespace 'default' created" || echo "  ℹ Namespace 'default' already exists"

echo ""
echo "Creating App Plane namespace: enrichment"
temporal operator namespace create enrichment \
    --address "$TEMPORAL_ADDRESS" \
    --description "App Plane - BOM enrichment and analysis workflows" \
    --retention 72h \
    --history-archival-state Disabled \
    --visibility-archival-state Disabled \
    2>/dev/null && echo "  ✓ Namespace 'enrichment' created" || echo "  ℹ Namespace 'enrichment' already exists"

# =============================================================================
# Verify Namespaces
# =============================================================================
echo ""
echo "=============================================="
echo "  Namespace Verification"
echo "=============================================="
temporal operator namespace list --address "$TEMPORAL_ADDRESS" 2>/dev/null | head -20

echo ""
echo "✓ Namespace initialization complete!"
echo ""
echo "Namespace Summary:"
echo "  - arc-saas    : Control Plane (tenant provisioning, user invitation)"
echo "  - default     : App Plane (component workflows)"
echo "  - enrichment  : App Plane (BOM enrichment)"
echo ""
echo "Access Temporal UI at: http://localhost:27021"
echo ""
