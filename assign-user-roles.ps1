# Assign roles to platform users
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Get all users
$usersResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/users' -Headers $headers -UseBasicParsing
$users = $usersResponse.Content | ConvertFrom-Json

# Get all roles
$rolesResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/roles' -Headers $headers -UseBasicParsing
$roles = $rolesResponse.Content | ConvertFrom-Json

Write-Host "Available roles:"
$roles | ForEach-Object { Write-Host "  - $($_.name) (id: $($_.id))" }

Write-Host "`nUsers in ananta realm:"
$users | ForEach-Object { Write-Host "  - $($_.username) (id: $($_.id))" }

# Role assignments
$assignments = @{
    "cbp-admin" = "super_admin"
    "cns-staff" = "engineer"
    "owner" = "owner"
    "engineer" = "engineer"
    "demo-admin" = "super_admin"
}

foreach ($username in $assignments.Keys) {
    $roleName = $assignments[$username]
    $user = $users | Where-Object { $_.username -eq $username }
    $role = $roles | Where-Object { $_.name -eq $roleName }

    if ($user -and $role) {
        # Create role mapping JSON array
        $roleArray = '[{"id":"' + $role.id + '","name":"' + $role.name + '"}]'
        $uri = "http://localhost:8180/admin/realms/ananta/users/$($user.id)/role-mappings/realm"

        try {
            Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $roleArray -UseBasicParsing | Out-Null
            Write-Host "Assigned '$roleName' to '$username'"
        } catch {
            Write-Host "Error assigning '$roleName' to '$username': $($_.Exception.Message)"
        }
    } else {
        if (-not $user) { Write-Host "User '$username' not found" }
        if (-not $role) { Write-Host "Role '$roleName' not found" }
    }
}

Write-Host "`nDone!"
