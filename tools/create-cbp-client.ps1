# Create cbp-frontend client in Keycloak
$ErrorActionPreference = "Stop"

# Get admin token
$tokenResponse = Invoke-RestMethod -Uri "http://localhost:8180/realms/master/protocol/openid-connect/token" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli"

$token = $tokenResponse.access_token
Write-Host "Got admin token"

# Client configuration
$clientJson = @{
    clientId = "cbp-frontend"
    name = "Customer Business Portal Frontend"
    description = "Customer Portal SPA (arc-saas/apps/customer-portal)"
    enabled = $true
    publicClient = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    directAccessGrantsEnabled = $true
    serviceAccountsEnabled = $false
    authorizationServicesEnabled = $false
    fullScopeAllowed = $true
    rootUrl = "http://localhost:27100"
    baseUrl = "/"
    redirectUris = @("http://localhost:27100/*", "http://localhost:27100/authentication/callback")
    webOrigins = @("http://localhost:27100", "+")
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients" `
        -Method POST `
        -Headers @{
            Authorization = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $clientJson
    Write-Host "Client 'cbp-frontend' created successfully!"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Client 'cbp-frontend' already exists"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
        Write-Host "Response: $($_.ErrorDetails.Message)"
        exit 1
    }
}

# Add protocol mappers for tenant_id
Write-Host "Adding protocol mappers..."

# Get client ID
$clients = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients?clientId=cbp-frontend" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

if ($clients.Count -gt 0) {
    $clientUuid = $clients[0].id
    Write-Host "Client UUID: $clientUuid"

    # Add tenant_id mapper
    $tenantMapper = @{
        name = "tenant-id-mapper"
        protocol = "openid-connect"
        protocolMapper = "oidc-usermodel-attribute-mapper"
        consentRequired = $false
        config = @{
            "userinfo.token.claim" = "true"
            "user.attribute" = "tenant_id"
            "id.token.claim" = "true"
            "access.token.claim" = "true"
            "claim.name" = "tenant_id"
            "jsonType.label" = "String"
        }
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/protocol-mappers/models" `
            -Method POST `
            -Headers @{
                Authorization = "Bearer $token"
                "Content-Type" = "application/json"
            } `
            -Body $tenantMapper
        Write-Host "Added tenant_id mapper"
    } catch {
        Write-Host "Mapper may already exist: $($_.ErrorDetails.Message)"
    }

    # Add tenant_key mapper
    $tenantKeyMapper = @{
        name = "tenant-key-mapper"
        protocol = "openid-connect"
        protocolMapper = "oidc-usermodel-attribute-mapper"
        consentRequired = $false
        config = @{
            "userinfo.token.claim" = "true"
            "user.attribute" = "tenant_key"
            "id.token.claim" = "true"
            "access.token.claim" = "true"
            "claim.name" = "tenant_key"
            "jsonType.label" = "String"
        }
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/protocol-mappers/models" `
            -Method POST `
            -Headers @{
                Authorization = "Bearer $token"
                "Content-Type" = "application/json"
            } `
            -Body $tenantKeyMapper
        Write-Host "Added tenant_key mapper"
    } catch {
        Write-Host "Mapper may already exist: $($_.ErrorDetails.Message)"
    }
}

Write-Host ""
Write-Host "Done! Client 'cbp-frontend' is now available in Keycloak."
Write-Host "Test URL: http://localhost:27100"
