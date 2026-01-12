# List clients in ananta-saas realm
$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"

$tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

Write-Host "=== Clients in '$realm' realm ===" -ForegroundColor Cyan
$clientsResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients" `
    -Headers @{"Authorization" = "Bearer $token"} -UseBasicParsing
$clients = $clientsResponse.Content | ConvertFrom-Json
$clients | ForEach-Object { Write-Host "  - $($_.clientId) (public: $($_.publicClient))" }
