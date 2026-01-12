$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
    'Content-Type' = 'application/json'
}

$uuid = 'dsw0gog8sswc08s8ss088ssw'
$envUuid = 'l040sc8gc048kooc4cog0044'

# Try different endpoints
$endpoints = @(
    @{ url = "http://172.25.76.67:8000/api/v1/applications/$uuid/envs"; method = 'PATCH'; body = '{"key":"CONTROL_PLANE_DB_PASSWORD","value":"SecurePass123"}' },
    @{ url = "http://172.25.76.67:8000/api/v1/applications/$uuid/envs/bulk"; method = 'PATCH'; body = '[{"key":"CONTROL_PLANE_DB_PASSWORD","value":"SecurePass123"}]' }
)

foreach ($ep in $endpoints) {
    Write-Host "`n=== Testing: $($ep.method) $($ep.url) ==="
    Write-Host "Body: $($ep.body)"
    try {
        $response = Invoke-RestMethod -Uri $ep.url -Method $ep.method -Headers $headers -Body $ep.body -ErrorAction Stop
        Write-Host "Success: $($response | ConvertTo-Json -Depth 2 -Compress)"
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        if ($_.ErrorDetails.Message) {
            Write-Host "Details: $($_.ErrorDetails.Message)"
        }
    }
}
