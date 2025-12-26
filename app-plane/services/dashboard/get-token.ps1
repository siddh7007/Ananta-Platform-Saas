$body = @{
    username = "admin"
    password = "admin"
    grant_type = "password"
    client_id = "admin-cli"
}

$response = Invoke-RestMethod -Uri "http://localhost:8180/realms/master/protocol/openid-connect/token" `
    -Method POST `
    -Body $body `
    -ContentType "application/x-www-form-urlencoded"

Write-Output $response.access_token
