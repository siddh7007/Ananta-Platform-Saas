# List Keycloak users
$ErrorActionPreference = "Stop"

$tokenResponse = Invoke-RestMethod -Uri "http://localhost:8180/realms/master/protocol/openid-connect/token" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli"

$token = $tokenResponse.access_token

$users = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/users?max=50" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "Keycloak Users in ananta-saas realm:"
Write-Host "====================================="
foreach ($u in $users) {
    $tenantId = if ($u.attributes.tenant_id) { $u.attributes.tenant_id[0] } else { "N/A" }
    $tenantKey = if ($u.attributes.tenant_key) { $u.attributes.tenant_key[0] } else { "N/A" }
    Write-Host "$($u.id) | $($u.email) | tenant=$tenantKey"
}
Write-Host ""
Write-Host "Total: $($users.Count) users"
