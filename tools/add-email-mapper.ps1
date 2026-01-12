# Add email protocol mapper to cbp-frontend client
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$clientId = "cbp-frontend"

# Get admin token
$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "=== Adding email mapper to $clientId client ===" -ForegroundColor Cyan

# Get client
$clientsResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients?clientId=$clientId" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$client = ($clientsResponse.Content | ConvertFrom-Json)[0]

if (-not $client) {
    Write-Host "ERROR: Client $clientId not found" -ForegroundColor Red
    exit 1
}

$clientUuid = $client.id

# Create email protocol mapper
$emailMapper = @{
    name = "email"
    protocol = "openid-connect"
    protocolMapper = "oidc-usermodel-property-mapper"
    consentRequired = $false
    config = @{
        "userinfo.token.claim" = "true"
        "user.attribute" = "email"
        "id.token.claim" = "true"
        "access.token.claim" = "true"
        "claim.name" = "email"
        "jsonType.label" = "String"
    }
} | ConvertTo-Json -Depth 10

$response = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/protocol-mappers/models" `
    -Method Post -Headers @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"} `
    -Body $emailMapper -UseBasicParsing -ErrorAction Stop

Write-Host "  Created email mapper" -ForegroundColor Green

Write-Host "`nSUCCESS: Email claim will now be included in access tokens for $clientId" -ForegroundColor Green
