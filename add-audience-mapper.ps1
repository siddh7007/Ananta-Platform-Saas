# Add audience mapper to cbp-frontend client
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
Write-Host "Token obtained successfully"

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Get the cbp-frontend client
$clientsResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients?clientId=cbp-frontend' -Headers $headers -UseBasicParsing
$clients = $clientsResponse.Content | ConvertFrom-Json

if ($clients.Count -eq 0) {
    Write-Host "Client cbp-frontend not found!"
    exit 1
}

$clientId = $clients[0].id
Write-Host "Found cbp-frontend client: $clientId"

# Check existing protocol mappers
Write-Host ""
Write-Host "Checking existing protocol mappers..."
$mappersResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientId/protocol-mappers/models" -Headers $headers -UseBasicParsing
$mappers = $mappersResponse.Content | ConvertFrom-Json

$audienceMapper = $mappers | Where-Object { $_.name -eq 'audience-mapper' }
if ($audienceMapper) {
    Write-Host "Audience mapper already exists, updating..."
    $mapperBody = @{
        id = $audienceMapper.id
        name = "audience-mapper"
        protocol = "openid-connect"
        protocolMapper = "oidc-audience-mapper"
        consentRequired = $false
        config = @{
            "included.client.audience" = "cbp-frontend"
            "id.token.claim" = "true"
            "access.token.claim" = "true"
            "introspection.token.claim" = "true"
        }
    } | ConvertTo-Json -Depth 5

    try {
        $updateResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientId/protocol-mappers/models/$($audienceMapper.id)" -Method Put -Headers $headers -Body $mapperBody -UseBasicParsing
        Write-Host "Audience mapper updated successfully"
    } catch {
        Write-Host "Error updating mapper: $($_.Exception.Message)"
    }
} else {
    Write-Host "Creating new audience mapper..."
    $mapperBody = @{
        name = "audience-mapper"
        protocol = "openid-connect"
        protocolMapper = "oidc-audience-mapper"
        consentRequired = $false
        config = @{
            "included.client.audience" = "cbp-frontend"
            "id.token.claim" = "true"
            "access.token.claim" = "true"
            "introspection.token.claim" = "true"
        }
    } | ConvertTo-Json -Depth 5

    try {
        $createResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientId/protocol-mappers/models" -Method Post -Headers $headers -Body $mapperBody -UseBasicParsing
        Write-Host "Audience mapper created successfully"
    } catch {
        Write-Host "Error creating mapper: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Done! The cbp-frontend audience will now be included in tokens."
Write-Host "Please log out and log back in to get a new token with the audience claim."
