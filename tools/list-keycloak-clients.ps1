# List Keycloak clients in ananta-saas realm
$ErrorActionPreference = "Stop"

$tokenResponse = Invoke-RestMethod -Uri "http://localhost:8180/realms/master/protocol/openid-connect/token" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli"

$token = $tokenResponse.access_token

$clients = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients?max=100" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "Keycloak Clients in ananta-saas realm:"
Write-Host "========================================"
foreach ($c in $clients | Sort-Object clientId) {
    # Skip internal Keycloak clients
    if (-not $c.clientId.StartsWith("account") -and $c.clientId -ne "realm-management" -and $c.clientId -ne "broker" -and $c.clientId -ne "security-admin-console") {
        $type = if ($c.publicClient) { "public" } else { "confidential" }
        $enabled = if ($c.enabled) { "enabled" } else { "disabled" }
        Write-Host "$($c.clientId) | $type | $enabled"
    }
}
