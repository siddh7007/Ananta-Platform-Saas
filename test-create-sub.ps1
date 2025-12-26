$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInVzZXJUZW5hbnRJZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInRlbmFudElkIjoiMTIzNDU2NzgtMTIzNC00MjM0LTgyMzQtMTIzNDU2Nzg5MGFiIiwicGVybWlzc2lvbnMiOlsiMTAyMDAiLCIxMDIwMSIsIjEwMjAyIiwiMTAyMDMiLCIxMDIwNCIsIjEwMjA1IiwiMTAyMDYiLCIxMDIwNyIsIjEwMjE2IiwiMTAyMDgiLCIxMDIwOSIsIjEwMjEwIiwiMTAyMTEiLCIxMDIxMiIsIjEwMjEzIiwiMTAyMTQiLCIxMDIxNSIsIjcwMDEiLCI3MDAyIiwiNzAwNCIsIjcwMDgiLCIxMDIyMCIsIjEwMjIxIiwiMTAyMjIiLCIxMDIyMyIsIjEwMzAwIiwiMTAzMDEiLCIxMDMwMiIsIjEwMzAzIiwiMTAzMDQiLCIxMDMwNSIsIjEwMzA2IiwiMTAzMTAiLCIxMDMxMSIsIjEwMzEyIiwiMTAzMTMiLCIxMDMyMCIsIjEwMzIxIiwiMTAzMjIiLCIxMDMyMyIsIjEwMzI0IiwiMTAzMzAiLCI1MzIxIiwiNTMyMiIsIjUzMjMiLCI1MzI0IiwiNTMyNSIsIjUzMjYiLCI1MzI3IiwiNTMyOCIsIjUzMjkiLCI1MzMxIiwiNTMzMiIsIjUzMzMiXSwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImlhdCI6MTc2NTEzOTM4NCwiZXhwIjoxODY1MjI1Nzg0LCJpc3MiOiJhcmMtc2FhcyJ9.qWgUIE8YlSH5IY3DFA0xrURDZtSTkP9HHYMpWH98BPY"
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

$tenantId = "468224c2-82a0-6286-57e7-eff8da9982f2"

# Create a subscription for the tenant with correct fields
Write-Output "=== Creating subscription ==="
$startDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$endDate = (Get-Date).AddMonths(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$subBody = @{
    tenantId = $tenantId
    planId = "plan-basic"
    planName = "Basic"
    planTier = "BASIC"
    amount = 29
    status = "active"
    currentPeriodStart = $startDate
    currentPeriodEnd = $endDate
} | ConvertTo-Json

Write-Output "Request body: $subBody"
Write-Output ""

try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:14000/subscriptions' -Method POST -Headers $headers -Body $subBody -UseBasicParsing
    Write-Output "Created Subscription: $($response.Content)"
} catch {
    Write-Output "Error creating subscription: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "Response: $($reader.ReadToEnd())"
        $reader.Close()
    }
}

Write-Output ""

# Verify subscription was created
Write-Output "=== Verifying subscriptions ==="
try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:14000/subscriptions' -Headers $headers -UseBasicParsing
    Write-Output "Subscriptions: $($response.Content)"
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}
