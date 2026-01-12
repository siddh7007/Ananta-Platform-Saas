# Add Ananta Platform hosts entries for Traefik ingress
# Run as Administrator: powershell -ExecutionPolicy Bypass -File .\scripts\add-hosts-entries.ps1

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$entries = @"

# Ananta Platform - Traefik Ingress
# Access via port 8080 (Traefik port-forward) since LoadBalancer port 80 has Windows conflicts
# Usage: Run .\scripts\manage-port-forwards.ps1 start first
127.0.0.1 cbp.localhost
127.0.0.1 cns.localhost
127.0.0.1 api.localhost
127.0.0.1 admin.localhost
127.0.0.1 keycloak.localhost
127.0.0.1 studio.localhost
127.0.0.1 minio.localhost
127.0.0.1 rabbitmq.localhost
127.0.0.1 dashboard.localhost
"@

# Check if entries already exist
$content = Get-Content $hostsPath -Raw
if ($content -notmatch "cbp\.localhost") {
    Add-Content -Path $hostsPath -Value $entries -Encoding UTF8
    Write-Host "Added Ananta Platform hosts entries" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: Start Traefik port-forward first:" -ForegroundColor Yellow
    Write-Host "  .\scripts\manage-port-forwards.ps1 start" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then access via port 9080:" -ForegroundColor Cyan
    Write-Host "  - http://cbp.localhost:9080       -> Customer Portal"
    Write-Host "  - http://cns.localhost:9080       -> CNS Service"
    Write-Host "  - http://api.localhost:9080       -> Tenant Management API"
    Write-Host "  - http://admin.localhost:9080     -> Admin App"
    Write-Host "  - http://keycloak.localhost:9080  -> Keycloak"
    Write-Host "  - http://studio.localhost:9080    -> Supabase Studio"
    Write-Host "  - http://minio.localhost:9080     -> MinIO Console"
    Write-Host "  - http://rabbitmq.localhost:9080  -> RabbitMQ Management"
    Write-Host ""
    Write-Host "OR use direct ports (no Traefik):" -ForegroundColor Cyan
    Write-Host "  - http://localhost:27100  -> Customer Portal"
    Write-Host "  - http://localhost:27200  -> CNS Service"
    Write-Host "  - http://localhost:14000  -> Tenant Management API"
    Write-Host "  - http://localhost:8180   -> Keycloak"
} else {
    Write-Host "Hosts entries already exist" -ForegroundColor Yellow
}
