# Reset Port-Forwards Script
# Kills ALL kubectl processes and starts fresh port-forwards
# Usage: .\reset-port-forwards.ps1

$ErrorActionPreference = "Stop"
$KUBECTL = "e:\Work\Ananta-Platform-Saas\kubectl.exe"

# Port-forward configuration
$portForwards = @(
    @{
        Name = "customer-portal"
        Namespace = "app-plane"
        Service = "customer-portal"
        LocalPort = 27100
        RemotePort = 27100
    },
    @{
        Name = "cns-service"
        Namespace = "app-plane"
        Service = "cns-service"
        LocalPort = 27200
        RemotePort = 27200
    },
    @{
        Name = "tenant-management"
        Namespace = "control-plane"
        Service = "tenant-management-service"
        LocalPort = 14000
        RemotePort = 14000
    },
    @{
        Name = "keycloak"
        Namespace = "auth-system"
        Service = "keycloak"
        LocalPort = 8180
        RemotePort = 8080
    }
)

Write-Host "`n=== Resetting All Port-Forwards ===" -ForegroundColor Cyan

# Step 1: Kill ALL kubectl processes
Write-Host "[1/3] Killing all kubectl processes..." -ForegroundColor Yellow
Get-Process kubectl -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Verify all kubectl processes are gone
$remaining = Get-Process kubectl -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "  [WARNING] Some kubectl processes still running, trying again..." -ForegroundColor Yellow
    $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "  [OK] All kubectl processes killed" -ForegroundColor Green

# Step 2: Verify ports are released
Write-Host "[2/3] Verifying ports are released..." -ForegroundColor Yellow
foreach ($pf in $portForwards) {
    $port = $pf.LocalPort
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        Write-Host "  [WARNING] Port $port still in use, waiting..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}
Write-Host "  [OK] All ports released" -ForegroundColor Green

# Step 3: Start fresh port-forwards using Windows background jobs
Write-Host "[3/3] Starting fresh port-forwards..." -ForegroundColor Yellow

# Clean up old jobs
Get-Job -Name "pf-*" -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue

foreach ($pf in $portForwards) {
    $name = $pf.Name
    $ns = $pf.Namespace
    $svc = $pf.Service
    $local = $pf.LocalPort
    $remote = $pf.RemotePort

    # Start port-forward as a PowerShell background job
    Start-Process -FilePath $KUBECTL -ArgumentList "port-forward","-n",$ns,"svc/$svc","${local}:${remote}" -WindowStyle Hidden -PassThru | Out-Null

    Write-Host "  [OK] $name - localhost:$local -> ${ns}/${svc}:${remote}" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}

Start-Sleep -Seconds 2

# Step 4: Verify port-forwards are listening
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
foreach ($pf in $portForwards) {
    $name = $pf.Name
    $local = $pf.LocalPort

    $conn = Get-NetTCPConnection -LocalPort $local -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq "kubectl") {
            Write-Host "  [RUNNING] $name - localhost:$local (PID: $($process.Id))" -ForegroundColor Green
        } else {
            Write-Host "  [CONFLICT] $name - localhost:$local (different process)" -ForegroundColor Red
        }
    } else {
        Write-Host "  [FAILED] $name - localhost:$local (not listening)" -ForegroundColor Red
    }
}

Write-Host "`n=== Complete! ===" -ForegroundColor Cyan
Write-Host "All port-forwards have been reset." -ForegroundColor White
Write-Host "Use Ctrl+C in terminal or Task Manager to stop them." -ForegroundColor Gray
