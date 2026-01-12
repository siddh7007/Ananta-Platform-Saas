# Import Keycloak realm via REST API
Add-Type -AssemblyName System.Web

# Read password from secret (already decoded)
$password = 't)ZgVdZd8Vy91pvmZf&#0Cl&'
$encodedPw = [System.Web.HttpUtility]::UrlEncode($password)

# Get admin token
$tokenUrl = 'http://localhost:8180/realms/master/protocol/openid-connect/token'
$body = "client_id=admin-cli&username=admin&password=$encodedPw&grant_type=password"

try {
    $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -ContentType 'application/x-www-form-urlencoded' -Body $body
    $token = $tokenResponse.access_token
    Write-Host "Got admin token successfully"

    # Check if realm already exists
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }

    try {
        $existingRealm = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms/arc-saas' -Headers $headers -Method Get
        Write-Host "Realm arc-saas already exists"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "Realm does not exist, creating..."

            # Read realm JSON
            $realmJson = Get-Content -Path 'realm-temp.json' -Raw

            # Import realm
            $importResponse = Invoke-RestMethod -Uri 'http://localhost:8180/admin/realms' -Headers $headers -Method Post -Body $realmJson
            Write-Host "Realm arc-saas imported successfully!"
        } else {
            throw $_
        }
    }
} catch {
    Write-Host "Error: $_"
    Write-Host $_.Exception.Message
}
