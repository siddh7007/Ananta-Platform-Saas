# =============================================================================
# Start Monitoring Stack - Ananta Platform (PowerShell)
# =============================================================================
# Starts the shared monitoring stack (Prometheus, Grafana, AlertManager, Blackbox)
# Ensures all prerequisite networks exist before starting.
#
# Usage:
#   .\start-monitoring.ps1          # Start monitoring
#   .\start-monitoring.ps1 -Down    # Stop monitoring
#   .\start-monitoring.ps1 -Logs    # View logs
# =============================================================================

param(
    [switch]$Down,
    [switch]$Logs,
    [switch]$Status,
    [switch]$Help
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MonitoringDir = Split-Path -Parent $ScriptDir

Set-Location $MonitoringDir

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Ananta Platform - Monitoring Stack" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Handle command line arguments
if ($Help) {
    Write-Host ""
    Write-Host "Usage: .\start-monitoring.ps1 [-Down|-Logs|-Status|-Help]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  (none)    Start the monitoring stack"
    Write-Host "  -Down     Stop the monitoring stack"
    Write-Host "  -Logs     Follow logs from all services"
    Write-Host "  -Status   Show status of all services"
    Write-Host "  -Help     Show this help message"
    exit 0
}

if ($Down) {
    Write-Host "[STOP] Stopping monitoring stack..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "[OK] Monitoring stack stopped" -ForegroundColor Green
    exit 0
}

if ($Logs) {
    docker-compose logs -f
    exit 0
}

if ($Status) {
    docker-compose ps
    exit 0
}

# Step 1: Initialize networks
Write-Host ""
Write-Host "[STEP 1] Checking Docker networks..." -ForegroundColor White
& "$ScriptDir\init-networks.ps1"

# Step 2: Verify prerequisite services are running
Write-Host ""
Write-Host "[STEP 2] Checking prerequisite services..." -ForegroundColor White

# Check if arc-saas is running (optional)
$arcSaasRunning = docker ps --format '{{.Names}}' 2>$null | Select-String "tenant-management-service"
if ($arcSaasRunning) {
    Write-Host "[OK] Control Plane (arc-saas) is running" -ForegroundColor Green
} else {
    Write-Host "[WARN] Control Plane (arc-saas) not detected - some targets may be unreachable" -ForegroundColor Yellow
}

# Check if app-plane is running (optional)
$appPlaneRunning = docker ps --format '{{.Names}}' 2>$null | Select-String "app-plane"
if ($appPlaneRunning) {
    Write-Host "[OK] App Plane services detected" -ForegroundColor Green
} else {
    Write-Host "[WARN] App Plane services not detected - some targets may be unreachable" -ForegroundColor Yellow
}

# Step 3: Start monitoring stack
Write-Host ""
Write-Host "[STEP 3] Starting monitoring stack..." -ForegroundColor White
docker-compose up -d

# Step 4: Wait for services to be healthy
Write-Host ""
Write-Host "[STEP 4] Waiting for services to be healthy..." -ForegroundColor White
Start-Sleep -Seconds 5

# Check health of each service
$services = @("prometheus", "grafana", "alertmanager", "blackbox-exporter")
foreach ($service in $services) {
    $running = docker-compose ps $service 2>$null | Select-String "Up"
    if ($running) {
        Write-Host "[OK] $service is running" -ForegroundColor Green
    } else {
        Write-Host "[WARN] $service may not be healthy" -ForegroundColor Yellow
    }
}

# Final summary
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Monitoring Stack Started Successfully!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor White
Write-Host "  Prometheus:    http://localhost:9090" -ForegroundColor Gray
Write-Host "  Grafana:       http://localhost:3001  (admin/admin123)" -ForegroundColor Gray
Write-Host "  AlertManager:  http://localhost:9093" -ForegroundColor Gray
Write-Host "  Blackbox:      http://localhost:9115" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor White
Write-Host "  View logs:     .\start-monitoring.ps1 -Logs" -ForegroundColor Gray
Write-Host "  Stop stack:    .\start-monitoring.ps1 -Down" -ForegroundColor Gray
Write-Host "  Check status:  .\start-monitoring.ps1 -Status" -ForegroundColor Gray
Write-Host ""
