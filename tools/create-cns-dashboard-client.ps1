# Create cns-dashboard Keycloak client
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

# Create client
$clientData = @{
    clientId = "cns-dashboard"
    name = "CNS Dashboard"
    enabled = $true
    publicClient = $true
    directAccessGrantsEnabled = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    rootUrl = "http://localhost:27250"
    baseUrl = "/"
    redirectUris = @("http://localhost:27250/*")
    webOrigins = @("http://localhost:27250")
    protocol = "openid-connect"
    attributes = @{
        "pkce.code.challenge.method" = "S256"
    }
} | ConvertTo-Json

Write-Host "Creating cns-dashboard client..." -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients" `
    -Method Post -Headers @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"} `
    -Body $clientData -UseBasicParsing

if ($response.StatusCode -eq 201) {
    Write-Host "SUCCESS: cns-dashboard client created" -ForegroundColor Green
} else {
    Write-Host "Response: $($response.StatusCode)" -ForegroundColor Yellow
}
