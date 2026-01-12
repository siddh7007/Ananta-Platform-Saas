# List users in Keycloak realms
$keycloakUrl = "http://localhost:8180"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" `
    -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
$headers = @{"Authorization" = "Bearer $token"}

foreach ($realm in @("ananta", "ananta-saas")) {
    Write-Host "`n=== Users in '$realm' realm ===" -ForegroundColor Cyan
    try {
        $usersResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/users?max=20" `
            -Headers $headers `
            -UseBasicParsing
        $users = $usersResponse.Content | ConvertFrom-Json
        if ($users.Count -eq 0) {
            Write-Host "  (no users)" -ForegroundColor Yellow
        } else {
            $users | ForEach-Object {
                Write-Host "  - $($_.username) ($($_.email))" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
    }
}
