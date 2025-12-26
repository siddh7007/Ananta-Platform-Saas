# Control Plane Integration Test Script (PowerShell)
# Tests all proxy endpoints with manual verification

param(
    [string]$DashboardUrl = "http://localhost:3000",
    [string]$Token = $env:TOKEN
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Yellow }

if ([string]::IsNullOrEmpty($Token)) {
    Write-Error "ERROR: TOKEN environment variable not set"
    Write-Host ""
    Write-Host "To get a token:"
    Write-Host "1. Login to Keycloak: http://localhost:8180/realms/ananta-saas"
    Write-Host "2. Copy access token from browser DevTools"
    Write-Host "3. Set `$env:TOKEN='<your-token>'"
    Write-Host ""
    exit 1
}

Write-Host "================================================"
Write-Host "Control Plane Integration Test"
Write-Host "================================================"
Write-Host "Dashboard URL: $DashboardUrl"
Write-Host "Token: $($Token.Substring(0, 20))...$($Token.Substring($Token.Length - 20))"
Write-Host ""

# Test counters
$TestsRun = 0
$TestsPassed = 0
$TestsFailed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [string]$Data = "",
        [int]$ExpectedStatus
    )

    $script:TestsRun++

    Write-Info "[TEST $script:TestsRun] $Name"
    Write-Host "  $Method $Path"

    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    }

    try {
        $url = "$DashboardUrl$Path"

        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -UseBasicParsing
        } elseif ($Method -eq "POST") {
            $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $Data -UseBasicParsing
        } elseif ($Method -eq "PATCH") {
            $response = Invoke-WebRequest -Uri $url -Method PATCH -Headers $headers -Body $Data -UseBasicParsing
        } elseif ($Method -eq "DELETE") {
            $response = Invoke-WebRequest -Uri $url -Method DELETE -Headers $headers -UseBasicParsing
        }

        $statusCode = $response.StatusCode
        $body = $response.Content

    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $body = $_.Exception.Message
    }

    if ($statusCode -eq $ExpectedStatus) {
        Write-Success "  ✓ PASS - Status: $statusCode"
        $script:TestsPassed++

        if ($body -and $body.Length -gt 0) {
            $preview = $body.Substring(0, [Math]::Min(200, $body.Length))
            Write-Host "  Response: $preview..."
        }
    } else {
        Write-Error "  ✗ FAIL - Expected: $ExpectedStatus, Got: $statusCode"
        $script:TestsFailed++

        if ($body) {
            Write-Host "  Error: $body"
        }
    }

    Write-Host ""
}

Write-Host "================================================"
Write-Host "Phase 1: Plans Endpoint"
Write-Host "================================================"
Write-Host ""

Test-Endpoint `
    -Name "List plans (authenticated)" `
    -Method "GET" `
    -Path "/api/control-plane/plans" `
    -ExpectedStatus 200

Test-Endpoint `
    -Name "List plans with pagination" `
    -Method "GET" `
    -Path "/api/control-plane/plans?limit=5&amp;skip=0" `
    -ExpectedStatus 200

Write-Host "================================================"
Write-Host "Phase 2: Subscriptions Endpoint"
Write-Host "================================================"
Write-Host ""

Test-Endpoint `
    -Name "List subscriptions" `
    -Method "GET" `
    -Path "/api/control-plane/subscriptions" `
    -ExpectedStatus 200

Test-Endpoint `
    -Name "List subscriptions with filters" `
    -Method "GET" `
    -Path "/api/control-plane/subscriptions?status=active&amp;limit=10" `
    -ExpectedStatus 200

Write-Info "[SKIP] Create/Update/Delete subscription tests (would modify data)"
Write-Host ""

Write-Host "================================================"
Write-Host "Phase 3: User Invitations Endpoint"
Write-Host "================================================"
Write-Host ""

Test-Endpoint `
    -Name "List invitations" `
    -Method "GET" `
    -Path "/api/control-plane/user-invitations" `
    -ExpectedStatus 200

Test-Endpoint `
    -Name "List invitations with status filter" `
    -Method "GET" `
    -Path "/api/control-plane/user-invitations?status=pending" `
    -ExpectedStatus 200

Write-Info "[SKIP] Create/Update/Delete invitation tests (would modify data)"
Write-Host ""

Write-Host "================================================"
Write-Host "Phase 4: Billing Analytics Endpoint"
Write-Host "================================================"
Write-Host ""

Test-Endpoint `
    -Name "Get usage metrics" `
    -Method "GET" `
    -Path "/api/control-plane/billing-analytics?endpoint=usage" `
    -ExpectedStatus 200

Write-Info "[INFO] Revenue/MRR/Churn endpoints require super_admin role"
Write-Host ""

Test-Endpoint `
    -Name "Get revenue metrics (may fail if not super_admin)" `
    -Method "GET" `
    -Path "/api/control-plane/billing-analytics?endpoint=revenue" `
    -ExpectedStatus 200

Test-Endpoint `
    -Name "Get MRR metrics (may fail if not super_admin)" `
    -Method "GET" `
    -Path "/api/control-plane/billing-analytics?endpoint=mrr" `
    -ExpectedStatus 200

Test-Endpoint `
    -Name "Get churn metrics (may fail if not super_admin)" `
    -Method "GET" `
    -Path "/api/control-plane/billing-analytics?endpoint=churn" `
    -ExpectedStatus 200

Write-Host "================================================"
Write-Host "Phase 5: Error Handling Tests"
Write-Host "================================================"
Write-Host ""

Write-Info "[TEST] Request without authentication (expect 401)"
try {
    $response = Invoke-WebRequest -Uri "$DashboardUrl/api/control-plane/plans" -UseBasicParsing
    Write-Error "  ✗ FAIL - Should have returned 401"
    $TestsFailed++
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Success "  ✓ PASS - Correctly returned 401 Unauthorized"
        $TestsPassed++
    } else {
        Write-Error "  ✗ FAIL - Expected 401, Got: $statusCode"
        $TestsFailed++
    }
}
$TestsRun++
Write-Host ""

Test-Endpoint `
    -Name "Invalid billing endpoint parameter" `
    -Method "GET" `
    -Path "/api/control-plane/billing-analytics?endpoint=invalid" `
    -ExpectedStatus 400

Write-Host "================================================"
Write-Host "Test Summary"
Write-Host "================================================"
Write-Host ""
Write-Host "Total Tests:  $TestsRun"
Write-Success "Passed:       $TestsPassed"
Write-Error "Failed:       $TestsFailed"
Write-Host ""

if ($TestsFailed -eq 0) {
    Write-Success "All tests passed!"
    exit 0
} else {
    Write-Error "Some tests failed"
    exit 1
}
