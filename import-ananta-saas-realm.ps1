# Import ananta-saas realm from realm-ananta.json
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
Write-Host "Token obtained successfully"

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Read the realm JSON file
$realmJson = Get-Content -Path 'e:\Work\Ananta-Platform-Saas\realm-ananta.json' -Raw

# Import the realm
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms' -Method Post -Headers $headers -Body $realmJson -UseBasicParsing
    Write-Host "Realm 'ananta-saas' imported successfully: HTTP $($response.StatusCode)"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Realm 'ananta-saas' already exists"
    } else {
        Write-Host "Error importing realm: $($_.Exception.Message)"
        Write-Host "Response: $($_.Exception.Response)"
    }
}

# List realms to confirm
Write-Host "`nAvailable Keycloak Realms:"
$realms = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms' -Headers $headers -UseBasicParsing
($realms.Content | ConvertFrom-Json) | ForEach-Object { Write-Host "  - $($_.realm)" }

# List users in ananta-saas realm
Write-Host "`nUsers in ananta-saas realm:"
try {
    $users = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/users' -Headers $headers -UseBasicParsing
    ($users.Content | ConvertFrom-Json) | ForEach-Object {
        Write-Host "  - $($_.username) ($($_.email))"
    }
} catch {
    Write-Host "  Could not list users: $($_.Exception.Message)"
}

Write-Host "`n=============================================="
Write-Host "SEED DATA USERS (from realm-ananta.json):"
Write-Host "=============================================="
Write-Host "Realm: ananta-saas"
Write-Host ""
Write-Host "1. platform-admin / admin123 (super_admin)"
Write-Host "   Email: admin@arc-saas.local"
Write-Host "   NOTE: Password is TEMPORARY - must change on first login"
Write-Host ""
Write-Host "2. demo.user / demo123 (admin)"
Write-Host "   Email: demo@example.com"
Write-Host ""
Write-Host "Clients:"
Write-Host "  - ananta-saas-admin (Admin App)"
Write-Host "  - ananta-saas-api (Backend API)"
Write-Host "  - ananta-saas-customer-portal (Customer Portal)"
