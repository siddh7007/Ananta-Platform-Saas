# Get Keycloak admin token and list users
$tokenResponse = Invoke-RestMethod -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin&grant_type=password&client_id=admin-cli'
$token = $tokenResponse.access_token
Write-Host "Token retrieved successfully"

# List users in tenant-demo realm
Write-Host "`n=== Users in tenant-demo realm ==="
try {
    $users = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/tenant-demo/users' -Headers @{Authorization="Bearer $token"}
    if ($users.Count -eq 0) {
        Write-Host "No users found in tenant-demo realm"
    } else {
        foreach ($user in $users) {
            Write-Host "  - Username: $($user.username), Email: $($user.email), ID: $($user.id)"
        }
    }
} catch {
    Write-Host "Error: $_"
}

# List users in arc-saas realm
Write-Host "`n=== Users in arc-saas realm ==="
try {
    $users = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/arc-saas/users' -Headers @{Authorization="Bearer $token"}
    if ($users.Count -eq 0) {
        Write-Host "No users found in arc-saas realm"
    } else {
        foreach ($user in $users) {
            Write-Host "  - Username: $($user.username), Email: $($user.email), ID: $($user.id)"
        }
    }
} catch {
    Write-Host "Error: $_"
}
