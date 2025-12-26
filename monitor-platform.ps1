#!/usr/bin/env pwsh
# =============================================================================
# ARC SaaS Platform Monitoring Script
# =============================================================================
# Real-time monitoring dashboard for all services
#
# Usage:
#   ./monitor-platform.ps1               # Monitor all services
#   ./monitor-platform.ps1 -Interval 5   # Refresh every 5 seconds
#
# =============================================================================

param(
    [int]$Interval = 10
)

function Get-ServiceStatus {
    param([string]$Container)

    $exists = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$Container$"
    if (-not $exists) {
        return @{
            Status = "NOT_FOUND"
            Health = "N/A"
            Color = "Gray"
        }
    }

    $status = docker inspect --format='{{.State.Status}}' $Container 2>$null
    $health = docker inspect --format='{{.State.Health.Status}}' $Container 2>$null

    $color = "Gray"
    if ($status -eq "running") {
        if ($health -eq "healthy") {
            $color = "Green"
        } elseif ($health -eq "unhealthy") {
            $color = "Red"
        } elseif ($health -eq "starting") {
            $color = "Yellow"
        } else {
            $color = "Cyan"
        }
    } elseif ($status -eq "exited") {
        $color = "Red"
    } elseif ($status -eq "restarting") {
        $color = "Yellow"
    }

    return @{
        Status = $status
        Health = if ($health) { $health } else { "no_check" }
        Color = $color
    }
}

function Show-Dashboard {
    Clear-Host

    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "     ARC SaaS Platform Status Dashboard" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "Refresh interval: ${Interval}s" -ForegroundColor Gray
    Write-Host "Press Ctrl+C to exit" -ForegroundColor Gray
    Write-Host ""

    # Shared Infrastructure
    Write-Host "SHARED INFRASTRUCTURE" -ForegroundColor Yellow
    Write-Host "---------------------" -ForegroundColor Yellow

    $services = @(
        @{ Name = "shared-temporal-postgres"; Display = "Temporal PostgreSQL" },
        @{ Name = "shared-temporal"; Display = "Temporal Server" },
        @{ Name = "shared-temporal-ui"; Display = "Temporal UI" }
    )

    foreach ($svc in $services) {
        $status = Get-ServiceStatus -Container $svc.Name
        $displayStatus = "$($status.Status)"
        if ($status.Health -ne "N/A" -and $status.Health -ne "no_check") {
            $displayStatus += " ($($status.Health))"
        }
        Write-Host ("  {0,-30} : {1,-20}" -f $svc.Display, $displayStatus) -ForegroundColor $status.Color
    }

    Write-Host ""

    # Control Plane Infrastructure
    Write-Host "CONTROL PLANE - INFRASTRUCTURE" -ForegroundColor Yellow
    Write-Host "------------------------------" -ForegroundColor Yellow

    $services = @(
        @{ Name = "arc-saas-postgres"; Display = "PostgreSQL" },
        @{ Name = "arc-saas-redis"; Display = "Redis" },
        @{ Name = "arc-saas-keycloak"; Display = "Keycloak" },
        @{ Name = "arc-saas-minio"; Display = "MinIO" }
    )

    foreach ($svc in $services) {
        $status = Get-ServiceStatus -Container $svc.Name
        $displayStatus = "$($status.Status)"
        if ($status.Health -ne "N/A" -and $status.Health -ne "no_check") {
            $displayStatus += " ($($status.Health))"
        }
        Write-Host ("  {0,-30} : {1,-20}" -f $svc.Display, $displayStatus) -ForegroundColor $status.Color
    }

    Write-Host ""

    # Control Plane Services
    Write-Host "CONTROL PLANE - SERVICES" -ForegroundColor Yellow
    Write-Host "------------------------" -ForegroundColor Yellow

    $services = @(
        @{ Name = "arc-saas-tenant-mgmt"; Display = "Tenant Management API" },
        @{ Name = "arc-saas-temporal-worker"; Display = "Temporal Worker" },
        @{ Name = "arc-saas-admin-app"; Display = "Admin App (Frontend)" },
        @{ Name = "arc-saas-customer-portal"; Display = "Customer Portal (Legacy)" }
    )

    foreach ($svc in $services) {
        $status = Get-ServiceStatus -Container $svc.Name
        $displayStatus = "$($status.Status)"
        if ($status.Health -ne "N/A" -and $status.Health -ne "no_check") {
            $displayStatus += " ($($status.Health))"
        }
        Write-Host ("  {0,-30} : {1,-20}" -f $svc.Display, $displayStatus) -ForegroundColor $status.Color
    }

    Write-Host ""

    # App Plane Infrastructure
    Write-Host "APP PLANE - INFRASTRUCTURE" -ForegroundColor Yellow
    Write-Host "--------------------------" -ForegroundColor Yellow

    $services = @(
        @{ Name = "app-plane-supabase-db"; Display = "Supabase PostgreSQL" },
        @{ Name = "app-plane-components-v2-postgres"; Display = "Components-V2 PostgreSQL" },
        @{ Name = "app-plane-redis"; Display = "Redis" },
        @{ Name = "app-plane-rabbitmq"; Display = "RabbitMQ" },
        @{ Name = "app-plane-minio"; Display = "MinIO" }
    )

    foreach ($svc in $services) {
        $status = Get-ServiceStatus -Container $svc.Name
        $displayStatus = "$($status.Status)"
        if ($status.Health -ne "N/A" -and $status.Health -ne "no_check") {
            $displayStatus += " ($($status.Health))"
        }
        Write-Host ("  {0,-30} : {1,-20}" -f $svc.Display, $displayStatus) -ForegroundColor $status.Color
    }

    Write-Host ""

    # App Plane Services
    Write-Host "APP PLANE - SERVICES" -ForegroundColor Yellow
    Write-Host "--------------------" -ForegroundColor Yellow

    $services = @(
        @{ Name = "app-plane-cns-service"; Display = "CNS Service (FastAPI)" },
        @{ Name = "app-plane-cns-worker"; Display = "CNS Worker (Temporal)" },
        @{ Name = "app-plane-django-backend"; Display = "Django Backend API" },
        @{ Name = "app-plane-audit-logger"; Display = "Audit Logger Worker" }
    )

    foreach ($svc in $services) {
        $status = Get-ServiceStatus -Container $svc.Name
        $displayStatus = "$($status.Status)"
        if ($status.Health -ne "N/A" -and $status.Health -ne "no_check") {
            $displayStatus += " ($($status.Health))"
        }
        Write-Host ("  {0,-30} : {1,-20}" -f $svc.Display, $displayStatus) -ForegroundColor $status.Color
    }

    Write-Host ""

    # App Plane Frontend
    Write-Host "APP PLANE - FRONTEND" -ForegroundColor Yellow
    Write-Host "--------------------" -ForegroundColor Yellow

    $services = @(
        @{ Name = "app-plane-customer-portal"; Display = "Customer Portal (CBP)" },
        @{ Name = "app-plane-cns-dashboard"; Display = "CNS Dashboard" },
        @{ Name = "app-plane-backstage-portal"; Display = "Backstage Portal" },
        @{ Name = "app-plane-dashboard"; Display = "Dashboard (Next.js)" }
    )

    foreach ($svc in $services) {
        $status = Get-ServiceStatus -Container $svc.Name
        $displayStatus = "$($status.Status)"
        if ($status.Health -ne "N/A" -and $status.Health -ne "no_check") {
            $displayStatus += " ($($status.Health))"
        }
        Write-Host ("  {0,-30} : {1,-20}" -f $svc.Display, $displayStatus) -ForegroundColor $status.Color
    }

    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan

    # Show quick stats
    $allContainers = docker ps -a --filter "name=arc-saas" --filter "name=app-plane" --filter "name=shared-temporal" --format "{{.Names}}"
    $runningCount = ($allContainers | ForEach-Object {
        $status = docker inspect --format='{{.State.Status}}' $_ 2>$null
        if ($status -eq "running") { 1 }
    } | Measure-Object -Sum).Sum

    $healthyCount = ($allContainers | ForEach-Object {
        $health = docker inspect --format='{{.State.Health.Status}}' $_ 2>$null
        if ($health -eq "healthy") { 1 }
    } | Measure-Object -Sum).Sum

    $totalCount = ($allContainers | Measure-Object).Count

    Write-Host "Total Containers: $totalCount | Running: $runningCount | Healthy: $healthyCount" -ForegroundColor Cyan
    Write-Host ""

    # Show recent errors
    Write-Host "RECENT ERRORS (last 5 minutes)" -ForegroundColor Red
    Write-Host "------------------------------" -ForegroundColor Red

    $errorContainers = docker ps -a --filter "status=exited" --filter "name=arc-saas" --filter "name=app-plane" --format "{{.Names}}"
    if ($errorContainers) {
        foreach ($container in $errorContainers) {
            Write-Host "  $container - EXITED" -ForegroundColor Red
        }
    } else {
        Write-Host "  No recent errors" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Last updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
}

# Main monitoring loop
while ($true) {
    Show-Dashboard
    Start-Sleep -Seconds $Interval
}
