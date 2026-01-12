# Start Traefik Ingress Port-Forward
# This script port-forwards the Traefik Ingress Controller to port 8888
# allowing access to all services via .localhost hostnames
#
# Usage: .\scripts\start-traefik-ingress.ps1
#
# Services accessible at:
#   http://cbp.localhost:8888        - Customer Portal (Frontend)
#   http://cns.localhost:8888        - CNS Service API
#   http://dashboard.localhost:8888  - CNS Dashboard
#   http://keycloak.localhost:8888   - Keycloak (Auth)
#   http://api.localhost:8888        - Control Plane API
#   http://temporal.localhost:8888   - Temporal UI
#   http://rabbitmq.localhost:8888   - RabbitMQ Management
#   http://minio.localhost:8888      - MinIO Console
#   http://studio.localhost:8888     - Supabase Studio

$KUBECTL = "$PSScriptRoot\..\kubectl.exe"

Write-Host "Starting Traefik Ingress port-forward on port 8888..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Services will be available at:" -ForegroundColor Green
Write-Host "  Customer Portal:    http://cbp.localhost:8888" -ForegroundColor White
Write-Host "  CNS Service API:    http://cns.localhost:8888" -ForegroundColor White
Write-Host "  CNS Dashboard:      http://dashboard.localhost:8888" -ForegroundColor White
Write-Host "  Keycloak:           http://keycloak.localhost:8888" -ForegroundColor White
Write-Host "  Control Plane API:  http://api.localhost:8888" -ForegroundColor White
Write-Host "  Temporal UI:        http://temporal.localhost:8888" -ForegroundColor White
Write-Host "  RabbitMQ:           http://rabbitmq.localhost:8888" -ForegroundColor White
Write-Host "  MinIO Console:      http://minio.localhost:8888" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start port-forward
& $KUBECTL port-forward -n kube-system svc/traefik 8888:80 --address=0.0.0.0
