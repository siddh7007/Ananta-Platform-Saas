# Add redirect URI to cbp-frontend client
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
    Write-Host "Client cbp-frontend not found. Creating it..."

    $newClient = @{
        clientId = "cbp-frontend"
        name = "Customer Business Portal"
        description = "CBP frontend application (App Plane)"
        enabled = $true
        publicClient = $true
        standardFlowEnabled = $true
        directAccessGrantsEnabled = $true
        rootUrl = "http://localhost:27100"
        redirectUris = @(
            "http://localhost:27100/*",
            "http://localhost:27400/*",
            "http://localhost:3000/*",
            "http://localhost:5173/*"
        )
        webOrigins = @(
            "http://localhost:27100",
            "http://localhost:27400",
            "http://localhost:3000",
            "http://localhost:5173",
            "+"
        )
        defaultClientScopes = @("openid", "web-origins", "acr", "profile", "roles", "email")
        optionalClientScopes = @("address", "phone", "offline_access")
    } | ConvertTo-Json -Depth 5

    try {
        $createResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients' -Method Post -Headers $headers -Body $newClient -UseBasicParsing
        Write-Host "Client cbp-frontend created successfully"
    } catch {
        Write-Host "Error creating client: $($_.Exception.Message)"
    }
} else {
    $client = $clients[0]
    Write-Host "Found cbp-frontend client: $($client.id)"

    # Update redirect URIs
    $client.redirectUris = @(
        "http://localhost:27100/*",
        "http://localhost:27400/*",
        "http://localhost:3000/*",
        "http://localhost:5173/*"
    )
    $client.webOrigins = @(
        "http://localhost:27100",
        "http://localhost:27400",
        "http://localhost:3000",
        "http://localhost:5173",
        "+"
    )
    $client.rootUrl = "http://localhost:27100"

    $updateBody = $client | ConvertTo-Json -Depth 10

    try {
        $updateResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$($client.id)" -Method Put -Headers $headers -Body $updateBody -UseBasicParsing
        Write-Host "Client cbp-frontend updated successfully with redirect URI http://localhost:27100/*"
    } catch {
        Write-Host "Error updating client: $($_.Exception.Message)"
    }
}

Write-Host "`nDone! Try logging in again at http://localhost:27100"
