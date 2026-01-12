# Integrated Frontend Deployment Script
# Handles: Build -> Docker -> Kubernetes -> Port-Forward Restart
# Usage: .\deploy-frontend.ps1 -Service customer-portal [-SkipBuild] [-SkipDocker] [-SkipPortForward]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("customer-portal", "admin-app", "cns-dashboard")]
    [string]$Service,

    [switch]$SkipBuild,
    [switch]$SkipDocker,
    [switch]$SkipPortForward,
    [switch]$NoBuildCache
)

$ErrorActionPreference = "Stop"

# Configuration
$config = @{
    "customer-portal" = @{
        Path = "arc-saas\apps\customer-portal"
        ImageName = "ananta/customer-portal"
        ImageTag = "local"
        Namespace = "app-plane"
        Deployment = "customer-portal"
        LocalPort = 27100
        RemotePort = 27100
    }
    "admin-app" = @{
        Path = "arc-saas\apps\admin-app"
        ImageName = "ananta/admin-app"
        ImageTag = "local"
        Namespace = "control-plane"
        Deployment = "admin-app"
        LocalPort = 27555
        RemotePort = 80
    }
    "cns-dashboard" = @{
        Path = "app-plane\services\cns-service\dashboard"
        ImageName = "ananta/cns-dashboard"
        ImageTag = "local"
        Namespace = "app-plane"
        Deployment = "cns-dashboard"
        LocalPort = 27250
        RemotePort = 27250
    }
}

$svcConfig = $config[$Service]
$KUBECTL = "e:\Work\Ananta-Platform-Saas\kubectl.exe"
$REPO_ROOT = "e:\Work\Ananta-Platform-Saas"

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

# Step 1: Build Frontend
if (-not $SkipBuild) {
    Write-Step "Step 1: Building $Service"

    Push-Location "$REPO_ROOT\$($svcConfig.Path)"
    try {
        Write-Info "Running: bun run build"
        bun run build

        if (-not (Test-Path "dist")) {
            throw "Build failed - dist/ folder not found"
        }

        Write-Success "Build completed - dist/ folder ready"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Info "Skipping build (using existing dist/)"
}

# Step 2: Build Docker Image
if (-not $SkipDocker) {
    Write-Step "Step 2: Building Docker Image"

    Push-Location "$REPO_ROOT\$($svcConfig.Path)"
    try {
        $imageName = "$($svcConfig.ImageName):$($svcConfig.ImageTag)"
        $buildArgs = @("build", "-t", $imageName, ".")

        if ($NoBuildCache) {
            $buildArgs += "--no-cache"
            Write-Info "Using --no-cache flag"
        }

        Write-Info "Running: docker $($buildArgs -join ' ')"
        & docker @buildArgs

        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed with exit code $LASTEXITCODE"
        }

        Write-Success "Docker image built: $imageName"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Info "Skipping Docker build (using existing image)"
}

# Step 3: Restart Kubernetes Deployment
Write-Step "Step 3: Restarting Kubernetes Deployment"

Write-Info "Running: kubectl rollout restart deployment/$($svcConfig.Deployment) -n $($svcConfig.Namespace)"
& $KUBECTL rollout restart "deployment/$($svcConfig.Deployment)" -n $svcConfig.Namespace

Write-Info "Waiting for rollout to complete..."
& $KUBECTL rollout status "deployment/$($svcConfig.Deployment)" -n $svcConfig.Namespace --timeout=90s

if ($LASTEXITCODE -ne 0) {
    throw "Deployment rollout failed"
}

Write-Success "Deployment restarted successfully"

# Verify new pod is running
$podName = & $KUBECTL get pods -n $svcConfig.Namespace -l "app=$($svcConfig.Deployment)" -o jsonpath='{.items[0].metadata.name}' 2>&1
Write-Success "New pod running: $podName"

# Step 4: Restart Port-Forward (if not skipped)
if (-not $SkipPortForward) {
    Write-Step "Step 4: Restarting Port-Forward"

    $localPort = $svcConfig.LocalPort

    # Kill existing port-forward for this service
    Write-Info "Stopping existing port-forward on port $localPort..."
    $connections = Get-NetTCPConnection -LocalPort $localPort -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq "kubectl") {
            Write-Info "  Killing kubectl process $($process.Id)"
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Start-Sleep -Seconds 2

    # Start new port-forward
    Write-Info "Starting port-forward: localhost:$localPort -> $($svcConfig.Namespace)/$($svcConfig.Deployment):$($svcConfig.RemotePort)"

    $cmd = "& `"$KUBECTL`" port-forward -n $($svcConfig.Namespace) svc/$($svcConfig.Deployment) ${localPort}:$($svcConfig.RemotePort)"
    Start-Job -Name "pf-$Service" -ScriptBlock {
        param($cmd)
        Invoke-Expression $cmd
    } -ArgumentList $cmd | Out-Null

    Start-Sleep -Seconds 2

    # Verify port-forward is listening
    $listening = Get-NetTCPConnection -LocalPort $localPort -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        Write-Success "Port-forward active on localhost:$localPort"
    } else {
        Write-Warning "Port-forward may not be active - check manually"
    }
} else {
    Write-Info "Skipping port-forward restart"
}

# Final Summary
Write-Step "Deployment Complete!"
Write-Host "Service:    $Service" -ForegroundColor White
Write-Host "Image:      $($svcConfig.ImageName):$($svcConfig.ImageTag)" -ForegroundColor White
Write-Host "Namespace:  $($svcConfig.Namespace)" -ForegroundColor White
Write-Host "Deployment: $($svcConfig.Deployment)" -ForegroundColor White
Write-Host "URL:        http://localhost:$($svcConfig.LocalPort)" -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Clear browser cache (Ctrl+Shift+Delete)" -ForegroundColor Gray
Write-Host "  2. Unregister service worker (DevTools -> Application -> Service Workers)" -ForegroundColor Gray
Write-Host "  3. Hard refresh (Ctrl+Shift+R)" -ForegroundColor Gray
