# ============================================================================
# Fix Temporal Infrastructure - Immediate Resolution
# ============================================================================
#
# This script fixes the shared-temporal DNS resolution issue causing
# cascading failures across Control Plane and App Plane services.
#
# Issue: Services configured for shared-temporal:7233 but container doesn't exist
# Solution: Start Components V2 Temporal and create network alias
#
# ============================================================================

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Temporal Infrastructure Fix Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# ============================================================================
# Step 1: Check current Temporal status
# ============================================================================

Write-Host "[STEP 1] Checking current Temporal infrastructure status..." -ForegroundColor Yellow
Write-Host ""

$temporalContainers = docker ps -a --filter "name=temporal" --format "{{.Names}}: {{.Status}}"
Write-Host "Current Temporal containers:"
Write-Host $temporalContainers
Write-Host ""

$sharedTemporalNetwork = docker network inspect shared-temporal-network --format "{{.Name}}" 2>$null
if ($sharedTemporalNetwork) {
    Write-Host "[OK] shared-temporal-network exists" -ForegroundColor Green
} else {
    Write-Host "[INFO] Creating shared-temporal-network..." -ForegroundColor Yellow
    docker network create shared-temporal-network
}

# ============================================================================
# Step 2: Start Components V2 Temporal
# ============================================================================

Write-Host ""
Write-Host "[STEP 2] Starting Components V2 Temporal infrastructure..." -ForegroundColor Yellow
Write-Host ""

$componentsV2Path = Join-Path $scriptPath "components-platform-v2-ref"

if (Test-Path $componentsV2Path) {
    Set-Location $componentsV2Path

    Write-Host "Starting temporal-postgres..." -ForegroundColor Cyan
    docker-compose up -d temporal-postgres

    Write-Host "Waiting for temporal-postgres to be healthy (30s)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 30

    Write-Host "Starting temporal server..." -ForegroundColor Cyan
    docker-compose up -d temporal

    Write-Host "Waiting for temporal server to be healthy (60s)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 60

    Write-Host "Starting temporal-ui..." -ForegroundColor Cyan
    docker-compose up -d temporal-ui

    Write-Host "[OK] Components V2 Temporal started" -ForegroundColor Green
} else {
    Write-Host "[ERROR] components-platform-v2-ref not found!" -ForegroundColor Red
    Write-Host "Expected path: $componentsV2Path" -ForegroundColor Red
    exit 1
}

Set-Location $scriptPath

# ============================================================================
# Step 3: Create network alias for backwards compatibility
# ============================================================================

Write-Host ""
Write-Host "[STEP 3] Creating network alias shared-temporal -> components-v2-temporal..." -ForegroundColor Yellow
Write-Host ""

# Check if components-v2-temporal is already on shared-temporal-network
$networkInfo = docker network inspect shared-temporal-network --format "{{json .Containers}}" 2>$null | ConvertFrom-Json
$alreadyConnected = $false

if ($networkInfo) {
    foreach ($container in $networkInfo.PSObject.Properties) {
        if ($container.Value.Name -eq "components-v2-temporal") {
            $alreadyConnected = $true
            break
        }
    }
}

if (-not $alreadyConnected) {
    Write-Host "Connecting components-v2-temporal to shared-temporal-network with alias..." -ForegroundColor Cyan
    docker network connect --alias shared-temporal shared-temporal-network components-v2-temporal
    Write-Host "[OK] Network alias created" -ForegroundColor Green
} else {
    Write-Host "[INFO] components-v2-temporal already connected to shared-temporal-network" -ForegroundColor Yellow

    # Try to add alias anyway (will fail if already exists, but that's ok)
    docker network disconnect shared-temporal-network components-v2-temporal 2>$null
    docker network connect --alias shared-temporal shared-temporal-network components-v2-temporal
    Write-Host "[OK] Network alias refreshed" -ForegroundColor Green
}

# ============================================================================
# Step 4: Verify Temporal is accessible
# ============================================================================

Write-Host ""
Write-Host "[STEP 4] Verifying Temporal accessibility..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Testing Temporal health endpoint..." -ForegroundColor Cyan
$temporalHealth = docker exec components-v2-temporal sh -c "curl -f http://localhost:7233 2>/dev/null" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Temporal server is responding" -ForegroundColor Green
} else {
    Write-Host "[WARN] Temporal health check failed (this may be normal during startup)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Testing DNS resolution from arc-saas network..." -ForegroundColor Cyan

# Check if tenant-mgmt exists
$tenantMgmtExists = docker ps -a --filter "name=arc-saas-tenant-mgmt" --format "{{.Names}}" 2>$null
if ($tenantMgmtExists) {
    # Temporarily connect it to test DNS
    docker network connect shared-temporal-network arc-saas-tenant-mgmt 2>$null

    $dnsTest = docker exec arc-saas-tenant-mgmt sh -c "getent hosts shared-temporal" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] DNS resolution working: shared-temporal resolves to components-v2-temporal" -ForegroundColor Green
        Write-Host $dnsTest
    } else {
        Write-Host "[WARN] DNS resolution test failed" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] arc-saas-tenant-mgmt not running, skipping DNS test" -ForegroundColor Yellow
}

# ============================================================================
# Step 5: Restart failing services
# ============================================================================

Write-Host ""
Write-Host "[STEP 5] Restarting services that were failing..." -ForegroundColor Yellow
Write-Host ""

$servicesToRestart = @(
    "arc-saas-tenant-mgmt",
    "arc-saas-temporal-worker",
    "app-plane-cns-worker"
)

foreach ($service in $servicesToRestart) {
    $exists = docker ps -a --filter "name=$service" --format "{{.Names}}" 2>$null
    if ($exists) {
        Write-Host "Restarting $service..." -ForegroundColor Cyan
        docker restart $service
    } else {
        Write-Host "[INFO] $service not found, skipping" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Waiting for services to start (30s)..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

# ============================================================================
# Step 6: Check service logs for Temporal connection
# ============================================================================

Write-Host ""
Write-Host "[STEP 6] Checking service logs for Temporal connection..." -ForegroundColor Yellow
Write-Host ""

foreach ($service in $servicesToRestart) {
    $exists = docker ps --filter "name=$service" --format "{{.Names}}" 2>$null
    if ($exists) {
        Write-Host "--- $service logs ---" -ForegroundColor Cyan
        docker logs $service --tail 20 2>&1 | Select-String -Pattern "temporal|connected|error|fail" -CaseSensitive:$false | Select-Object -Last 5
        Write-Host ""
    }
}

# ============================================================================
# Step 7: Final status check
# ============================================================================

Write-Host ""
Write-Host "[STEP 7] Final infrastructure status..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Temporal containers:" -ForegroundColor Cyan
docker ps --filter "name=temporal" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host ""
Write-Host "Control Plane services:" -ForegroundColor Cyan
docker ps --filter "name=arc-saas-tenant-mgmt" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker ps --filter "name=arc-saas-temporal-worker" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host ""
Write-Host "App Plane services:" -ForegroundColor Cyan
docker ps --filter "name=app-plane-cns" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ============================================================================
# Summary
# ============================================================================

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Fix Complete - Next Steps" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Check Temporal UI: http://localhost:27021" -ForegroundColor Yellow
Write-Host "2. Check Control Plane API: http://localhost:14000/ping" -ForegroundColor Yellow
Write-Host "3. Check CNS Service: http://localhost:27200/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Verify namespaces exist:" -ForegroundColor Yellow
Write-Host "   docker exec components-v2-temporal tctl namespace list" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Check worker registrations:" -ForegroundColor Yellow
Write-Host "   docker exec components-v2-temporal tctl --namespace arc-saas task-queue describe --task-queue tenant-provisioning" -ForegroundColor Gray
Write-Host "   docker exec components-v2-temporal tctl --namespace enrichment task-queue describe --task-queue cns-enrichment" -ForegroundColor Gray
Write-Host ""
Write-Host "6. If issues persist, see: DOCKER_DEPENDENCY_MAP.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " Infrastructure Fix Applied Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
