# Deploy CNS Service Script
# Automated deployment pipeline for CNS service to local Kubernetes (Rancher Desktop)
# Usage: .\scripts\deploy-cns-service.ps1

param(
    [switch]$NoBuildCache,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$KUBECTL = "e:\Work\Ananta-Platform-Saas\kubectl.exe"

Write-Host "`n=== CNS Service Deployment Pipeline ===" -ForegroundColor Cyan

# Step 1: Build Docker image (if not skipped)
if (-not $SkipBuild) {
    Write-Host "[1/3] Building Docker image..." -ForegroundColor Yellow

    Push-Location app-plane\services\cns-service

    try {
        if ($NoBuildCache) {
            Write-Host "  Building without cache (fresh build)..." -ForegroundColor Gray
            docker build --no-cache -t ananta/cns-service:local . 2>&1 | Out-Host
        } else {
            docker build -t ananta/cns-service:local . 2>&1 | Out-Host
        }

        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed with exit code $LASTEXITCODE"
        }

        Write-Host "  [OK] Docker image built: ananta/cns-service:local" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "[1/3] Skipping Docker build (using existing image)" -ForegroundColor Gray
}

# Step 2: Restart Kubernetes deployment
Write-Host "[2/3] Restarting Kubernetes deployment..." -ForegroundColor Yellow

# Add annotation to force restart with new image
& $KUBECTL annotate deployment cns-service -n app-plane kubectl.kubernetes.io/restartedAt="$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')" --overwrite | Out-Host

if ($LASTEXITCODE -ne 0) {
    throw "Failed to annotate deployment"
}

# Wait for rollout to complete
Write-Host "  Waiting for rollout to complete..." -ForegroundColor Gray
& $KUBECTL rollout status deployment/cns-service -n app-plane --timeout=120s | Out-Host

if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARNING] Rollout status check failed, checking pod status..." -ForegroundColor Yellow
    & $KUBECTL get pods -n app-plane -l app.kubernetes.io/name=cns-service
} else {
    Write-Host "  [OK] Deployment restarted successfully" -ForegroundColor Green
}

# Step 3: Verify new pod is running
Write-Host "[3/3] Verifying deployment..." -ForegroundColor Yellow

$pod = & $KUBECTL get pods -n app-plane -l app.kubernetes.io/name=cns-service -o jsonpath='{.items[0].metadata.name}' 2>&1
if ($LASTEXITCODE -eq 0 -and $pod) {
    Write-Host "  New pod: $pod" -ForegroundColor Gray

    # Check pod status
    $podStatus = & $KUBECTL get pod $pod -n app-plane -o jsonpath='{.status.phase}' 2>&1

    if ($podStatus -eq "Running") {
        Write-Host "  [OK] Pod is running" -ForegroundColor Green

        # Show last 20 log lines
        Write-Host "  Recent logs:" -ForegroundColor Gray
        & $KUBECTL logs $pod -n app-plane --tail=20 | Out-Host
    } else {
        Write-Host "  [WARNING] Pod status: $podStatus" -ForegroundColor Yellow
        & $KUBECTL describe pod $pod -n app-plane | Select-String -Pattern "Events:" -Context 0,10
    }
} else {
    Write-Host "  [WARNING] Could not find new pod" -ForegroundColor Yellow
}

Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Test CNS API: curl http://localhost:27200/health" -ForegroundColor Gray
Write-Host "  2. Check rate limit: should be 2000 req/min for authenticated requests" -ForegroundColor Gray
Write-Host "  3. Monitor BOM uploads for 429 errors (should be gone)" -ForegroundColor Gray
