# Check cbp-frontend client config
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
Write-Host "Token obtained"

$headers = @{
    'Authorization' = "Bearer $token"
}

$clientsResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients?clientId=cbp-frontend' -Headers $headers -UseBasicParsing
$clients = $clientsResponse.Content | ConvertFrom-Json

if ($clients.Count -eq 0) {
    Write-Host "Client cbp-frontend NOT FOUND!"
} else {
    $client = $clients[0]
    Write-Host "Client ID: $($client.id)"
    Write-Host "RedirectUris:"
    $client.redirectUris | ForEach-Object { Write-Host "  - $_" }
    Write-Host "WebOrigins:"
    $client.webOrigins | ForEach-Object { Write-Host "  - $_" }
}
