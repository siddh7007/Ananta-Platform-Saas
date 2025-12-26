#!/usr/bin/env pwsh
# =============================================================================
# ARC SaaS Platform Shutdown Script
# =============================================================================
# Stops all services in reverse dependency order
#
# Usage:
#   ./stop-platform.ps1                  # Stop everything
#   ./stop-platform.ps1 -RemoveVolumes   # Stop and remove data volumes (DANGER!)
#   ./stop-platform.ps1 -ControlPlaneOnly # Stop only Control Plane
#   ./stop-platform.ps1 -AppPlaneOnly    # Stop only App Plane
#
# =============================================================================

param(
    [switch]$RemoveVolumes,
    [switch]$ControlPlaneOnly,
    [switch]$AppPlaneOnly
)

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }

$ROOT = "e:\Work\Ananta-Platform-Saas"

# Warning for volume removal
if ($RemoveVolumes) {
    Write-Warn "========================================="
    Write-Warn "WARNING: You are about to remove all data volumes!"
    Write-Warn "This will DELETE all databases, Redis data, and uploads."
    Write-Warn "========================================="
    $confirm = Read-Host "Type 'DELETE ALL DATA' to confirm"
    if ($confirm -ne "DELETE ALL DATA") {
        Write-Host "Aborted."
        exit 0
    }
}

# ============================================================================
# Stop in reverse dependency order
# ============================================================================

if (-not $ControlPlaneOnly) {
    Write-Step "Stopping App Plane services..."

    Push-Location "$ROOT\app-plane"

    Write-Step "Stopping frontend applications..."
    docker-compose stop customer-portal cns-dashboard backstage-portal dashboard 2>$null

    Write-Step "Stopping backend services..."
    docker-compose stop django-backend middleware-api webhook-bridge 2>$null
    docker-compose stop cns-service cns-worker audit-logger novu-consumer 2>$null

    Write-Step "Stopping App Plane infrastructure..."
    docker-compose stop directus supabase-studio supabase-api supabase-meta 2>$null
    docker-compose stop minio rabbitmq redis redis-exporter 2>$null
    docker-compose stop components-v2-postgres supabase-db 2>$null

    if ($RemoveVolumes) {
        docker-compose down -v
    } else {
        docker-compose down
    }

    Pop-Location

    Write-Success "App Plane stopped"
}

if (-not $AppPlaneOnly) {
    Write-Step "Stopping Control Plane services..."

    Push-Location "$ROOT\arc-saas"

    Write-Step "Stopping frontend applications..."
    docker-compose stop admin-app customer-app 2>$null

    Write-Step "Stopping Control Plane services..."
    docker-compose stop tenant-management-service temporal-worker-service 2>$null
    docker-compose stop subscription-service 2>$null

    Write-Step "Stopping Novu services..."
    docker-compose stop novu-web novu-worker novu-ws novu-api 2>$null
    docker-compose stop novu-redis novu-mongodb 2>$null

    Write-Step "Stopping Control Plane infrastructure..."
    docker-compose stop jaeger minio keycloak redis postgres 2>$null

    if ($RemoveVolumes) {
        docker-compose down -v
    } else {
        docker-compose down
    }

    Pop-Location

    Write-Success "Control Plane stopped"
}

if (-not $AppPlaneOnly -and -not $ControlPlaneOnly) {
    Write-Step "Stopping Shared Temporal infrastructure..."

    Push-Location "$ROOT\app-plane\temporal"

    docker-compose stop temporal-ui temporal temporal-postgresql 2>$null

    if ($RemoveVolumes) {
        docker-compose down -v
    } else {
        docker-compose down
    }

    Pop-Location

    Write-Success "Shared Temporal stopped"
}

# ============================================================================
# Final Cleanup
# ============================================================================

Write-Step ""
Write-Success "========================================="
Write-Success "Platform shutdown complete!"
Write-Success "========================================="
Write-Step ""
Write-Step "Remaining containers:"
docker ps --format "table {{.Names}}\t{{.Status}}"

if ($RemoveVolumes) {
    Write-Warn ""
    Write-Warn "All data volumes have been removed."
    Write-Warn "Next startup will create fresh databases."
}

Write-Step ""
Write-Step "To start services again:"
Write-Step "  .\start-platform.ps1"
