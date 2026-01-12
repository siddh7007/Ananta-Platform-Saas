# Check client scopes in ananta-saas realm
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

$headers = @{ 'Authorization' = "Bearer $token" }

# Get all client scopes in ananta-saas realm
$scopesResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/client-scopes' -Headers $headers -UseBasicParsing
$scopes = $scopesResponse.Content | ConvertFrom-Json

Write-Host "Available client scopes in ananta-saas realm:"
$scopes | ForEach-Object { Write-Host "  - $($_.name)" }

# Check cbp-frontend optional scopes
Write-Host ""
Write-Host "Checking cbp-frontend client scopes..."
$clientsResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients?clientId=cbp-frontend' -Headers $headers -UseBasicParsing
$clients = $clientsResponse.Content | ConvertFrom-Json
if ($clients.Count -gt 0) {
    $clientId = $clients[0].id

    # Default scopes
    $defaultScopesResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientId/default-client-scopes" -Headers $headers -UseBasicParsing
    $defaultScopes = $defaultScopesResponse.Content | ConvertFrom-Json
    Write-Host "Default scopes:"
    $defaultScopes | ForEach-Object { Write-Host "  - $($_.name)" }

    # Optional scopes
    $optionalScopesResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientId/optional-client-scopes" -Headers $headers -UseBasicParsing
    $optionalScopes = $optionalScopesResponse.Content | ConvertFrom-Json
    Write-Host "Optional scopes:"
    $optionalScopes | ForEach-Object { Write-Host "  - $($_.name)" }
}
