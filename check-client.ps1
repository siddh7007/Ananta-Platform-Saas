Add-Type -AssemblyName System.Web

$password = 't)ZgVdZd8Vy91pvmZf&#0Cl&'
$encodedPw = [System.Web.HttpUtility]::UrlEncode($password)
$body = "client_id=admin-cli&username=admin&password=$encodedPw&grant_type=password"

$tokenResponse = Invoke-RestMethod -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body $body
$token = $tokenResponse.access_token

$headers = @{ 'Authorization' = "Bearer $token" }

# Get client details
$clients = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients' -Headers $headers
$adminClient = $clients | Where-Object { $_.clientId -eq 'ananta-saas-admin' }

if ($adminClient) {
    Write-Host "Found client: $($adminClient.clientId)"
    Write-Host "Client ID (internal): $($adminClient.id)"
    Write-Host "Root URL: $($adminClient.rootUrl)"
    Write-Host "Redirect URIs: $($adminClient.redirectUris -join ', ')"
    Write-Host "Web Origins: $($adminClient.webOrigins -join ', ')"
} else {
    Write-Host "Client ananta-saas-admin NOT FOUND!"
    Write-Host "Available clients:"
    $clients | ForEach-Object { Write-Host "  - $($_.clientId)" }
}
