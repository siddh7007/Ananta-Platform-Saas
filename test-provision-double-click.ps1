$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInVzZXJUZW5hbnRJZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInRlbmFudElkIjoiMTIzNDU2NzgtMTIzNC00MjM0LTgyMzQtMTIzNDU2Nzg5MGFiIiwicGVybWlzc2lvbnMiOlsiMTAyMDAiLCIxMDIwMSIsIjEwMjAyIiwiMTAyMDMiLCIxMDIwNCIsIjEwMjA1IiwiMTAyMDYiLCIxMDIwNyIsIjEwMjE2IiwiMTAyMDgiLCIxMDIwOSIsIjEwMjEwIiwiMTAyMTEiLCIxMDIxMiIsIjEwMjEzIiwiMTAyMTQiLCIxMDIxNSIsIjcwMDEiLCI3MDAyIiwiNzAwNCIsIjcwMDgiLCIxMDIyMCIsIjEwMjIxIiwiMTAyMjIiLCIxMDIyMyIsIjEwMzAwIiwiMTAzMDEiLCIxMDMwMiIsIjEwMzAzIiwiMTAzMDQiLCIxMDMwNSIsIjEwMzA2IiwiMTAzMTAiLCIxMDMxMSIsIjEwMzEyIiwiMTAzMTMiLCIxMDMyMCIsIjEwMzIxIiwiMTAzMjIiLCIxMDMyMyIsIjEwMzI0IiwiMTAzMzAiLCI1MzIxIiwiNTMyMiIsIjUzMjMiLCI1MzI0IiwiNTMyNSIsIjUzMjYiLCI1MzI3IiwiNTMyOCIsIjUzMjkiLCI1MzMxIiwiNTMzMiIsIjUzMzMiXSwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImlhdCI6MTc2NTEzOTM4NCwiZXhwIjoxODY1MjI1Nzg0LCJpc3MiOiJhcmMtc2FhcyJ9.qWgUIE8YlSH5IY3DFA0xrURDZtSTkP9HHYMpWH98BPY"
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

$tenantId = "468224c2-82a0-6286-57e7-eff8da9982f2"
$subscriptionId = "8c8cca08-137f-41c7-8f67-27d36bad6f1a"

# SubscriptionDTO matching the model definition
$subscriptionDTO = @{
    id = $subscriptionId
    subscriberId = $tenantId
    planId = "plan-basic"
    status = 1  # active
    startDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    endDate = (Get-Date).AddMonths(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    plan = @{
        tier = "BASIC"
    }
} | ConvertTo-Json -Depth 3

Write-Output "=========================================="
Write-Output "=== TESTING DOUBLE-CLICK PROVISION FIX ==="
Write-Output "=========================================="
Write-Output ""
Write-Output "Request body: $subscriptionDTO"
Write-Output ""

# Check initial tenant status
Write-Output "=== Initial Tenant Status ==="
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:14000/tenants/$tenantId" -Headers $headers -UseBasicParsing
    $tenant = $response.Content | ConvertFrom-Json
    Write-Output "Tenant: $($tenant.name), Status: $($tenant.status)"
    Write-Output "(Status: 0=ACTIVE, 1=PENDINGPROVISION, 2=PROVISIONING, 3=PROVISIONFAILED)"
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}

Write-Output ""

# First provision call
Write-Output "=== FIRST PROVISION CALL ==="
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:14000/tenants/$tenantId/provision" -Method POST -Headers $headers -Body $subscriptionDTO -UseBasicParsing
    Write-Output "Status Code: $($response.StatusCode)"
    Write-Output "Response: $($response.Content)"
    if ($response.StatusCode -eq 204) {
        Write-Output "SUCCESS: Got 204 No Content (expected)"
    }
} catch {
    Write-Output "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Output "Status Code: $($_.Exception.Response.StatusCode)"
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "Response Body: $($reader.ReadToEnd())"
        $reader.Close()
    }
}

Write-Output ""

# Small delay then second provision call (simulating double-click)
Start-Sleep -Milliseconds 500

Write-Output "=== SECOND PROVISION CALL (double-click simulation) ==="
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:14000/tenants/$tenantId/provision" -Method POST -Headers $headers -Body $subscriptionDTO -UseBasicParsing
    Write-Output "Status Code: $($response.StatusCode)"
    Write-Output "Response: $($response.Content)"
    if ($response.StatusCode -eq 204) {
        Write-Output "SUCCESS: Got 204 No Content (idempotent behavior working!)"
    }
} catch {
    Write-Output "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Output "Status Code: $($_.Exception.Response.StatusCode)"
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "Response Body: $($reader.ReadToEnd())"
        $reader.Close()
    }
}

Write-Output ""

# Check final tenant status - should NOT be PROVISIONFAILED (3)
Start-Sleep -Seconds 2
Write-Output "=== Final Tenant Status (should NOT be PROVISIONFAILED=3) ==="
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:14000/tenants/$tenantId" -Headers $headers -UseBasicParsing
    $tenant = $response.Content | ConvertFrom-Json
    Write-Output "Tenant: $($tenant.name), Status: $($tenant.status)"

    if ($tenant.status -eq 3) {
        Write-Output "FAILURE: Tenant is in PROVISIONFAILED state - double-click fix NOT working!"
    } else {
        Write-Output "SUCCESS: Tenant is NOT in PROVISIONFAILED state - double-click fix WORKING!"
    }
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}

Write-Output ""
Write-Output "=========================================="
