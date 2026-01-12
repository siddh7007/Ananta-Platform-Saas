$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
    'Content-Type' = 'application/json'
}

$uuid = 'dsw0gog8sswc08s8ss088ssw'
$url = "http://172.25.76.67:8000/api/v1/applications/$uuid/envs"

# Get existing env UUID for CONTROL_PLANE_DB_PASSWORD
$envs = Invoke-RestMethod -Uri $url -Headers $headers
$envToUpdate = $envs | Where-Object { $_.key -eq 'CONTROL_PLANE_DB_PASSWORD' -and $_.is_preview -eq $false } | Select-Object -First 1

Write-Host "Found env var: $($envToUpdate.uuid)"
Write-Host "Current value: $($envToUpdate.real_value)"

# Try PATCH to update
$updateUrl = "http://172.25.76.67:8000/api/v1/applications/$uuid/envs/$($envToUpdate.uuid)"
$body = '{"value":"SecurePassword123!"}'

Write-Host "`nAttempting PATCH to: $updateUrl"

try {
    $response = Invoke-RestMethod -Uri $updateUrl -Method Patch -Headers $headers -Body $body
    Write-Host "Success: $($response | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Details: $($_.ErrorDetails.Message)"
}
