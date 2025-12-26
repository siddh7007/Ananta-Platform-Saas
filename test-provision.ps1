$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInVzZXJUZW5hbnRJZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInRlbmFudElkIjoiMTIzNDU2NzgtMTIzNC00MjM0LTgyMzQtMTIzNDU2Nzg5MGFiIiwicGVybWlzc2lvbnMiOlsiMTAyMDAiLCIxMDIwMSIsIjEwMjAyIiwiMTAyMDMiLCIxMDIwNCIsIjEwMjA1IiwiMTAyMDYiLCIxMDIwNyIsIjEwMjE2IiwiMTAyMDgiLCIxMDIwOSIsIjEwMjEwIiwiMTAyMTEiLCIxMDIxMiIsIjEwMjEzIiwiMTAyMTQiLCIxMDIxNSIsIjcwMDEiLCI3MDAyIiwiNzAwNCIsIjcwMDgiLCIxMDIyMCIsIjEwMjIxIiwiMTAyMjIiLCIxMDIyMyIsIjEwMzAwIiwiMTAzMDEiLCIxMDMwMiIsIjEwMzAzIiwiMTAzMDQiLCIxMDMwNSIsIjEwMzA2IiwiMTAzMTAiLCIxMDMxMSIsIjEwMzEyIiwiMTAzMTMiLCIxMDMyMCIsIjEwMzIxIiwiMTAzMjIiLCIxMDMyMyIsIjEwMzI0IiwiMTAzMzAiLCI1MzIxIiwiNTMyMiIsIjUzMjMiLCI1MzI0IiwiNTMyNSIsIjUzMjYiLCI1MzI3IiwiNTMyOCIsIjUzMjkiLCI1MzMxIiwiNTMzMiIsIjUzMzMiXSwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImlhdCI6MTc2NTEzOTM4NCwiZXhwIjoxODY1MjI1Nzg0LCJpc3MiOiJhcmMtc2FhcyJ9.qWgUIE8YlSH5IY3DFA0xrURDZtSTkP9HHYMpWH98BPY"
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# First, get subscriptions to find a valid subscription
Write-Output "=== Getting subscriptions ==="
try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:14000/subscriptions' -Headers $headers -UseBasicParsing
    Write-Output "Subscriptions: $($response.Content)"
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}

Write-Output ""

# Get the tenant that has a subscription
$tenantId = "468224c2-82a0-6286-57e7-eff8da9982f2"  # Ananta tenant

Write-Output "=== Getting tenant $tenantId ==="
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:14000/tenants/$tenantId" -Headers $headers -UseBasicParsing
    Write-Output "Tenant: $($response.Content)"
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}

Write-Output ""

# Get subscription for this tenant
Write-Output "=== Getting subscription for tenant ==="
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:14000/subscriptions?filter[where][subscriberId]=$tenantId" -Headers $headers -UseBasicParsing
    Write-Output "Subscription: $($response.Content)"
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}
