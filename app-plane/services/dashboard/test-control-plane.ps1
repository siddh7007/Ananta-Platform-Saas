# Control Plane Integration Testing Script
# PowerShell version for Windows

param(
    [string]$Token = $env:TOKEN
)

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Control Plane Integration Tests" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check if token is provided
if (-not $Token) {
    Write-Host "[ERROR] No JWT token provided!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please provide a token via:" -ForegroundColor Yellow
    Write-Host '  $env:TOKEN = "your-jwt-token"' -ForegroundColor Yellow
    Write-Host '  .\test-control-plane.ps1' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OR:" -ForegroundColor Yellow
    Write-Host '  .\test-control-plane.ps1 -Token "your-jwt-token"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To get a token, see MANUAL_TESTING_GUIDE.md" -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Token length: $($Token.Length) chars" -ForegroundColor Green
Write-Host ""

# Base URL for Dashboard API (Production on port 27400)
$BaseUrl = "http://localhost:27400/api/control-plane"

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [bool]$RequireAuth = $true
    )

    Write-Host "[$Name]" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    Write-Host "  Method: $Method" -ForegroundColor Gray

    try {
        $headers = @{}
        if ($RequireAuth) {
            $headers["Authorization"] = "Bearer $Token"
        }

        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -UseBasicParsing

        Write-Host "  Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green

        # Try to parse JSON
        try {
            $json = $response.Content | ConvertFrom-Json
            if ($json -is [array]) {
                Write-Host "  Response: Array with $($json.Count) items" -ForegroundColor Cyan
                if ($json.Count -gt 0) {
                    Write-Host "  First item: $($json[0] | ConvertTo-Json -Depth 1 -Compress)" -ForegroundColor Gray
                }
            } else {
                Write-Host "  Response: $($json | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor Cyan
            }
        } catch {
            Write-Host "  Response: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Gray
        }

        Write-Host "  Result: PASS" -ForegroundColor Green
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  Status: $statusCode" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red

        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "  Response: $errorBody" -ForegroundColor Gray
        }

        Write-Host "  Result: FAIL" -ForegroundColor Red
        return $false
    }
    finally {
        Write-Host "---------------------------------------------------" -ForegroundColor Gray
        Write-Host ""
    }
}

# Run tests
$results = @{}

Write-Host "Testing authenticated endpoints..." -ForegroundColor Cyan
Write-Host ""

$results["Plans"] = Test-Endpoint `
    -Name "TEST 1: GET /api/control-plane/plans" `
    -Url "$BaseUrl/plans" `
    -Method "GET" `
    -RequireAuth $true

$results["Subscriptions"] = Test-Endpoint `
    -Name "TEST 2: GET /api/control-plane/subscriptions" `
    -Url "$BaseUrl/subscriptions" `
    -Method "GET" `
    -RequireAuth $true

$results["UserInvitations"] = Test-Endpoint `
    -Name "TEST 3: GET /api/control-plane/user-invitations" `
    -Url "$BaseUrl/user-invitations" `
    -Method "GET" `
    -RequireAuth $true

$results["BillingUsage"] = Test-Endpoint `
    -Name "TEST 4: GET /api/control-plane/billing-analytics (usage)" `
    -Url "$BaseUrl/billing-analytics?endpoint=usage" `
    -Method "GET" `
    -RequireAuth $true

$results["BillingRevenue"] = Test-Endpoint `
    -Name "TEST 5: GET /api/control-plane/billing-analytics (revenue)" `
    -Url "$BaseUrl/billing-analytics?endpoint=revenue" `
    -Method "GET" `
    -RequireAuth $true

$results["BillingMRR"] = Test-Endpoint `
    -Name "TEST 6: GET /api/control-plane/billing-analytics (mrr)" `
    -Url "$BaseUrl/billing-analytics?endpoint=mrr" `
    -Method "GET" `
    -RequireAuth $true

$results["BillingChurn"] = Test-Endpoint `
    -Name "TEST 7: GET /api/control-plane/billing-analytics (churn)" `
    -Url "$BaseUrl/billing-analytics?endpoint=churn" `
    -Method "GET" `
    -RequireAuth $true

Write-Host "Testing unauthenticated endpoint (should fail with 401)..." -ForegroundColor Cyan
Write-Host ""

# This test SHOULD fail with 401
Write-Host "[TEST 8: GET /api/control-plane/plans (no auth)]" -ForegroundColor Yellow
Write-Host "  URL: $BaseUrl/plans" -ForegroundColor Gray
Write-Host "  Method: GET (no Authorization header)" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/plans" -Method GET -UseBasicParsing
    Write-Host "  Status: $($response.StatusCode) - UNEXPECTED!" -ForegroundColor Red
    Write-Host "  Result: FAIL (should have returned 401)" -ForegroundColor Red
    $results["NoAuth"] = $false
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "  Status: 401 Unauthorized" -ForegroundColor Green
        Write-Host "  Result: PASS (correctly rejected)" -ForegroundColor Green
        $results["NoAuth"] = $true
    } else {
        Write-Host "  Status: $statusCode - UNEXPECTED!" -ForegroundColor Red
        Write-Host "  Result: FAIL (expected 401, got $statusCode)" -ForegroundColor Red
        $results["NoAuth"] = $false
    }
}

Write-Host "---------------------------------------------------" -ForegroundColor Gray
Write-Host ""

# Summary
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$passed = ($results.Values | Where-Object { $_ -eq $true }).Count
$total = $results.Count

Write-Host ""
foreach ($test in $results.GetEnumerator()) {
    $status = if ($test.Value) { "PASS" } else { "FAIL" }
    $color = if ($test.Value) { "Green" } else { "Red" }
    Write-Host "  $($test.Key): " -NoNewline
    Write-Host $status -ForegroundColor $color
}

Write-Host ""
Write-Host "Total: $passed / $total tests passed" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })
Write-Host ""

if ($passed -eq $total) {
    Write-Host "SUCCESS! All tests passed." -ForegroundColor Green
    Write-Host "The Control Plane integration is working correctly." -ForegroundColor Green
    exit 0
} else {
    Write-Host "WARNING: Some tests failed." -ForegroundColor Yellow
    Write-Host "Check the output above for details." -ForegroundColor Yellow
    Write-Host "See MANUAL_TESTING_GUIDE.md for troubleshooting." -ForegroundColor Yellow
    exit 1
}
