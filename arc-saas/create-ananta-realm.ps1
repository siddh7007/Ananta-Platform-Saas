# Create ananta-saas realm in Keycloak
$ErrorActionPreference = "Continue"

Write-Host "Getting Keycloak admin token..."
$tokenResponse = Invoke-RestMethod -Uri "http://localhost:8180/realms/master/protocol/openid-connect/token" -Method POST -ContentType "application/x-www-form-urlencoded" -Body "username=admin&password=admin&grant_type=password&client_id=admin-cli"
$token = $tokenResponse.access_token

if (-not $token) {
    Write-Host "Failed to get token"
    exit 1
}

Write-Host "Got token: $($token.Substring(0, 50))..."

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Create realm
Write-Host "Creating ananta-saas realm..."
$realmBody = @{
    realm = "ananta-saas"
    enabled = $true
    displayName = "Ananta SaaS"
    loginTheme = "keycloak"
    accessTokenLifespan = 3600
    ssoSessionIdleTimeout = 1800
    ssoSessionMaxLifespan = 36000
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:8180/admin/realms" -Method POST -Headers $headers -Body $realmBody
    Write-Host "Realm created successfully!"
} catch {
    Write-Host "Realm creation response: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Realm already exists, continuing..."
    }
}

# Create admin-app client
Write-Host "Creating admin-app client..."
$clientBody = @{
    clientId = "admin-app"
    enabled = $true
    protocol = "openid-connect"
    publicClient = $true
    directAccessGrantsEnabled = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    redirectUris = @("http://localhost:27555/*")
    webOrigins = @("http://localhost:27555")
    attributes = @{
        "pkce.code.challenge.method" = "S256"
    }
} | ConvertTo-Json -Depth 3

try {
    Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients" -Method POST -Headers $headers -Body $clientBody
    Write-Host "Client created successfully!"
} catch {
    Write-Host "Client creation: $($_.Exception.Message)"
}

# Create admin user
Write-Host "Creating test admin user..."
$userBody = @{
    username = "admin"
    email = "admin@ananta-saas.local"
    firstName = "Admin"
    lastName = "User"
    enabled = $true
    emailVerified = $true
    credentials = @(
        @{
            type = "password"
            value = "admin123"
            temporary = $false
        }
    )
} | ConvertTo-Json -Depth 3

try {
    Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/users" -Method POST -Headers $headers -Body $userBody
    Write-Host "User created successfully!"
} catch {
    Write-Host "User creation: $($_.Exception.Message)"
}

# Verify
Write-Host "`nVerifying realm..."
$realm = Invoke-RestMethod -Uri "http://localhost:8180/realms/ananta-saas" -Method GET
Write-Host "Realm found: $($realm.realm)"

Write-Host "`n========================================="
Write-Host "ananta-saas realm setup complete!"
Write-Host "Client: admin-app"
Write-Host "Test User: admin / admin123"
Write-Host "========================================="
