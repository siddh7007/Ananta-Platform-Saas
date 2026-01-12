# Get token
$tokenResponse = Invoke-WebRequest -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin123&grant_type=password&client_id=admin-cli' -UseBasicParsing
$token = ($tokenResponse.Content | ConvertFrom-Json).access_token
Write-Host "Token obtained successfully"

# Create realm
$realmJson = @{
    realm = "ananta"
    enabled = $true
    displayName = "Ananta Platform"
    sslRequired = "external"
    registrationAllowed = $true
    loginWithEmailAllowed = $true
    duplicateEmailsAllowed = $false
    defaultSignatureAlgorithm = "RS256"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms' -Method Post -Headers @{Authorization="Bearer $token"; 'Content-Type'='application/json'} -Body $realmJson -UseBasicParsing
    Write-Host "Realm created successfully: HTTP $($response.StatusCode)"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Realm already exists"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
    }
}

# Create admin-app client
$clientJson = @{
    clientId = "admin-app"
    enabled = $true
    publicClient = $true
    directAccessGrantsEnabled = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    redirectUris = @("http://localhost:27555/*", "http://localhost:14000/*")
    webOrigins = @("http://localhost:27555", "http://localhost:14000", "+")
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/clients' -Method Post -Headers @{Authorization="Bearer $token"; 'Content-Type'='application/json'} -Body $clientJson -UseBasicParsing
    Write-Host "Client admin-app created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Client already exists"
    } else {
        Write-Host "Error creating client: $($_.Exception.Message)"
    }
}

# Create customer-portal client
$customerClientJson = @{
    clientId = "customer-portal"
    enabled = $true
    publicClient = $true
    directAccessGrantsEnabled = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    redirectUris = @("http://localhost:27100/*")
    webOrigins = @("http://localhost:27100", "+")
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/clients' -Method Post -Headers @{Authorization="Bearer $token"; 'Content-Type'='application/json'} -Body $customerClientJson -UseBasicParsing
    Write-Host "Client customer-portal created successfully"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Client already exists"
    } else {
        Write-Host "Error creating client: $($_.Exception.Message)"
    }
}

# Create roles
$roles = @("super_admin", "owner", "admin", "engineer", "analyst")
foreach ($role in $roles) {
    $roleJson = @{ name = $role } | ConvertTo-Json
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/roles' -Method Post -Headers @{Authorization="Bearer $token"; 'Content-Type'='application/json'} -Body $roleJson -UseBasicParsing
        Write-Host "Role $role created"
    } catch {
        Write-Host "Role $role may already exist or error occurred"
    }
}

# Create demo admin user
$userJson = @{
    username = "demo-admin"
    email = "admin@ananta.local"
    enabled = $true
    emailVerified = $true
    firstName = "Demo"
    lastName = "Admin"
    credentials = @(
        @{
            type = "password"
            value = "admin123"
            temporary = $false
        }
    )
    realmRoles = @("super_admin")
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:8180/admin/realms/ananta/users' -Method Post -Headers @{Authorization="Bearer $token"; 'Content-Type'='application/json'} -Body $userJson -UseBasicParsing
    Write-Host "Demo admin user created successfully"
} catch {
    Write-Host "Error creating user (may already exist): $($_.Exception.Message)"
}

Write-Host "Keycloak ananta realm setup complete!"
