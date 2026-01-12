Add-Type -AssemblyName System.Web

$password = 't)ZgVdZd8Vy91pvmZf&#0Cl&'
$encodedPw = [System.Web.HttpUtility]::UrlEncode($password)
$body = "client_id=admin-cli&username=admin&password=$encodedPw&grant_type=password"

$tokenResponse = Invoke-RestMethod -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body $body
$token = $tokenResponse.access_token

$headers = @{ 'Authorization' = "Bearer $token" }

# List users in ananta-saas realm
Write-Host "Users in ananta-saas realm:"
$users = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/ananta-saas/users' -Headers $headers
$users | ForEach-Object {
    Write-Host "Username: $($_.username), Email: $($_.email), Enabled: $($_.enabled)"
}

# List clients in ananta-saas realm
Write-Host "`nClients:"
$clients = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients' -Headers $headers
$clients | Where-Object { $_.clientId -like 'ananta-*' } | ForEach-Object {
    Write-Host "  ClientId: $($_.clientId), Enabled: $($_.enabled)"
}
