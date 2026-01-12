# =============================================================================
# Deploy Ananta Control Plane to Rancher/Kubernetes
# =============================================================================
# Usage: .\deploy-all.ps1
# Prerequisites:
#   - kubectl configured for your cluster
#   - Docker images built (run build-images.ps1 first)
# =============================================================================

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = $PSScriptRoot
$MANIFESTS_DIR = "$SCRIPT_DIR\..\manifests"
$MIGRATIONS_DIR = "$SCRIPT_DIR\..\migrations"

Write-Host "=== Deploying Ananta Control Plane ===" -ForegroundColor Cyan

# Step 1: Create namespaces
Write-Host ""
Write-Host "=== Step 1: Creating namespaces ===" -ForegroundColor Yellow
kubectl apply -f "$MANIFESTS_DIR\postgresql.yaml"
kubectl apply -f "$MANIFESTS_DIR\redis.yaml"
kubectl apply -f "$MANIFESTS_DIR\keycloak.yaml"
kubectl apply -f "$MANIFESTS_DIR\temporal.yaml"
kubectl apply -f "$MANIFESTS_DIR\control-plane.yaml"

# Step 2: Wait for PostgreSQL
Write-Host ""
Write-Host "=== Step 2: Waiting for PostgreSQL to be ready ===" -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=120s deployment/postgresql -n database-system

# Step 3: Create ananta database and run migrations
Write-Host ""
Write-Host "=== Step 3: Running database migrations ===" -ForegroundColor Yellow
$podName = kubectl get pod -n database-system -l app=postgresql -o jsonpath="{.items[0].metadata.name}"

# Create database if not exists
kubectl exec -n database-system $podName -- psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='ananta'" | Out-Null
if ($LASTEXITCODE -ne 0) {
    kubectl exec -n database-system $podName -- psql -U postgres -c "CREATE DATABASE ananta;"
}

# Enable uuid-ossp extension
kubectl exec -n database-system $podName -- psql -U postgres -d ananta -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Run migrations
Get-Content "$MIGRATIONS_DIR\combined-migration.sql" | kubectl exec -i -n database-system deployment/postgresql -- psql -U postgres -d ananta

Write-Host "Migrations completed" -ForegroundColor Green

# Step 4: Wait for Keycloak
Write-Host ""
Write-Host "=== Step 4: Waiting for Keycloak to be ready ===" -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=300s deployment/keycloak -n auth-system

# Step 5: Wait for Temporal
Write-Host ""
Write-Host "=== Step 5: Waiting for Temporal to be ready ===" -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=300s deployment/temporal -n temporal-system

# Step 6: Deploy control plane services
Write-Host ""
Write-Host "=== Step 6: Deploying control plane services ===" -ForegroundColor Yellow
kubectl apply -f "$MANIFESTS_DIR\control-plane.yaml"
kubectl apply -f "$MANIFESTS_DIR\admin-app.yaml"
kubectl apply -f "$MANIFESTS_DIR\subscription-service.yaml"
kubectl apply -f "$MANIFESTS_DIR\orchestrator-service.yaml"
kubectl apply -f "$MANIFESTS_DIR\temporal-worker-service.yaml"

# Step 7: Wait for all deployments
Write-Host ""
Write-Host "=== Step 7: Waiting for all services to be ready ===" -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=180s deployment/tenant-management-service -n control-plane
kubectl wait --for=condition=available --timeout=180s deployment/admin-app -n control-plane

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services deployed:"
kubectl get pods -n control-plane
kubectl get pods -n auth-system
kubectl get pods -n temporal-system
kubectl get pods -n database-system
kubectl get pods -n cache-system

Write-Host ""
Write-Host "To set up port forwarding, run:" -ForegroundColor Yellow
Write-Host "  .\port-forward.ps1"
