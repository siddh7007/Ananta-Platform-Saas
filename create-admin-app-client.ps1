Add-Type -AssemblyName System.Web

$password = 't)ZgVdZd8Vy91pvmZf&#0Cl&'
$encodedPw = [System.Web.HttpUtility]::UrlEncode($password)
$body = "client_id=admin-cli&username=admin&password=$encodedPw&grant_type=password"

$tokenResponse = Invoke-RestMethod -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body $body
$token = $tokenResponse.access_token
Write-Host "Got admin token successfully"

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Create admin-app client in ananta-saas realm
$clientJson = @{
    clientId = "admin-app"
    name = "Admin App"
    description = "Admin application for platform management"
    enabled = $true
    publicClient = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    directAccessGrantsEnabled = $true
    serviceAccountsEnabled = $false
    authorizationServicesEnabled = $false
    fullScopeAllowed = $true
    rootUrl = "http://localhost:27700"
    baseUrl = "http://localhost:27700"
    redirectUris = @(
        "http://localhost:27555/*"
        "http://localhost:27700/*"
        "http://localhost:3000/*"
        "http://localhost:5173/*"
        "http://127.0.0.1:*/*"
    )
    webOrigins = @(
        "http://localhost:27555"
        "http://localhost:27700"
        "http://localhost:3000"
        "http://localhost:5173"
        "http://127.0.0.1"
        "+"
    )
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients' -Headers $headers -Method Post -Body $clientJson
    Write-Host "Client admin-app created successfully in ananta-saas realm!"
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Client admin-app already exists"
    } else {
        Write-Host "Error: $_"
        Write-Host $_.Exception.Message
    }
}

# Verify client exists
$clients = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/ananta-saas/clients' -Headers $headers
$adminClient = $clients | Where-Object { $_.clientId -eq 'admin-app' }
if ($adminClient) {
    Write-Host "Verified: Client admin-app exists with ID: $($adminClient.id)"
} else {
    Write-Host "ERROR: Client admin-app NOT found after creation!"
}
