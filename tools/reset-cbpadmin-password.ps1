# Reset cbpadmin user password to Test123!
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$username = "cbpadmin"
$newPassword = "Test123!"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "=== Resetting password for $username ===" -ForegroundColor Cyan

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

# Reset password
$passwordData = @{
    type = "password"
    value = $newPassword
    temporary = $false
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/users/$userId/reset-password" `
    -Method Put -Headers @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"} `
    -Body $passwordData -UseBasicParsing

if ($response.StatusCode -eq 204) {
    Write-Host "SUCCESS: Password reset to $newPassword" -ForegroundColor Green
} else {
    Write-Host "Response: $($response.StatusCode)" -ForegroundColor Yellow
}
