# Add profile and email scopes to ALL Keycloak clients
$ErrorActionPreference = "Stop"

# Get admin token
$tokenResponse = Invoke-RestMethod -Uri "http://localhost:8180/realms/master/protocol/openid-connect/token" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli"

$token = $tokenResponse.access_token
Write-Host "Got admin token"

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# Get all client scopes to find profile and email IDs
$scopes = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/client-scopes" `
    -Method GET -Headers $headers

$profileScopeId = ($scopes | Where-Object { $_.name -eq "profile" }).id
$emailScopeId = ($scopes | Where-Object { $_.name -eq "email" }).id
$rolesScopeId = ($scopes | Where-Object { $_.name -eq "roles" }).id

Write-Host "Profile scope ID: $profileScopeId"
Write-Host "Email scope ID: $emailScopeId"
Write-Host "Roles scope ID: $rolesScopeId"

if (-not $profileScopeId -or -not $emailScopeId) {
    Write-Host "ERROR: profile or email scope not found. Run fix-keycloak-scopes.ps1 first."
    exit 1
}

# Client IDs to update (all portals)
$clientIds = @(
    "admin-app",                    # Control Plane Admin (Refine)
    "ananta-saas-admin",            # Legacy admin client
    "ananta-saas-api",              # Backend API (confidential)
    "ananta-saas-customer-portal",  # Legacy CBP client
    "cbp-frontend"                  # CBP - Customer Business Portal (Refine)
)

foreach ($clientId in $clientIds) {
    $clients = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients?clientId=$clientId" `
        -Method GET -Headers $headers

    if ($clients.Count -gt 0) {
        $clientUuid = $clients[0].id
        Write-Host ""
        Write-Host "Processing $clientId (UUID: $clientUuid)"

        # Add profile scope
        try {
            Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/default-client-scopes/$profileScopeId" `
                -Method PUT -Headers $headers
            Write-Host "  + Added 'profile' scope"
        } catch {
            Write-Host "  - profile scope: $($_.ErrorDetails.Message)"
        }

        # Add email scope
        try {
            Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/default-client-scopes/$emailScopeId" `
                -Method PUT -Headers $headers
            Write-Host "  + Added 'email' scope"
        } catch {
            Write-Host "  - email scope: $($_.ErrorDetails.Message)"
        }

        # Add roles scope
        if ($rolesScopeId) {
            try {
                Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/default-client-scopes/$rolesScopeId" `
                    -Method PUT -Headers $headers
                Write-Host "  + Added 'roles' scope"
            } catch {
                Write-Host "  - roles scope: $($_.ErrorDetails.Message)"
            }
        }
    } else {
        Write-Host "Client '$clientId' not found"
    }
}

Write-Host ""
Write-Host "Done! All clients now have profile, email, and roles scopes."
