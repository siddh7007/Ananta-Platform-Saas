#!/usr/bin/env pwsh
# =============================================================================
# ARC SaaS Platform Startup Script
# =============================================================================
# Starts all infrastructure in correct dependency order with health verification
#
# Usage:
#   ./start-platform.ps1                  # Start everything
#   ./start-platform.ps1 -Clean           # Clean start (remove all containers first)
#   ./start-platform.ps1 -ControlPlaneOnly # Start only Control Plane
#   ./start-platform.ps1 -AppPlaneOnly    # Start only App Plane
#   ./start-platform.ps1 -SkipTemporal    # Skip Temporal infrastructure
#
# =============================================================================

param(
    [switch]$Clean,
    [switch]$SkipTemporal,
    [switch]$ControlPlaneOnly,
    [switch]$AppPlaneOnly
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Step { param($msg) Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Root directory
$ROOT = "e:\Work\Ananta-Platform-Saas"

# Helper function: Wait for health check
function Wait-ForHealth {
    param(
        [string]$Container,
        [int]$MaxWaitSeconds = 60,
        [string]$HealthCommand = $null
    )

    Write-Step "Waiting for $Container to be healthy..."
    $elapsed = 0
    $interval = 5

    while ($elapsed -lt $MaxWaitSeconds) {
        $health = docker inspect --format='{{.State.Health.Status}}' $Container 2>$null

        if ($health -eq "healthy") {
            Write-Success "$Container is healthy"
            return $true
        }

        # If no healthcheck, check if container is running
        if ($health -eq "") {
            $status = docker inspect --format='{{.State.Status}}' $Container 2>$null
            if ($status -eq "running") {
                # Custom health command if provided
                if ($HealthCommand) {
                    $result = docker exec $Container $HealthCommand 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        Write-Success "$Container is running and passed custom health check"
                        return $true
                    }
                } else {
                    Write-Warn "$Container has no healthcheck, assuming healthy after 10s"
                    Start-Sleep -Seconds 10
                    return $true
                }
            }
        }

        Start-Sleep -Seconds $interval
        $elapsed += $interval
        Write-Host "." -NoNewline
    }

    Write-Fail "$Container failed to become healthy in ${MaxWaitSeconds}s"
    return $false
}

# Helper function: Stop all services
function Stop-AllServices {
    Write-Step "Stopping all services..."

    Push-Location "$ROOT\arc-saas"
    docker-compose down 2>$null
    Pop-Location

    Push-Location "$ROOT\app-plane"
    docker-compose down 2>$null
    Pop-Location

    Push-Location "$ROOT\app-plane\temporal"
    docker-compose down 2>$null
    Pop-Location

    Write-Success "All services stopped"
}

# Clean start
if ($Clean) {
    Write-Warn "Clean start requested - removing all containers"
    Stop-AllServices
    Start-Sleep -Seconds 5
}

# ============================================================================
# LEVEL 0: Shared Infrastructure
# ============================================================================
if (-not $AppPlaneOnly) {
    Write-Step "========================================="
    Write-Step "LEVEL 0: Shared Temporal Infrastructure"
    Write-Step "========================================="

    if (-not $SkipTemporal) {
        # Create shared network if not exists
        $networkExists = docker network ls --format '{{.Name}}' | Select-String -Pattern "^shared-temporal-network$"
        if (-not $networkExists) {
            Write-Step "Creating shared-temporal-network..."
            docker network create shared-temporal-network
        }

        $networkExists = docker network ls --format '{{.Name}}' | Select-String -Pattern "^arc-saas$"
        if (-not $networkExists) {
            Write-Step "Creating arc-saas network..."
            docker network create arc-saas
        }

        $networkExists = docker network ls --format '{{.Name}}' | Select-String -Pattern "^app-plane$"
        if (-not $networkExists) {
            Write-Step "Creating app-plane network..."
            docker network create app-plane
        }

        # Start Temporal infrastructure
        Push-Location "$ROOT\app-plane\temporal"
        Write-Step "Starting Temporal PostgreSQL..."
        docker-compose up -d temporal-postgresql
        if (-not (Wait-ForHealth "shared-temporal-postgres" 60)) { exit 1 }

        Write-Step "Starting Temporal Server..."
        docker-compose up -d temporal
        if (-not (Wait-ForHealth "shared-temporal" 90)) { exit 1 }

        Write-Step "Starting Temporal UI..."
        docker-compose up -d temporal-ui
        Start-Sleep -Seconds 10

        Pop-Location

        # Initialize Temporal namespaces
        Write-Step "Initializing Temporal namespaces..."
        docker exec shared-temporal tctl --namespace arc-saas namespace register 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Namespace 'arc-saas' registered"
        } else {
            Write-Warn "Namespace 'arc-saas' may already exist"
        }

        docker exec shared-temporal tctl --namespace enrichment namespace register 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Namespace 'enrichment' registered"
        } else {
            Write-Warn "Namespace 'enrichment' may already exist"
        }

        docker exec shared-temporal tctl --namespace default namespace describe 2>$null

        Write-Success "Temporal infrastructure ready"
    }
}

# ============================================================================
# LEVEL 1: Control Plane Infrastructure
# ============================================================================
if (-not $AppPlaneOnly) {
    Write-Step "========================================="
    Write-Step "LEVEL 1: Control Plane Infrastructure"
    Write-Step "========================================="

    Push-Location "$ROOT\arc-saas"

    Write-Step "Starting PostgreSQL..."
    docker-compose up -d postgres
    if (-not (Wait-ForHealth "arc-saas-postgres" 60)) { exit 1 }

    Write-Step "Starting Redis..."
    docker-compose up -d redis
    if (-not (Wait-ForHealth "arc-saas-redis" 30)) { exit 1 }

    Write-Step "Starting Keycloak..."
    docker-compose up -d keycloak
    if (-not (Wait-ForHealth "arc-saas-keycloak" 120)) { exit 1 }

    Write-Step "Starting MinIO..."
    docker-compose up -d minio
    if (-not (Wait-ForHealth "arc-saas-minio" 30)) { exit 1 }

    Write-Step "Initializing MinIO buckets..."
    docker-compose up -d minio-init
    Start-Sleep -Seconds 10

    Write-Step "Starting Novu infrastructure..."
    docker-compose up -d novu-mongodb novu-redis
    Start-Sleep -Seconds 15

    docker-compose up -d novu-api novu-ws novu-worker novu-web
    Start-Sleep -Seconds 20

    Write-Step "Starting Jaeger tracing..."
    docker-compose up -d jaeger
    Start-Sleep -Seconds 5

    Pop-Location

    Write-Success "Control Plane infrastructure ready"
}

# ============================================================================
# LEVEL 2: Control Plane Services
# ============================================================================
if (-not $AppPlaneOnly) {
    Write-Step "========================================="
    Write-Step "LEVEL 2: Control Plane Services"
    Write-Step "========================================="

    Push-Location "$ROOT\arc-saas"

    Write-Step "Starting Tenant Management Service..."
    docker-compose up -d tenant-management-service
    Start-Sleep -Seconds 20

    # Check if service is responding
    $retries = 12
    $success = $false
    for ($i = 0; $i -lt $retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:14000/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $success = $true
                break
            }
        } catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 5
        }
    }

    if (-not $success) {
        Write-Warn "Tenant Management Service may not be healthy, continuing..."
    } else {
        Write-Success "Tenant Management Service is responding"
    }

    Write-Step "Starting Temporal Worker Service..."
    docker-compose up -d temporal-worker-service
    Start-Sleep -Seconds 15

    Write-Step "Starting Admin App..."
    docker-compose up -d admin-app
    Start-Sleep -Seconds 10

    Write-Step "Starting Customer Portal (legacy)..."
    docker-compose up -d customer-portal 2>$null
    Start-Sleep -Seconds 5

    Pop-Location

    Write-Success "Control Plane services started"
}

# ============================================================================
# LEVEL 3: App Plane Infrastructure
# ============================================================================
if (-not $ControlPlaneOnly) {
    Write-Step "========================================="
    Write-Step "LEVEL 3: App Plane Infrastructure"
    Write-Step "========================================="

    Push-Location "$ROOT\app-plane"

    Write-Step "Starting Supabase PostgreSQL..."
    docker-compose up -d supabase-db
    if (-not (Wait-ForHealth "app-plane-supabase-db" 60)) { exit 1 }

    Write-Step "Starting Components-V2 PostgreSQL..."
    docker-compose up -d components-v2-postgres
    if (-not (Wait-ForHealth "app-plane-components-v2-postgres" 60)) { exit 1 }

    Write-Step "Starting Redis..."
    docker-compose up -d redis
    if (-not (Wait-ForHealth "app-plane-redis" 30)) { exit 1 }

    Write-Step "Starting Redis Exporter..."
    docker-compose up -d redis-exporter
    Start-Sleep -Seconds 5

    Write-Step "Starting RabbitMQ..."
    docker-compose up -d rabbitmq
    if (-not (Wait-ForHealth "app-plane-rabbitmq" 60)) { exit 1 }

    Write-Step "Starting MinIO..."
    docker-compose up -d minio
    if (-not (Wait-ForHealth "app-plane-minio" 30)) { exit 1 }

    Write-Step "Initializing MinIO buckets..."
    docker-compose up -d minio-init
    Start-Sleep -Seconds 10

    Write-Step "Starting Supabase services..."
    docker-compose up -d supabase-meta supabase-api supabase-studio
    Start-Sleep -Seconds 20

    Write-Step "Starting Directus CMS..."
    docker-compose up -d directus
    Start-Sleep -Seconds 15

    Pop-Location

    Write-Success "App Plane infrastructure ready"
}

# ============================================================================
# LEVEL 4: App Plane Services
# ============================================================================
if (-not $ControlPlaneOnly) {
    Write-Step "========================================="
    Write-Step "LEVEL 4: App Plane Services"
    Write-Step "========================================="

    Push-Location "$ROOT\app-plane"

    Write-Step "Starting CNS Service..."
    docker-compose up -d cns-service
    if (-not (Wait-ForHealth "app-plane-cns-service" 60)) { exit 1 }

    Write-Step "Starting CNS Worker..."
    docker-compose up -d cns-worker
    Start-Sleep -Seconds 15

    Write-Step "Starting Django Backend..."
    docker-compose up -d django-backend
    Start-Sleep -Seconds 20

    # Check if Django is responding
    $retries = 8
    $success = $false
    for ($i = 0; $i -lt $retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:27000/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $success = $true
                break
            }
        } catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 5
        }
    }

    if ($success) {
        Write-Success "Django Backend is responding"
    } else {
        Write-Warn "Django Backend may not be healthy, continuing..."
    }

    Write-Step "Starting background workers..."
    docker-compose up -d audit-logger novu-consumer 2>$null
    Start-Sleep -Seconds 10

    Write-Step "Starting Webhook Bridge..."
    docker-compose up -d webhook-bridge 2>$null
    Start-Sleep -Seconds 5

    Write-Step "Starting Middleware API..."
    docker-compose up -d middleware-api 2>$null
    Start-Sleep -Seconds 10

    Pop-Location

    Write-Success "App Plane services started"
}

# ============================================================================
# LEVEL 5: Frontend Applications
# ============================================================================
if (-not $ControlPlaneOnly) {
    Write-Step "========================================="
    Write-Step "LEVEL 5: Frontend Applications"
    Write-Step "========================================="

    Push-Location "$ROOT\app-plane"

    Write-Step "Starting Customer Portal..."
    docker-compose up -d customer-portal
    Start-Sleep -Seconds 10

    Write-Step "Starting CNS Dashboard..."
    docker-compose up -d cns-dashboard
    Start-Sleep -Seconds 10

    Write-Step "Starting Backstage Portal..."
    docker-compose up -d backstage-portal
    Start-Sleep -Seconds 10

    Write-Step "Starting Dashboard..."
    docker-compose up -d dashboard
    Start-Sleep -Seconds 10

    Pop-Location

    Write-Success "Frontend applications started"
}

# ============================================================================
# Final Status Check
# ============================================================================
Write-Step "========================================="
Write-Step "Deployment Complete - Status Check"
Write-Step "========================================="

Start-Sleep -Seconds 10

# List all running containers
Write-Host ""
docker ps --format "table {{.Names}}\t{{.Status}}" | Where-Object { $_ -match "(temporal|postgres|redis|keycloak|tenant|cns|django|customer|admin)" }

Write-Step ""
Write-Success "========================================="
Write-Success "Platform startup complete!"
Write-Success "========================================="
Write-Step ""
Write-Step "Service URLs:"
Write-Step "  Control Plane:"
Write-Step "    - Tenant Management API:  http://localhost:14000"
Write-Step "    - Admin App:              http://localhost:27555"
Write-Step "    - Keycloak:               http://localhost:8180"
Write-Step "    - Temporal UI:            http://localhost:27021"
Write-Step "    - MinIO Console:          http://localhost:9001"
Write-Step "    - Novu Dashboard:         http://localhost:14200"
Write-Step "    - Jaeger UI:              http://localhost:16686"
Write-Step ""
Write-Step "  App Plane:"
Write-Step "    - CNS Service API:        http://localhost:27200"
Write-Step "    - CNS Dashboard:          http://localhost:27250"
Write-Step "    - Customer Portal:        http://localhost:27100"
Write-Step "    - Django Backend:         http://localhost:27000"
Write-Step "    - Supabase Studio:        http://localhost:27800"
Write-Step "    - Supabase API:           http://localhost:27810"
Write-Step "    - MinIO Console:          http://localhost:27041"
Write-Step "    - RabbitMQ Mgmt:          http://localhost:27673"
Write-Step "    - Directus CMS:           http://localhost:27060"
Write-Step ""
Write-Step "Next steps:"
Write-Step "  1. Verify services are healthy: docker ps"
Write-Step "  2. Check logs: docker logs <container>"
Write-Step "  3. Access Temporal UI to verify namespaces: http://localhost:27021"
Write-Step "  4. Test Keycloak: http://localhost:8180 (admin/admin)"
Write-Step ""
Write-Step "To stop all services:"
Write-Step "  .\stop-platform.ps1"
