# Reset all user passwords to Test123!
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$newPassword = "Test123!"

$users = @(
    "superadmin",
    "cbpadmin",
    "cnsstaff",
    "cns-engineer",
    "cns-lead",
    "demo-owner",
    "demo-engineer",
    "demo-analyst",
    "backstage-admin"
)

# Get admin token
Write-Host "=== Getting admin token ===" -ForegroundColor Cyan
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "`n=== Resetting passwords for all users ===" -ForegroundColor Cyan

foreach ($username in $users) {
    try {
        # Get user ID
        $usersResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/users?username=$username" `
            -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
        $user = ($usersResponse.Content | ConvertFrom-Json)[0]

        if (-not $user) {
            Write-Host "  SKIP: $username (not found)" -ForegroundColor Yellow
            continue
        }

        $userId = $user.id

        # Reset password
        $passwordData = @{
            type = "password"
            value = $newPassword
            temporary = $false
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/users/$userId/reset-password" `
            -Method Put -Headers @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"} `
            -Body $passwordData -UseBasicParsing -ErrorAction Stop

        if ($response.StatusCode -eq 204) {
            Write-Host "  OK: $username -> $newPassword" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ERROR: $username - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== All passwords reset to: $newPassword ===" -ForegroundColor Green
