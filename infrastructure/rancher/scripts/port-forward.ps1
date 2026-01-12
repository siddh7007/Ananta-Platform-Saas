# =============================================================================
# Port Forwarding for Ananta Control Plane
# =============================================================================
# Usage: .\port-forward.ps1
# This will start port forwarding in background jobs
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "=== Starting Port Forwarding ===" -ForegroundColor Cyan
Write-Host ""

# Define services and their ports
$services = @(
    @{Name="Admin App"; Namespace="control-plane"; Service="admin-app"; LocalPort=3000; RemotePort=80},
    @{Name="Tenant Management API"; Namespace="control-plane"; Service="tenant-management-service"; LocalPort=14000; RemotePort=14000},
    @{Name="Subscription Service"; Namespace="control-plane"; Service="subscription-service"; LocalPort=3002; RemotePort=3002},
    @{Name="Orchestrator Service"; Namespace="control-plane"; Service="orchestrator-service"; LocalPort=3001; RemotePort=3001},
    @{Name="Keycloak"; Namespace="auth-system"; Service="keycloak"; LocalPort=8180; RemotePort=8080},
    @{Name="Temporal UI"; Namespace="temporal-system"; Service="temporal-ui"; LocalPort=27021; RemotePort=8080},
    @{Name="PostgreSQL"; Namespace="database-system"; Service="postgresql"; LocalPort=5432; RemotePort=5432},
    @{Name="Redis"; Namespace="cache-system"; Service="redis"; LocalPort=6379; RemotePort=6379}
)

Write-Host "Starting port forwarding for services:" -ForegroundColor Yellow
foreach ($svc in $services) {
    Write-Host "  - $($svc.Name): localhost:$($svc.LocalPort)" -ForegroundColor White
}
Write-Host ""

# Start port forwarding
foreach ($svc in $services) {
    $cmd = "kubectl port-forward svc/$($svc.Service) -n $($svc.Namespace) $($svc.LocalPort):$($svc.RemotePort)"
    Write-Host "Starting: $($svc.Name)..." -ForegroundColor Gray
    Start-Process -WindowStyle Hidden -FilePath "kubectl" -ArgumentList "port-forward", "svc/$($svc.Service)", "-n", $svc.Namespace, "$($svc.LocalPort):$($svc.RemotePort)"
}

Write-Host ""
Write-Host "=== Port Forwarding Started ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access your services at:"
Write-Host "  - Admin App:           http://localhost:3000" -ForegroundColor Green
Write-Host "  - Tenant Management:   http://localhost:14000" -ForegroundColor Green
Write-Host "  - Subscription Service: http://localhost:3002" -ForegroundColor Green
Write-Host "  - Orchestrator Service: http://localhost:3001" -ForegroundColor Green
Write-Host "  - Keycloak:            http://localhost:8180" -ForegroundColor Green
Write-Host "  - Temporal UI:         http://localhost:27021" -ForegroundColor Green
Write-Host "  - PostgreSQL:          localhost:5432" -ForegroundColor Green
Write-Host "  - Redis:               localhost:6379" -ForegroundColor Green
Write-Host ""
Write-Host "To stop port forwarding, close this window or run:" -ForegroundColor Yellow
Write-Host "  Get-Process kubectl | Stop-Process"
