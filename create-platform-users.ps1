# Create platform users for CBP Admin and CNS Staff
# Get token
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
Write-Host "Token obtained successfully"

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Create CBP Admin user (for Control Business Plane)
$cbpAdminUser = @{
    username = "cbp-admin"
    email = "cbp-admin@ananta.local"
    enabled = $true
    emailVerified = $true
    firstName = "CBP"
    lastName = "Admin"
    credentials = @(
        @{
            type = "password"
            value = "admin123"
            temporary = $false
        }
    )
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/users' -Method Post -Headers $headers -Body $cbpAdminUser -UseBasicParsing
    Write-Host "User cbp-admin created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User cbp-admin already exists"
    } else {
        Write-Host "Error creating cbp-admin: $($_.Exception.Message)"
    }
}

# Create CNS Staff user (for Component Normalization Service)
$cnsStaffUser = @{
    username = "cns-staff"
    email = "cns-staff@ananta.local"
    enabled = $true
    emailVerified = $true
    firstName = "CNS"
    lastName = "Staff"
    credentials = @(
        @{
            type = "password"
            value = "staff123"
            temporary = $false
        }
    )
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/users' -Method Post -Headers $headers -Body $cnsStaffUser -UseBasicParsing
    Write-Host "User cns-staff created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User cns-staff already exists"
    } else {
        Write-Host "Error creating cns-staff: $($_.Exception.Message)"
    }
}

# Create Owner user
$ownerUser = @{
    username = "owner"
    email = "owner@ananta.local"
    enabled = $true
    emailVerified = $true
    firstName = "Org"
    lastName = "Owner"
    credentials = @(
        @{
            type = "password"
            value = "owner123"
            temporary = $false
        }
    )
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/users' -Method Post -Headers $headers -Body $ownerUser -UseBasicParsing
    Write-Host "User owner created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User owner already exists"
    } else {
        Write-Host "Error creating owner: $($_.Exception.Message)"
    }
}

# Create Engineer user
$engineerUser = @{
    username = "engineer"
    email = "engineer@ananta.local"
    enabled = $true
    emailVerified = $true
    firstName = "Test"
    lastName = "Engineer"
    credentials = @(
        @{
            type = "password"
            value = "engineer123"
            temporary = $false
        }
    )
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/users' -Method Post -Headers $headers -Body $engineerUser -UseBasicParsing
    Write-Host "User engineer created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User engineer already exists"
    } else {
        Write-Host "Error creating engineer: $($_.Exception.Message)"
    }
}

# Assign roles to users
# First get user IDs
$users = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/users' -Headers $headers -UseBasicParsing
$userList = $users.Content | ConvertFrom-Json

# Get roles
$roles = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/roles' -Headers $headers -UseBasicParsing
$roleList = $roles.Content | ConvertFrom-Json

function Assign-Role($username, $roleName) {
    $user = $userList | Where-Object { $_.username -eq $username }
    $role = $roleList | Where-Object { $_.name -eq $roleName }

    if ($user -and $role) {
        $roleMapping = @(@{
            id = $role.id
            name = $role.name
        }) | ConvertTo-Json

        try {
            $uri = "http://localhost:8180/admin/realms/ananta/users/$($user.id)/role-mappings/realm"
            Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $roleMapping -UseBasicParsing | Out-Null
            Write-Host "Assigned role '$roleName' to user '$username'"
        } catch {
            Write-Host "Could not assign role '$roleName' to '$username': $($_.Exception.Message)"
        }
    }
}

# Assign roles
Assign-Role "cbp-admin" "super_admin"
Assign-Role "cns-staff" "engineer"
Assign-Role "owner" "owner"
Assign-Role "engineer" "engineer"

Write-Host "`nPlatform users created successfully!"
Write-Host "======================================"
Write-Host "Users available:"
Write-Host "  demo-admin / admin123    (super_admin) - Platform admin"
Write-Host "  cbp-admin / admin123     (super_admin) - CBP Admin"
Write-Host "  cns-staff / staff123     (engineer)    - CNS Staff"
Write-Host "  owner / owner123         (owner)       - Organization Owner"
Write-Host "  engineer / engineer123   (engineer)    - Engineer"
