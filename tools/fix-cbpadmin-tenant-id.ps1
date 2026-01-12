# Fix cbpadmin tenant_id attribute in Keycloak
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$username = "cbpadmin"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "=== Fixing tenant_id for $username ===" -ForegroundColor Cyan

# Get user ID
$usersResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/users?username=$username" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$user = ($usersResponse.Content | ConvertFrom-Json)[0]

if (-not $user) {
    Write-Host "ERROR: User $username not found" -ForegroundColor Red
    exit 1
}

$userId = $user.id
Write-Host "Found user: $username (ID: $userId)" -ForegroundColor Yellow

# Update user attributes
$userData = @{
    attributes = @{
        tenant_id = @("b0000000-0000-4000-a000-000000000001")
        tenant_key = @("ananta-platform")
    }
} | ConvertTo-Json -Depth 5

$response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/users/$userId" `
    -Method Put -Headers @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"} `
    -Body $userData -UseBasicParsing

if ($response.StatusCode -eq 204) {
    Write-Host "SUCCESS: tenant_id updated to b0000000-0000-4000-a000-000000000001" -ForegroundColor Green
} else {
    Write-Host "Response: $($response.StatusCode)" -ForegroundColor Yellow
}
