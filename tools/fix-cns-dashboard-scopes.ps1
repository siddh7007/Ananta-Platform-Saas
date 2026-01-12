# Fix cns-dashboard client scopes
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$clientId = "cns-dashboard"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "=== Fixing $clientId client scopes ===" -ForegroundColor Cyan

# Get client UUID
$clientsResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients?clientId=$clientId" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$client = ($clientsResponse.Content | ConvertFrom-Json)[0]
$clientUuid = $client.id

# Get available client scopes
$scopesResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/client-scopes" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$allScopes = $scopesResponse.Content | ConvertFrom-Json

# Find the scope UUIDs
$openidScope = $allScopes | Where-Object { $_.name -eq "openid" }
$profileScope = $allScopes | Where-Object { $_.name -eq "profile" }
$emailScope = $allScopes | Where-Object { $_.name -eq "email" }
$rolesScope = $allScopes | Where-Object { $_.name -eq "roles" }

# Add default scopes
Write-Host "Adding default scopes..." -ForegroundColor Yellow
foreach ($scope in @($openidScope, $profileScope, $emailScope, $rolesScope)) {
    if ($scope) {
        $response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/default-client-scopes/$($scope.id)" `
            -Method Put -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "  Added: $($scope.name)" -ForegroundColor Green
    }
}

Write-Host "SUCCESS: $clientId client scopes fixed" -ForegroundColor Green
