# =============================================================================
# Network Initialization Script - Ananta Platform Monitoring (PowerShell)
# =============================================================================
# Creates Docker networks required for cross-stack communication between:
# - Control Plane (arc-saas)
# - App Plane (app-plane)
# - Shared Monitoring Stack
#
# Run this BEFORE starting any services for the first time.
# =============================================================================

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Ananta Platform - Network Initialization" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$networks = @(
    @{ Name = "arc-saas"; Description = "Control Plane" },
    @{ Name = "app-plane"; Description = "App Plane" },
    @{ Name = "shared-temporal-network"; Description = "Temporal Workflow Engine" },
    @{ Name = "shared-monitoring"; Description = "Monitoring Stack" }
)

foreach ($network in $networks) {
    $exists = docker network inspect $network.Name 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Network '$($network.Name)' already exists" -ForegroundColor Green
    } else {
        Write-Host "[CREATE] Creating network '$($network.Name)' ($($network.Description))..." -ForegroundColor Yellow
        docker network create $network.Name | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Network '$($network.Name)' created" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Failed to create network '$($network.Name)'" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Network Summary" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

docker network ls --filter "name=arc-saas" --filter "name=app-plane" --filter "name=shared-temporal" --filter "name=shared-monitoring" --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"

Write-Host ""
Write-Host "[DONE] All networks initialized successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Start Control Plane:  cd arc-saas; docker-compose up -d" -ForegroundColor Gray
Write-Host "  2. Start App Plane:      cd app-plane; docker-compose up -d" -ForegroundColor Gray
Write-Host "  3. Start Monitoring:     cd shared-monitoring; docker-compose up -d" -ForegroundColor Gray
Write-Host ""
