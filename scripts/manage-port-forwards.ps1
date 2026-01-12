# Port-Forward Management Script
# Usage: .\manage-port-forwards.ps1 [start|stop|restart|status]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"
$KUBECTL = "e:\Work\Ananta-Platform-Saas\kubectl.exe"

# Define all port-forwards in one place
$portForwards = @(
    # Traefik Ingress - handles all *.localhost domains via Host header routing
    # Port 9080 avoids conflicts with Rancher Desktop's wslrelay on 8080
    @{
        Name = "traefik-ingress"
        Namespace = "kube-system"
        Service = "traefik"
        LocalPort = 9080
        RemotePort = 80
    },
    # Direct service port-forwards (fallback if Traefik not working)
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

function Stop-AllPortForwards {
    Write-Host "[STOP] Killing all kubectl port-forward processes..." -ForegroundColor Yellow

    # Method 1: Kill by process name
    Get-Process kubectl -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    # Method 2: Kill by port (more surgical)
    foreach ($pf in $portForwards) {
        $port = $pf.LocalPort
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process -and $process.ProcessName -eq "kubectl") {
                Write-Host "  Killing kubectl process $($process.Id) using port $port" -ForegroundColor Gray
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # Wait for ports to be released
    Start-Sleep -Seconds 2
    Write-Host "[OK] All port-forwards stopped" -ForegroundColor Green
}

function Start-AllPortForwards {
    Write-Host "[START] Starting all port-forwards..." -ForegroundColor Yellow

    foreach ($pf in $portForwards) {
        $name = $pf.Name
        $ns = $pf.Namespace
        $svc = $pf.Service
        $local = $pf.LocalPort
        $remote = $pf.RemotePort

        # Check if port is already in use
        $inUse = Get-NetTCPConnection -LocalPort $local -ErrorAction SilentlyContinue
        if ($inUse) {
            Write-Host "  [SKIP] $name - Port $local already in use" -ForegroundColor Yellow
            continue
        }

        # Start port-forward in background
        $cmd = "& `"$KUBECTL`" port-forward -n $ns svc/$svc ${local}:${remote}"
        Start-Job -Name "pf-$name" -ScriptBlock {
            param($cmd)
            Invoke-Expression $cmd
        } -ArgumentList $cmd | Out-Null

        Write-Host "  [OK] $name - Forwarding localhost:$local -> ${ns}/${svc}:${remote}" -ForegroundColor Green
    }

    Start-Sleep -Seconds 2
}

function Show-Status {
    Write-Host "`n=== Port-Forward Status ===" -ForegroundColor Cyan

    foreach ($pf in $portForwards) {
        $name = $pf.Name
        $local = $pf.LocalPort

        $conn = Get-NetTCPConnection -LocalPort $local -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            $status = if ($process.ProcessName -eq "kubectl") { "RUNNING" } else { "CONFLICT ($($process.ProcessName))" }
            $color = if ($status -eq "RUNNING") { "Green" } else { "Red" }
            Write-Host "  [$status] $name - localhost:$local" -ForegroundColor $color
        } else {
            Write-Host "  [STOPPED] $name - localhost:$local" -ForegroundColor Gray
        }
    }

    # Show all kubectl jobs
    $jobs = Get-Job -Name "pf-*" -ErrorAction SilentlyContinue
    if ($jobs) {
        Write-Host "`n=== Background Jobs ===" -ForegroundColor Cyan
        $jobs | Format-Table -Property Name, State, HasMoreData
    }
}

# Main execution
switch ($Action) {
    "stop" {
        Stop-AllPortForwards
    }
    "start" {
        Start-AllPortForwards
        Show-Status
    }
    "restart" {
        Stop-AllPortForwards
        Start-AllPortForwards
        Show-Status
    }
    "status" {
        Show-Status
    }
}
