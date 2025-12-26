#!/usr/bin/env pwsh
# =============================================================================
# ARC SaaS Platform Log Collection Script
# =============================================================================
# Collects logs from all services for troubleshooting
#
# Usage:
#   ./collect-logs.ps1                    # Collect all logs
#   ./collect-logs.ps1 -Lines 100         # Collect last 100 lines
#   ./collect-logs.ps1 -Services cns      # Collect only CNS service logs
#
# =============================================================================

param(
    [int]$Lines = 500,
    [string]$Services = "all"
)

$ErrorActionPreference = "Continue"

function Write-Step { param($msg) Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs_$timestamp"

Write-Step "Creating log directory: $logDir"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# Define service groups
$allServices = @{
    "temporal" = @(
        "shared-temporal-postgres",
        "shared-temporal",
        "shared-temporal-ui"
    )
    "control-plane-infra" = @(
        "arc-saas-postgres",
        "arc-saas-redis",
        "arc-saas-keycloak",
        "arc-saas-minio"
    )
    "control-plane-services" = @(
        "arc-saas-tenant-mgmt",
        "arc-saas-temporal-worker",
        "arc-saas-admin-app",
        "arc-saas-customer-portal"
    )
    "app-plane-infra" = @(
        "app-plane-supabase-db",
        "app-plane-components-v2-postgres",
        "app-plane-redis",
        "app-plane-rabbitmq",
        "app-plane-minio"
    )
    "app-plane-services" = @(
        "app-plane-cns-service",
        "app-plane-cns-worker",
        "app-plane-django-backend",
        "app-plane-audit-logger"
    )
    "app-plane-frontend" = @(
        "app-plane-customer-portal",
        "app-plane-cns-dashboard",
        "app-plane-backstage-portal",
        "app-plane-dashboard"
    )
}

# Select services to collect
$servicesToCollect = @()

if ($Services -eq "all") {
    foreach ($group in $allServices.Values) {
        $servicesToCollect += $group
    }
} elseif ($Services -eq "control-plane") {
    $servicesToCollect += $allServices["control-plane-infra"]
    $servicesToCollect += $allServices["control-plane-services"]
} elseif ($Services -eq "app-plane") {
    $servicesToCollect += $allServices["app-plane-infra"]
    $servicesToCollect += $allServices["app-plane-services"]
    $servicesToCollect += $allServices["app-plane-frontend"]
} elseif ($Services -eq "temporal") {
    $servicesToCollect += $allServices["temporal"]
} elseif ($Services -eq "cns") {
    $servicesToCollect += "app-plane-cns-service"
    $servicesToCollect += "app-plane-cns-worker"
} else {
    # Specific service
    $servicesToCollect += $Services
}

# Collect logs
$collected = 0
$failed = 0

foreach ($service in $servicesToCollect) {
    Write-Step "Collecting logs from $service..."

    try {
        $exists = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$service$"
        if ($exists) {
            $logFile = "$logDir\${service}.log"
            docker logs $service --tail $Lines > $logFile 2>&1

            if ($LASTEXITCODE -eq 0) {
                $fileSize = (Get-Item $logFile).Length
                Write-Success "  Collected $service ($fileSize bytes)"
                $collected++
            } else {
                Write-Host "  Failed to collect logs from $service" -ForegroundColor Red
                $failed++
            }
        } else {
            Write-Host "  Container $service not found, skipping" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Error collecting logs from $service : $_" -ForegroundColor Red
        $failed++
    }
}

# Collect Docker Compose status
Write-Step "Collecting Docker Compose status..."
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" > "$logDir\docker_ps_status.txt" 2>&1

# Collect network information
Write-Step "Collecting network information..."
docker network ls > "$logDir\docker_networks.txt" 2>&1
docker network inspect shared-temporal-network > "$logDir\network_temporal.json" 2>&1
docker network inspect arc-saas > "$logDir\network_arc-saas.json" 2>&1
docker network inspect app-plane > "$logDir\network_app-plane.json" 2>&1

# Collect system info
Write-Step "Collecting system information..."
@"
Docker Version:
$(docker version)

Docker Info:
$(docker info)

Host Information:
$(Get-ComputerInfo | Select-Object CsName, OsName, OsVersion, OsArchitecture | Format-List)

Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@ > "$logDir\system_info.txt"

# Create summary report
Write-Step "Creating summary report..."

$summary = @"
========================================
ARC SaaS Platform Log Collection Report
========================================
Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Log Directory: $logDir

Services Collected: $collected
Failed Collections: $failed

Services Status:
----------------
"@

$allContainers = docker ps -a --filter "name=arc-saas" --filter "name=app-plane" --filter "name=shared-temporal" --format "{{.Names}} | {{.Status}}"
$summary += "`n$allContainers`n"

$summary += @"

Recent Errors:
--------------
"@

$errorContainers = docker ps -a --filter "status=exited" --filter "name=arc-saas" --filter "name=app-plane" --format "{{.Names}}"
if ($errorContainers) {
    foreach ($container in $errorContainers) {
        $exitCode = docker inspect --format='{{.State.ExitCode}}' $container 2>$null
        $summary += "`n  $container (exit code: $exitCode)"
    }
} else {
    $summary += "`n  No containers in exited state"
}

$summary += @"


Log Files:
----------
"@

Get-ChildItem -Path $logDir -Filter "*.log" | ForEach-Object {
    $size = [math]::Round($_.Length / 1KB, 2)
    $summary += "`n  $($_.Name) - ${size}KB"
}

$summary | Out-File -FilePath "$logDir\SUMMARY.txt" -Encoding UTF8

Write-Success ""
Write-Success "========================================="
Write-Success "Log collection complete!"
Write-Success "========================================="
Write-Success "Collected: $collected services"
Write-Success "Failed: $failed services"
Write-Success "Output: $logDir"
Write-Success ""
Write-Success "Files:"
Get-ChildItem -Path $logDir | ForEach-Object {
    Write-Host "  $($_.Name)" -ForegroundColor Cyan
}

Write-Success ""
Write-Success "To view summary:"
Write-Success "  cat $logDir\SUMMARY.txt"
Write-Success ""
Write-Success "To view specific service logs:"
Write-Success "  cat $logDir\<service-name>.log"
