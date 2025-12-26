# ARC SaaS Infrastructure Deployment Strategy

## Executive Summary

**Current Problems Identified:**
1. Shared Temporal infrastructure not running (shared-temporal container down)
2. Services starting before dependencies are healthy (cns-worker restarting, temporal-worker exited)
3. Missing network connectivity between Control Plane and App Plane services
4. No orchestrated startup sequence - services start in random order
5. Temporal worker services failing with DNS errors ("shared-temporal" not found)

**Root Cause:**
The shared Temporal infrastructure (`app-plane/temporal/docker-compose.yml`) is not being started before dependent services. Both Control Plane and App Plane services reference `shared-temporal:7233` but the container doesn't exist.

---

## Architecture Overview

### Three-Layer Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                  SHARED INFRASTRUCTURE                       │
│  - Shared Temporal (27020, 27021)                           │
│  - Temporal PostgreSQL (27030)                              │
│  - Network: shared-temporal-network                         │
└─────────────────────────────────────────────────────────────┘
         ▲                                   ▲
         │                                   │
         │                                   │
┌────────┴──────────┐              ┌────────┴──────────┐
│  CONTROL PLANE    │◄─────────────►│   APP PLANE       │
│  (arc-saas)       │               │   (app-plane)     │
│                   │               │                   │
│  - PostgreSQL     │               │  - Supabase DB    │
│  - Redis          │               │  - Components-V2  │
│  - Keycloak       │               │  - CNS Service    │
│  - Tenant Mgmt    │               │  - CNS Worker     │
│  - Temporal Worker│               │  - Django Backend │
│  - Admin App      │               │  - Customer Portal│
│                   │               │                   │
│  Network:         │               │  Network:         │
│  arc-saas-network │               │  app-plane-network│
└───────────────────┘               └───────────────────┘
```

### Network Topology

| Network | Purpose | Connected Services |
|---------|---------|-------------------|
| `shared-temporal-network` | Temporal infrastructure | shared-temporal, temporal-postgresql, tenant-management-service, temporal-worker-service, cns-service, cns-worker |
| `arc-saas-network` | Control Plane services | All arc-saas services, shared-temporal-ui |
| `app-plane-network` | App Plane services | All app-plane services |

---

## Dependency Chain Analysis

### Level 0: Base Infrastructure (Start First)
These have NO dependencies and MUST be healthy before anything else:

#### Shared Temporal Infrastructure
```bash
# File: app-plane/temporal/docker-compose.yml
- temporal-postgresql (27030)
  └── Healthcheck: pg_isready -U temporal
- shared-temporal (27020)
  └── Depends: temporal-postgresql (healthy)
  └── Healthcheck: temporal workflow list --namespace default
- shared-temporal-ui (27021)
  └── Depends: shared-temporal (healthy)
```

**CRITICAL:** This MUST start before Control Plane and App Plane.

---

### Level 1: Control Plane Infrastructure

```bash
# File: arc-saas/docker-compose.yml
- arc-saas-postgres (5432)
  └── Healthcheck: pg_isready -U postgres
- arc-saas-redis (6379)
  └── Healthcheck: redis-cli ping
- arc-saas-keycloak (8180)
  └── Depends: postgres (healthy)
  └── Healthcheck: HTTP /health/ready
- arc-saas-minio (9000, 9001)
  └── Healthcheck: mc ready local
```

---

### Level 2: Control Plane Services

```bash
- arc-saas-tenant-mgmt (14000)
  └── Depends: postgres (healthy), redis (healthy), shared-temporal (EXTERNAL)
  └── Missing: Healthcheck, depends_on for keycloak

- arc-saas-temporal-worker (no HTTP)
  └── Depends: postgres (healthy), minio (healthy), shared-temporal (EXTERNAL)
  └── Missing: Healthcheck
```

**ISSUE:** tenant-management-service and temporal-worker-service reference `shared-temporal:7233` but don't have explicit dependency on it because it's in a separate compose file.

---

### Level 3: App Plane Infrastructure

```bash
# File: app-plane/docker-compose.yml
- app-plane-supabase-db (27432)
  └── Healthcheck: pg_isready -U postgres
- app-plane-components-v2-postgres (27010)
  └── Healthcheck: pg_isready -U postgres -d components_v2
- app-plane-redis (27012)
  └── Healthcheck: redis-cli ping
- app-plane-rabbitmq (27672, 27673)
  └── Healthcheck: rabbitmq-diagnostics ping
- app-plane-minio (27040, 27041)
  └── Healthcheck: curl -f http://localhost:9000/minio/health/live
```

---

### Level 4: App Plane Services

```bash
- app-plane-cns-service (27200)
  └── Depends: supabase-db, components-v2-postgres, redis, minio, rabbitmq (all healthy)
  └── Healthcheck: curl -f http://localhost:8000/health

- app-plane-cns-worker (no HTTP)
  └── Depends: supabase-db, components-v2-postgres, redis, shared-temporal (EXTERNAL)
  └── Missing: Healthcheck, explicit shared-temporal dependency

- app-plane-django-backend (27000)
  └── Depends: supabase-db, redis, minio (all healthy)
  └── Missing: Healthcheck
```

**ISSUE:** cns-worker references `shared-temporal:7233` but has no explicit dependency.

---

### Level 5: Frontend Applications

```bash
# Control Plane
- arc-saas-admin-app (27555)
  └── Depends: tenant-management-service
  └── Missing: Healthcheck

# App Plane
- app-plane-customer-portal (27100)
  └── Depends: django-backend
  └── Missing: Healthcheck
```

---

## Issues Identified

### Critical Issues

| Issue | Impact | Services Affected |
|-------|--------|-------------------|
| **Shared Temporal not started** | Workers fail with DNS errors | temporal-worker-service, cns-worker |
| **Missing explicit Temporal dependency** | Services start before Temporal ready | tenant-management-service, cns-service |
| **No healthchecks on key services** | Dependent services fail on startup | tenant-management-service, django-backend |
| **No startup orchestration** | Random startup order causes failures | All services |

### Missing Health Checks

| Service | Port | Recommended Healthcheck |
|---------|------|------------------------|
| tenant-management-service | 14000 | `curl -f http://localhost:14000/health` |
| temporal-worker-service | N/A | `pgrep -f temporal-worker` (process check) |
| django-backend | 8000 | `curl -f http://localhost:8000/health` |
| cns-worker | N/A | `pgrep -f bom_worker` (process check) |
| admin-app | 80 | `wget -q -O /dev/null http://localhost:80/` |
| customer-portal | 80 | `wget -q -O /dev/null http://localhost:80/` |

### Network Configuration Issues

| Issue | Current State | Required Fix |
|-------|--------------|--------------|
| Temporal network isolation | shared-temporal only in shared-temporal-network | Add arc-saas-network and app-plane-network |
| Keycloak access from App Plane | Not in shared network | Add arc-saas-network to App Plane services |
| Cross-plane communication | Services can't discover each other | Ensure network overlap |

---

## Bulletproof Deployment Strategy

### Strategy 1: Master Startup Script (Recommended)

Create a unified startup script that orchestrates all services in correct order with health verification.

**File:** `e:\Work\Ananta-Platform-Saas\start-platform.ps1`

```powershell
#!/usr/bin/env pwsh
# ARC SaaS Platform Startup Script
# Starts all infrastructure in correct dependency order

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
        docker exec shared-temporal tctl --namespace enrichment namespace register 2>$null
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

    Write-Step "Starting background workers..."
    docker-compose up -d audit-logger
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

    Write-Step "Starting CNS Dashboard..."
    docker-compose up -d cns-dashboard

    Write-Step "Starting Backstage Portal..."
    docker-compose up -d backstage-portal

    Write-Step "Starting Dashboard..."
    docker-compose up -d dashboard

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
docker ps --format "table {{.Names}}\t{{.Status}}" | Where-Object { $_ -match "(temporal|postgres|redis|keycloak|tenant|cns|django)" }

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
Write-Step ""
Write-Step "  App Plane:"
Write-Step "    - CNS Service API:        http://localhost:27200"
Write-Step "    - CNS Dashboard:          http://localhost:27250"
Write-Step "    - Customer Portal:        http://localhost:27100"
Write-Step "    - Django Backend:         http://localhost:27000"
Write-Step "    - Supabase Studio:        http://localhost:27800"
Write-Step ""
Write-Step "Next steps:"
Write-Step "  1. Verify services are healthy: docker ps"
Write-Step "  2. Check logs: docker logs <container>"
Write-Step "  3. Access Temporal UI to verify namespaces: http://localhost:27021"
```

---

### Strategy 2: Docker Compose Enhancements

Update each docker-compose file with proper health checks and dependencies.

#### File: `arc-saas/docker-compose.yml` Changes

```yaml
services:
  # Add healthcheck to tenant-management-service
  tenant-management-service:
    # ... existing config ...
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      keycloak:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:14000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - arc-saas-network
      - shared-temporal-network

  # Add healthcheck to temporal-worker-service
  temporal-worker-service:
    # ... existing config ...
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "pgrep", "-f", "temporal-worker"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
    restart: unless-stopped
    networks:
      - arc-saas-network
      - shared-temporal-network

  # Add healthcheck to admin-app
  admin-app:
    # ... existing config ...
    depends_on:
      tenant-management-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
```

#### File: `app-plane/docker-compose.yml` Changes

```yaml
services:
  # Add healthcheck to django-backend
  django-backend:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 45s

  # Fix cns-worker dependencies
  cns-worker:
    # ... existing config ...
    depends_on:
      supabase-db:
        condition: service_healthy
      components-v2-postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      cns-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "pgrep", "-f", "bom_worker"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
    restart: unless-stopped

  # Add healthcheck to customer-portal
  customer-portal:
    # ... existing config ...
    depends_on:
      django-backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:27100/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

---

### Strategy 3: Shared Temporal Network Fix

The shared Temporal server needs to be on BOTH networks to be discoverable.

#### File: `app-plane/temporal/docker-compose.yml` Changes

```yaml
services:
  temporal:
    # ... existing config ...
    networks:
      - shared-temporal-network
      - arc-saas-network
      - app-plane-network  # ADD THIS

  temporal-ui:
    # ... existing config ...
    networks:
      - shared-temporal-network
      - arc-saas-network
      - app-plane-network  # ADD THIS

networks:
  shared-temporal-network:
    driver: bridge
    name: shared-temporal-network
  arc-saas-network:
    external: true
    name: arc-saas
  app-plane-network:  # ADD THIS
    external: true
    name: app-plane
```

---

## Recommended Implementation Plan

### Phase 1: Immediate Fix (5 minutes)

1. **Start shared Temporal infrastructure:**
   ```powershell
   cd e:\Work\Ananta-Platform-Saas\app-plane\temporal
   docker-compose up -d
   docker logs shared-temporal --tail 50
   ```

2. **Restart failed services:**
   ```powershell
   docker restart arc-saas-temporal-worker
   docker restart app-plane-cns-worker
   docker logs arc-saas-temporal-worker --tail 50
   docker logs app-plane-cns-worker --tail 50
   ```

3. **Verify connectivity:**
   ```powershell
   docker exec arc-saas-temporal-worker ping -c 3 shared-temporal
   docker exec app-plane-cns-worker ping -c 3 shared-temporal
   ```

### Phase 2: Create Startup Script (30 minutes)

1. **Save the PowerShell script** to `e:\Work\Ananta-Platform-Saas\start-platform.ps1`

2. **Test the script:**
   ```powershell
   # Clean start
   ./start-platform.ps1 -Clean

   # Start only Control Plane
   ./start-platform.ps1 -ControlPlaneOnly

   # Start only App Plane (assumes Temporal already running)
   ./start-platform.ps1 -AppPlaneOnly
   ```

### Phase 3: Docker Compose Enhancements (1 hour)

1. **Apply health check changes** to:
   - `arc-saas/docker-compose.yml`
   - `app-plane/docker-compose.yml`

2. **Update Temporal network configuration**:
   - `app-plane/temporal/docker-compose.yml`

3. **Test with clean restart:**
   ```powershell
   ./start-platform.ps1 -Clean
   ```

### Phase 4: Create Stop Script (15 minutes)

**File:** `e:\Work\Ananta-Platform-Saas\stop-platform.ps1`

```powershell
#!/usr/bin/env pwsh
# ARC SaaS Platform Shutdown Script

$ErrorActionPreference = "Stop"
$ROOT = "e:\Work\Ananta-Platform-Saas"

Write-Host "[STEP] Stopping Control Plane services..." -ForegroundColor Cyan
Push-Location "$ROOT\arc-saas"
docker-compose down
Pop-Location

Write-Host "[STEP] Stopping App Plane services..." -ForegroundColor Cyan
Push-Location "$ROOT\app-plane"
docker-compose down
Pop-Location

Write-Host "[STEP] Stopping Shared Temporal..." -ForegroundColor Cyan
Push-Location "$ROOT\app-plane\temporal"
docker-compose down
Pop-Location

Write-Host "[OK] All services stopped" -ForegroundColor Green
```

---

## Testing & Validation

### Startup Sequence Test

```powershell
# 1. Clean shutdown
./stop-platform.ps1

# 2. Clean startup
./start-platform.ps1 -Clean

# 3. Verify all services healthy
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "(healthy|Up)"

# 4. Check critical endpoints
Invoke-WebRequest -Uri "http://localhost:27021" # Temporal UI
Invoke-WebRequest -Uri "http://localhost:14000/health" # Tenant Mgmt
Invoke-WebRequest -Uri "http://localhost:27200/health" # CNS Service
```

### Health Check Verification

```powershell
# List all containers with health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check specific service health
docker inspect --format='{{.State.Health.Status}}' shared-temporal
docker inspect --format='{{.State.Health.Status}}' arc-saas-tenant-mgmt
docker inspect --format='{{.State.Health.Status}}' app-plane-cns-service

# View health check logs
docker inspect --format='{{json .State.Health}}' shared-temporal | jq
```

### Network Connectivity Test

```powershell
# Test Temporal connectivity from Control Plane
docker exec arc-saas-temporal-worker ping -c 3 shared-temporal
docker exec arc-saas-temporal-worker nc -zv shared-temporal 7233

# Test Temporal connectivity from App Plane
docker exec app-plane-cns-worker ping -c 3 shared-temporal
docker exec app-plane-cns-worker nc -zv shared-temporal 7233

# Test Keycloak connectivity from App Plane
docker exec app-plane-cns-service ping -c 3 arc-saas-keycloak
docker exec app-plane-cns-service nc -zv arc-saas-keycloak 8080
```

---

## Monitoring & Troubleshooting

### Service Status Dashboard

```powershell
# Create a monitoring script: monitor-platform.ps1
while ($true) {
    Clear-Host
    Write-Host "=== ARC SaaS Platform Status ===" -ForegroundColor Cyan
    Write-Host ""

    # Shared Infrastructure
    Write-Host "Shared Infrastructure:" -ForegroundColor Yellow
    docker ps --filter "name=shared-temporal" --format "  {{.Names}}: {{.Status}}"
    Write-Host ""

    # Control Plane
    Write-Host "Control Plane:" -ForegroundColor Yellow
    docker ps --filter "name=arc-saas" --format "  {{.Names}}: {{.Status}}"
    Write-Host ""

    # App Plane
    Write-Host "App Plane:" -ForegroundColor Yellow
    docker ps --filter "name=app-plane" --format "  {{.Names}}: {{.Status}}"
    Write-Host ""

    Write-Host "Press Ctrl+C to exit" -ForegroundColor Gray
    Start-Sleep -Seconds 10
}
```

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Temporal worker DNS error** | `"shared-temporal" not found` | Start Temporal infrastructure first: `cd app-plane/temporal && docker-compose up -d` |
| **Service starts before DB ready** | Connection refused errors | Add `depends_on` with `condition: service_healthy` |
| **Keycloak 503 errors** | Admin app login fails | Wait 60s after Keycloak shows healthy, check logs |
| **CNS worker crash loop** | Restarting every 30s | Check Temporal connectivity: `docker logs app-plane-cns-worker` |
| **Port conflicts** | Address already in use | Kill stale processes: `taskkill /F /IM node.exe` |

### Log Aggregation

```powershell
# Create log collection script: collect-logs.ps1
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs_$timestamp"

New-Item -ItemType Directory -Path $logDir

# Collect logs from all critical services
$services = @(
    "shared-temporal",
    "arc-saas-tenant-mgmt",
    "arc-saas-temporal-worker",
    "app-plane-cns-service",
    "app-plane-cns-worker",
    "app-plane-django-backend"
)

foreach ($service in $services) {
    Write-Host "Collecting logs from $service..."
    docker logs $service > "$logDir/${service}.log" 2>&1
}

Write-Host "Logs collected in $logDir"
```

---

## Production Deployment Considerations

### High Availability

1. **Temporal HA:**
   - Use external Temporal Cloud or self-hosted HA cluster
   - Configure multiple Temporal workers for load distribution

2. **Database HA:**
   - Use PostgreSQL replication (master-slave)
   - Implement connection pooling (PgBouncer)

3. **Service HA:**
   - Deploy multiple replicas of stateless services
   - Use load balancer (Traefik/Nginx)

### Performance Optimization

1. **Resource Limits:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2.0'
         memory: 2G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

2. **Caching Strategy:**
   - Redis for session data
   - Application-level caching for API responses
   - CDN for static assets

3. **Database Indexing:**
   - Ensure all foreign keys have indexes
   - Create composite indexes for common queries
   - Regular VACUUM and ANALYZE

### Security Hardening

1. **Network Isolation:**
   - Use separate networks for frontend/backend
   - Implement firewall rules
   - Disable unnecessary ports

2. **Secrets Management:**
   - Use Docker secrets or HashiCorp Vault
   - Rotate JWT secrets regularly
   - Use strong database passwords

3. **TLS/SSL:**
   - Enable HTTPS for all external endpoints
   - Use Let's Encrypt for certificates
   - Enforce TLS for database connections

---

## Conclusion

**Immediate Actions Required:**

1. ✅ Start shared Temporal infrastructure: `cd app-plane/temporal && docker-compose up -d`
2. ✅ Create startup script: `start-platform.ps1`
3. ✅ Add health checks to all services
4. ✅ Fix Temporal network connectivity
5. ✅ Document startup sequence in README

**Success Criteria:**

- All services start in correct order without errors
- Health checks pass for all critical services
- Workers can connect to Temporal server
- Frontend apps can reach backend APIs
- Zero manual intervention required for clean start

**Estimated Time:**
- Immediate fix: 5 minutes
- Full implementation: 2 hours
- Testing & validation: 1 hour
- **Total: ~3 hours**

---

## Files to Create/Modify

### New Files
1. `e:\Work\Ananta-Platform-Saas\start-platform.ps1` (startup script)
2. `e:\Work\Ananta-Platform-Saas\stop-platform.ps1` (shutdown script)
3. `e:\Work\Ananta-Platform-Saas\monitor-platform.ps1` (monitoring script)
4. `e:\Work\Ananta-Platform-Saas\collect-logs.ps1` (log collection)

### Modified Files
1. `e:\Work\Ananta-Platform-Saas\arc-saas\docker-compose.yml` (add health checks)
2. `e:\Work\Ananta-Platform-Saas\app-plane\docker-compose.yml` (add health checks)
3. `e:\Work\Ananta-Platform-Saas\app-plane\temporal\docker-compose.yml` (add networks)

### Documentation Updates
1. `e:\Work\Ananta-Platform-Saas\README.md` (add startup instructions)
2. `e:\Work\Ananta-Platform-Saas\CLAUDE.md` (update deployment section)
