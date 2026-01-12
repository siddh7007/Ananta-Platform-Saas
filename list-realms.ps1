# List all Keycloak realms and check cbp-frontend client
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

$headers = @{ 'Authorization' = "Bearer $token" }

# List all realms
$realmsResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms' -Headers $headers -UseBasicParsing
$realms = $realmsResponse.Content | ConvertFrom-Json

Write-Host "Available realms:"
$realms | ForEach-Object { Write-Host "  - $($_.realm) (id: $($_.id))" }

# Check cbp-frontend client in each non-master realm
$realms | Where-Object { $_.realm -ne 'master' } | ForEach-Object {
    $realmName = $_.realm
    Write-Host ""
    Write-Host "Checking cbp-frontend in realm: $realmName"
    try {
        $clientsResponse = Invoke-WebRequest -Uri "http://localhost:8180/admin/realms/$realmName/clients?clientId=cbp-frontend" -Headers $headers -UseBasicParsing
        $clients = $clientsResponse.Content | ConvertFrom-Json
        if ($clients.Count -eq 0) {
            Write-Host "  Not found"
        } else {
            $client = $clients[0]
            Write-Host "  Found! ID: $($client.id)"
            Write-Host "  RedirectUris: $($client.redirectUris -join ', ')"
        }
    } catch {
        Write-Host "  Error: $($_.Exception.Message)"
    }
}
