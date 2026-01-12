# Create admin-app client in Keycloak
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
    clientId = "admin-app"
    name = "Admin App (Default)"
    description = "Admin application using default client ID (arc-saas/apps/admin-app)"
    enabled = $true
    publicClient = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    directAccessGrantsEnabled = $true
    serviceAccountsEnabled = $false
    authorizationServicesEnabled = $false
    fullScopeAllowed = $true
    rootUrl = "http://localhost:27555"
    baseUrl = "/"
    redirectUris = @("http://localhost:27555/*", "http://localhost:27555/authentication/callback", "http://localhost:14000/*", "http://localhost:3000/*")
    webOrigins = @("http://localhost:27555", "http://localhost:14000", "http://localhost:3000", "+")
    defaultClientScopes = @("web-origins", "acr", "profile", "roles", "email", "tenant")
    optionalClientScopes = @("address", "phone", "offline_access", "microprofile-jwt")
} | ConvertTo-Json -Depth 10

try {
    $result = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients" `
        -Method POST `
        -Headers @{
            Authorization = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $clientJson
    Write-Host "Client 'admin-app' created successfully!"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Client 'admin-app' already exists"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
        Write-Host "Response: $($_.ErrorDetails.Message)"
        exit 1
    }
}

# Add protocol mappers
Write-Host "Adding protocol mappers..."

# Get client ID
$clients = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients?clientId=admin-app" `
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

    # Add audience mapper
    $audienceMapper = @{
        name = "audience-mapper"
        protocol = "openid-connect"
        protocolMapper = "oidc-audience-mapper"
        consentRequired = $false
        config = @{
            "included.client.audience" = "admin-app"
            "id.token.claim" = "true"
            "access.token.claim" = "true"
        }
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/protocol-mappers/models" `
            -Method POST `
            -Headers @{
                Authorization = "Bearer $token"
                "Content-Type" = "application/json"
            } `
            -Body $audienceMapper
        Write-Host "Added audience mapper"
    } catch {
        Write-Host "Mapper may already exist: $($_.ErrorDetails.Message)"
    }
}

Write-Host ""
Write-Host "Done! Client 'admin-app' is now available in Keycloak."
Write-Host "Test URL: http://localhost:27555"
