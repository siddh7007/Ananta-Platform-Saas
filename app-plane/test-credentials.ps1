# Test Credentials for App Plane Services (PowerShell)
# Usage: . .\test-credentials.ps1; Get-CnsToken

# =============================================================================
# Keycloak Configuration
# =============================================================================
$env:KEYCLOAK_URL = "http://localhost:8180"
$env:KEYCLOAK_REALM = "ananta-saas"
$env:KEYCLOAK_CLIENT = "admin-cli"

# =============================================================================
# Test Users (Keycloak ananta-saas realm)
# =============================================================================

# CNS Staff User (super_admin role)
$env:CNS_STAFF_USER = "cnsstaff"
$env:CNS_STAFF_PASS = "Test123!"

# CBP Admin User (owner role)
$env:CBP_ADMIN_USER = "cbpadmin"
$env:CBP_ADMIN_PASS = "Test123!"

# =============================================================================
# Service URLs
# =============================================================================
$env:CNS_API_URL = "http://localhost:27200"
$env:CNS_DASHBOARD_URL = "http://localhost:27250"
$env:CUSTOMER_PORTAL_URL = "http://localhost:27100"
$env:SUPABASE_API_URL = "http://localhost:27810"

# =============================================================================
# Test IDs (for reference)
# =============================================================================
$env:TEST_BOM_ID = "ffaac87c-d3de-4b31-ba1a-839786f0e089"
$env:TEST_ORG_ID = "a0000000-0000-0000-0000-000000000000"
$env:TEST_WORKSPACE_ID = "c13f4caa-fee3-4e9b-805c-a8282bfd59ed"

# =============================================================================
# Functions to get tokens
# =============================================================================

function Get-CnsToken {
    <#
    .SYNOPSIS
    Get JWT token for CNS Staff user
    #>
    $body = @{
        username = $env:CNS_STAFF_USER
        password = $env:CNS_STAFF_PASS
        grant_type = "password"
        client_id = $env:KEYCLOAK_CLIENT
    }

    $response = Invoke-RestMethod -Uri "$($env:KEYCLOAK_URL)/realms/$($env:KEYCLOAK_REALM)/protocol/openid-connect/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body

    return $response.access_token
}

function Get-CbpToken {
    <#
    .SYNOPSIS
    Get JWT token for CBP Admin user
    #>
    $body = @{
        username = $env:CBP_ADMIN_USER
        password = $env:CBP_ADMIN_PASS
        grant_type = "password"
        client_id = $env:KEYCLOAK_CLIENT
    }

    $response = Invoke-RestMethod -Uri "$($env:KEYCLOAK_URL)/realms/$($env:KEYCLOAK_REALM)/protocol/openid-connect/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body

    return $response.access_token
}

function Refresh-Token {
    <#
    .SYNOPSIS
    Refresh TOKEN environment variable with fresh JWT
    #>
    $env:TOKEN = Get-CnsToken
    Write-Host "TOKEN refreshed (expires in ~1 hour)" -ForegroundColor Green
    Write-Host "Use `$env:TOKEN in API calls" -ForegroundColor Cyan
}

function Test-CnsHealth {
    <#
    .SYNOPSIS
    Quick health check for CNS service
    #>
    Invoke-RestMethod -Uri "$($env:CNS_API_URL)/health"
}

function Get-BomStatus {
    param(
        [string]$BomId = $env:TEST_BOM_ID
    )
    <#
    .SYNOPSIS
    Get BOM enrichment status
    #>
    if (-not $env:TOKEN) {
        Refresh-Token
    }

    $headers = @{
        Authorization = "Bearer $($env:TOKEN)"
    }

    Invoke-RestMethod -Uri "$($env:CNS_API_URL)/api/boms/$BomId/enrichment/status" -Headers $headers
}

# =============================================================================
# Usage Info
# =============================================================================
Write-Host ""
Write-Host "=== Test Credentials Loaded ===" -ForegroundColor Green
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Yellow
Write-Host "  Refresh-Token      - Get fresh JWT token (sets `$env:TOKEN)"
Write-Host "  Get-CnsToken       - Get CNS staff JWT token"
Write-Host "  Get-CbpToken       - Get CBP admin JWT token"
Write-Host "  Test-CnsHealth     - Check CNS service health"
Write-Host "  Get-BomStatus      - Get BOM enrichment status"
Write-Host ""
Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "  `$env:CNS_API_URL       = $($env:CNS_API_URL)"
Write-Host "  `$env:TEST_BOM_ID       = $($env:TEST_BOM_ID)"
Write-Host "  `$env:CNS_STAFF_USER    = $($env:CNS_STAFF_USER)"
Write-Host ""
