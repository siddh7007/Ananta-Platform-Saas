# Add email claim to cbp-frontend client tokens
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$clientId = "cbp-frontend"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "=== Adding email scope to $clientId client ===" -ForegroundColor Cyan

# Get client
$clientsResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients?clientId=$clientId" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$client = ($clientsResponse.Content | ConvertFrom-Json)[0]

if (-not $client) {
    Write-Host "ERROR: Client $clientId not found" -ForegroundColor Red
    exit 1
}

$clientUuid = $client.id

# Get email scope
$scopesResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/client-scopes" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$allScopes = $scopesResponse.Content | ConvertFrom-Json
$emailScope = $allScopes | Where-Object { $_.name -eq "email" }

if (-not $emailScope) {
    Write-Host "ERROR: email scope not found" -ForegroundColor Red
    exit 1
}

# Add email scope as default scope
$response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/default-client-scopes/$($emailScope.id)" `
    -Method Put -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing -ErrorAction SilentlyContinue

Write-Host "  Added email scope to default scopes" -ForegroundColor Green

# Get email protocol mapper from scope
$mappersResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/client-scopes/$($emailScope.id)/protocol-mappers/models" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$emailMappers = $mappersResponse.Content | ConvertFrom-Json

Write-Host "`nEmail scope contains $($emailMappers.Count) mapper(s):" -ForegroundColor Yellow
foreach ($mapper in $emailMappers) {
    Write-Host "  - $($mapper.name): protocol=$($mapper.protocol), type=$($mapper.protocolMapper)" -ForegroundColor Gray
}

Write-Host "`nSUCCESS: Email claim will now be included in tokens for $clientId" -ForegroundColor Green
