# Update admin-app redirect URIs in Keycloak to include port 3001
# This is needed because port 27555 is blocked by Windows

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -Body @{
    grant_type='password'
    client_id='admin-cli'
    username='admin'
    password='admin123'
} -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing

$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
Write-Host "Got admin token" -ForegroundColor Green

# Get all clients
$clientsResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients' -Headers @{
    'Authorization' = "Bearer $token"
} -UseBasicParsing

$clients = $clientsResponse.Content | ConvertFrom-Json
$adminAppClient = $clients | Where-Object { $_.clientId -eq 'admin-app' }

if (-not $adminAppClient) {
    Write-Host "admin-app client not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Found admin-app client: $($adminAppClient.id)" -ForegroundColor Cyan
Write-Host "Current redirectUris: $($adminAppClient.redirectUris -join ', ')" -ForegroundColor Yellow
Write-Host "Current webOrigins: $($adminAppClient.webOrigins -join ', ')" -ForegroundColor Yellow

# Update redirect URIs to include port 3001
$newRedirectUris = @(
    'http://localhost:27555/*',
    'http://localhost:3001/*',
    'http://localhost:3000/*'
)

$newWebOrigins = @(
    'http://localhost:27555',
    'http://localhost:3001',
    'http://localhost:3000'
)

$updateBody = @{
    id = $adminAppClient.id
    clientId = 'admin-app'
    redirectUris = $newRedirectUris
    webOrigins = $newWebOrigins
} | ConvertTo-Json

Write-Host "Updating admin-app client..." -ForegroundColor Cyan

$updateResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$($adminAppClient.id)" -Method Put -Headers @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
} -Body $updateBody -UseBasicParsing

Write-Host "Updated admin-app client successfully!" -ForegroundColor Green
Write-Host "New redirectUris: $($newRedirectUris -join ', ')" -ForegroundColor Green
Write-Host "New webOrigins: $($newWebOrigins -join ', ')" -ForegroundColor Green
