# Fix admin-app client configuration
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$clientId = "admin-app"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "=== Checking $clientId client ===" -ForegroundColor Cyan

# Get client
$clientsResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients?clientId=$clientId" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$client = ($clientsResponse.Content | ConvertFrom-Json)[0]

if (-not $client) {
    Write-Host "ERROR: Client $clientId not found" -ForegroundColor Red
    exit 1
}

$clientUuid = $client.id
Write-Host "Found client: $clientId (UUID: $clientUuid)" -ForegroundColor Yellow
Write-Host "  Public Client: $($client.publicClient)" -ForegroundColor Gray
Write-Host "  Direct Access Grants: $($client.directAccessGrantsEnabled)" -ForegroundColor Gray

# Enable direct access grants if not enabled
if (-not $client.directAccessGrantsEnabled) {
    Write-Host "`nEnabling direct access grants..." -ForegroundColor Yellow
    $client.directAccessGrantsEnabled = $true
    $updateData = $client | ConvertTo-Json -Depth 10

    $response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid" `
        -Method Put -Headers @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"} `
        -Body $updateData -UseBasicParsing

    Write-Host "  Direct access grants enabled" -ForegroundColor Green
}

# Add scopes
Write-Host "`nAdding client scopes..." -ForegroundColor Yellow
$scopesResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/client-scopes" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$allScopes = $scopesResponse.Content | ConvertFrom-Json

$openidScope = $allScopes | Where-Object { $_.name -eq "openid" }
$profileScope = $allScopes | Where-Object { $_.name -eq "profile" }
$emailScope = $allScopes | Where-Object { $_.name -eq "email" }
$rolesScope = $allScopes | Where-Object { $_.name -eq "roles" }

foreach ($scope in @($openidScope, $profileScope, $emailScope, $rolesScope)) {
    if ($scope) {
        $response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/default-client-scopes/$($scope.id)" `
            -Method Put -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "  Added: $($scope.name)" -ForegroundColor Green
    }
}

Write-Host "`nSUCCESS: $clientId client configured" -ForegroundColor Green
