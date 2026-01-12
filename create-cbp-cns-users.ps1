# Create cbpadmin and cnsstaff users
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
Write-Host "Token obtained successfully"

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Create cbpadmin user
$cbpadminUser = @{
    username = "cbpadmin"
    email = "cbpadmin@ananta.dev"
    enabled = $true
    emailVerified = $true
    firstName = "CBP"
    lastName = "Admin"
    credentials = @(
        @{
            type = "password"
            value = "Test123!"
            temporary = $false
        }
    )
    attributes = @{
        tenant_id = @("a0000000-0000-0000-0000-000000000001")
        tenant_key = @("platform")
    }
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/users' -Method Post -Headers $headers -Body $cbpadminUser -UseBasicParsing
    Write-Host "User cbpadmin created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User cbpadmin already exists"
    } else {
        Write-Host "Error creating cbpadmin: $($_.Exception.Message)"
    }
}

# Create cnsstaff user
$cnsstaffUser = @{
    username = "cnsstaff"
    email = "cnsstaff@ananta.dev"
    enabled = $true
    emailVerified = $true
    firstName = "CNS"
    lastName = "Staff"
    credentials = @(
        @{
            type = "password"
            value = "Test123!"
            temporary = $false
        }
    )
    attributes = @{
        tenant_id = @("a0000000-0000-0000-0000-000000000002")
        tenant_key = @("cns-staff")
    }
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/users' -Method Post -Headers $headers -Body $cnsstaffUser -UseBasicParsing
    Write-Host "User cnsstaff created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User cnsstaff already exists"
    } else {
        Write-Host "Error creating cnsstaff: $($_.Exception.Message)"
    }
}

# Get users and assign roles
$usersResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/users' -Headers $headers -UseBasicParsing
$users = $usersResponse.Content | ConvertFrom-Json

$rolesResponse = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta-saas/roles' -Headers $headers -UseBasicParsing
$roles = $rolesResponse.Content | ConvertFrom-Json

# Assign super_admin to cbpadmin
$cbpadminUserObj = $users | Where-Object { $_.username -eq "cbpadmin" }
$superAdminRole = $roles | Where-Object { $_.name -eq "super_admin" }

if ($cbpadminUserObj -and $superAdminRole) {
    $roleArray = '[{"id":"' + $superAdminRole.id + '","name":"' + $superAdminRole.name + '"}]'
    $uri = "http://localhost:8180/admin/realms/ananta-saas/users/$($cbpadminUserObj.id)/role-mappings/realm"
    try {
        Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $roleArray -UseBasicParsing | Out-Null
        Write-Host "Assigned 'super_admin' to cbpadmin"
    } catch {
        Write-Host "Could not assign role to cbpadmin: $($_.Exception.Message)"
    }
}

# Assign engineer to cnsstaff
$cnsstaffUserObj = $users | Where-Object { $_.username -eq "cnsstaff" }
$engineerRole = $roles | Where-Object { $_.name -eq "engineer" }

if ($cnsstaffUserObj -and $engineerRole) {
    $roleArray = '[{"id":"' + $engineerRole.id + '","name":"' + $engineerRole.name + '"}]'
    $uri = "http://localhost:8180/admin/realms/ananta-saas/users/$($cnsstaffUserObj.id)/role-mappings/realm"
    try {
        Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $roleArray -UseBasicParsing | Out-Null
        Write-Host "Assigned 'engineer' to cnsstaff"
    } catch {
        Write-Host "Could not assign role to cnsstaff: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "=============================================="
Write-Host "Users Created:"
Write-Host "=============================================="
Write-Host "  cbpadmin / Test123!   (super_admin) - CBP Admin"
Write-Host "  cnsstaff / Test123!   (engineer)    - CNS Staff"
Write-Host ""
Write-Host "Realm: ananta-saas"
Write-Host "=============================================="
