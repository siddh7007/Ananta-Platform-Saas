$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInVzZXJUZW5hbnRJZCI6IjEyMzQ1Njc4LTEyMzQtNDIzNC04MjM0LTEyMzQ1Njc4OTBhYiIsInRlbmFudElkIjoiMTIzNDU2NzgtMTIzNC00MjM0LTgyMzQtMTIzNDU2Nzg5MGFiIiwicGVybWlzc2lvbnMiOlsiMTAyMDAiLCIxMDIwMSIsIjEwMjAyIiwiMTAyMDMiLCIxMDIwNCIsIjEwMjA1IiwiMTAyMDYiLCIxMDIwNyIsIjEwMjE2IiwiMTAyMDgiLCIxMDIwOSIsIjEwMjEwIiwiMTAyMTEiLCIxMDIxMiIsIjEwMjEzIiwiMTAyMTQiLCIxMDIxNSIsIjcwMDEiLCI3MDAyIiwiNzAwNCIsIjcwMDgiLCIxMDIyMCIsIjEwMjIxIiwiMTAyMjIiLCIxMDIyMyIsIjEwMzAwIiwiMTAzMDEiLCIxMDMwMiIsIjEwMzAzIiwiMTAzMDQiLCIxMDMwNSIsIjEwMzA2IiwiMTAzMTAiLCIxMDMxMSIsIjEwMzEyIiwiMTAzMTMiLCIxMDMyMCIsIjEwMzIxIiwiMTAzMjIiLCIxMDMyMyIsIjEwMzI0IiwiMTAzMzAiLCI1MzIxIiwiNTMyMiIsIjUzMjMiLCI1MzI0IiwiNTMyNSIsIjUzMjYiLCI1MzI3IiwiNTMyOCIsIjUzMjkiLCI1MzMxIiwiNTMzMiIsIjUzMzMiXSwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImlhdCI6MTc2NTEzOTM4NCwiZXhwIjoxODY1MjI1Nzg0LCJpc3MiOiJhcmMtc2FhcyJ9.qWgUIE8YlSH5IY3DFA0xrURDZtSTkP9HHYMpWH98BPY"
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

$tenantId = "468224c2-82a0-6286-57e7-eff8da9982f2"

Write-Output "=== Checking tenant status ==="
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:14000/tenants/$tenantId" -Headers $headers -UseBasicParsing
    $tenant = $response.Content | ConvertFrom-Json
    Write-Output "Tenant: $($tenant.name)"
    Write-Output "Status: $($tenant.status) (0=ACTIVE, 1=PENDINGPROVISION, 2=PROVISIONING, 3=PROVISIONFAILED)"
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}
