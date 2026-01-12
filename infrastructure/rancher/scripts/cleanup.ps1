# =============================================================================
# Cleanup Ananta Control Plane from Kubernetes
# =============================================================================
# Usage: .\cleanup.ps1
# =============================================================================

$ErrorActionPreference = "Continue"

Write-Host "=== Cleaning up Ananta Control Plane ===" -ForegroundColor Cyan

# Stop port forwarding
Write-Host "Stopping port forwarding..." -ForegroundColor Yellow
Get-Process kubectl -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Delete deployments
Write-Host "Deleting control plane services..." -ForegroundColor Yellow
kubectl delete -f "$PSScriptRoot\..\manifests\temporal-worker-service.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\..\manifests\orchestrator-service.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\..\manifests\subscription-service.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\..\manifests\admin-app.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\..\manifests\control-plane.yaml" --ignore-not-found

Write-Host "Deleting infrastructure..." -ForegroundColor Yellow
kubectl delete -f "$PSScriptRoot\..\manifests\temporal.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\..\manifests\keycloak.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\..\manifests\redis.yaml" --ignore-not-found
kubectl delete -f "$PSScriptRoot\..\manifests\postgresql.yaml" --ignore-not-found

Write-Host ""
Write-Host "=== Cleanup Complete ===" -ForegroundColor Cyan

# Show remaining pods
Write-Host ""
Write-Host "Remaining pods:"
kubectl get pods -A | Select-String -Pattern "ananta|control-plane|auth-system|temporal-system|database-system|cache-system"
