# =============================================================================
# Build all Docker images for Ananta Control Plane
# =============================================================================
# Usage: .\build-images.ps1
# Prerequisites: Docker Desktop or Rancher Desktop with Docker runtime
# =============================================================================

$ErrorActionPreference = "Stop"

$ROOT_DIR = (Get-Item $PSScriptRoot).Parent.Parent.Parent.FullName
$SERVICES_DIR = "$ROOT_DIR\arc-saas\services"
$APPS_DIR = "$ROOT_DIR\arc-saas\apps"

Write-Host "=== Building Ananta Control Plane Docker Images ===" -ForegroundColor Cyan
Write-Host "Root directory: $ROOT_DIR"

# Build services
$services = @(
    @{Name="tenant-management-service"; Port=14000},
    @{Name="subscription-service"; Port=3002},
    @{Name="orchestrator-service"; Port=3001},
    @{Name="temporal-worker-service"; Port=$null}
)

foreach ($svc in $services) {
    $name = $svc.Name
    Write-Host ""
    Write-Host "=== Building $name ===" -ForegroundColor Yellow
    $servicePath = "$SERVICES_DIR\$name"

    if (Test-Path "$servicePath\Dockerfile") {
        Push-Location $servicePath
        docker build -t "ananta/$name`:local" .
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to build $name" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Pop-Location
        Write-Host "SUCCESS: Built ananta/$name`:local" -ForegroundColor Green
    } else {
        Write-Host "SKIP: No Dockerfile found for $name" -ForegroundColor Yellow
    }
}

# Build apps
Write-Host ""
Write-Host "=== Building admin-app ===" -ForegroundColor Yellow
$adminAppPath = "$APPS_DIR\admin-app"
if (Test-Path "$adminAppPath\Dockerfile") {
    Push-Location $adminAppPath
    docker build -t "ananta/admin-app:local" .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to build admin-app" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "SUCCESS: Built ananta/admin-app:local" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== All images built successfully ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Built images:"
docker images --filter "reference=ananta/*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
