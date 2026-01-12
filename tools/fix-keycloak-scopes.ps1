# Fix Keycloak client scopes - add missing profile and email scopes
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

# Create profile scope
$profileScope = @{
    name = "profile"
    description = "OpenID Connect built-in scope: profile"
    protocol = "openid-connect"
    attributes = @{
        "include.in.token.scope" = "true"
        "display.on.consent.screen" = "true"
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/client-scopes" `
        -Method POST -Headers $headers -Body $profileScope
    Write-Host "Created 'profile' scope"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "'profile' scope already exists"
    } else {
        Write-Host "Error creating profile scope: $($_.ErrorDetails.Message)"
    }
}

# Create email scope
$emailScope = @{
    name = "email"
    description = "OpenID Connect built-in scope: email"
    protocol = "openid-connect"
    attributes = @{
        "include.in.token.scope" = "true"
        "display.on.consent.screen" = "true"
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/client-scopes" `
        -Method POST -Headers $headers -Body $emailScope
    Write-Host "Created 'email' scope"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "'email' scope already exists"
    } else {
        Write-Host "Error creating email scope: $($_.ErrorDetails.Message)"
    }
}

# Get all client scopes to find their IDs
$scopes = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/client-scopes" `
    -Method GET -Headers $headers

$profileScopeId = ($scopes | Where-Object { $_.name -eq "profile" }).id
$emailScopeId = ($scopes | Where-Object { $_.name -eq "email" }).id

Write-Host "Profile scope ID: $profileScopeId"
Write-Host "Email scope ID: $emailScopeId"

# Get cbp-frontend client
$clients = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients?clientId=cbp-frontend" `
    -Method GET -Headers $headers

if ($clients.Count -gt 0) {
    $clientUuid = $clients[0].id
    Write-Host "cbp-frontend client UUID: $clientUuid"

    # Add profile as default scope
    if ($profileScopeId) {
        try {
            Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/default-client-scopes/$profileScopeId" `
                -Method PUT -Headers $headers
            Write-Host "Added 'profile' scope to cbp-frontend"
        } catch {
            Write-Host "Could not add profile scope: $($_.ErrorDetails.Message)"
        }
    }

    # Add email as default scope
    if ($emailScopeId) {
        try {
            Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid/default-client-scopes/$emailScopeId" `
                -Method PUT -Headers $headers
            Write-Host "Added 'email' scope to cbp-frontend"
        } catch {
            Write-Host "Could not add email scope: $($_.ErrorDetails.Message)"
        }
    }
} else {
    Write-Host "cbp-frontend client not found!"
}

# Also add to ananta-saas-customer-portal client
$clients2 = Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients?clientId=ananta-saas-customer-portal" `
    -Method GET -Headers $headers

if ($clients2.Count -gt 0) {
    $clientUuid2 = $clients2[0].id
    Write-Host "ananta-saas-customer-portal client UUID: $clientUuid2"

    if ($profileScopeId) {
        try {
            Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid2/default-client-scopes/$profileScopeId" `
                -Method PUT -Headers $headers
            Write-Host "Added 'profile' scope to ananta-saas-customer-portal"
        } catch {
            Write-Host "Could not add profile scope: $($_.ErrorDetails.Message)"
        }
    }

    if ($emailScopeId) {
        try {
            Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/ananta-saas/clients/$clientUuid2/default-client-scopes/$emailScopeId" `
                -Method PUT -Headers $headers
            Write-Host "Added 'email' scope to ananta-saas-customer-portal"
        } catch {
            Write-Host "Could not add email scope: $($_.ErrorDetails.Message)"
        }
    }
}

Write-Host ""
Write-Host "Done! Try logging in again."
