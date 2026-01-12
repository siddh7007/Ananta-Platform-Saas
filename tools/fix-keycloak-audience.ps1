# Fix Keycloak cbp-frontend client to include audience claim in tokens
# This adds a "hardcoded audience" protocol mapper to the client

$keycloakUrl = "http://localhost:8180"
$realm = "ananta-saas"
$clientId = "customer-portal"

Write-Host "=== Fixing Keycloak Audience Mapper for $clientId ===" -ForegroundColor Cyan

# Step 1: Get admin token
Write-Host "`n[1/4] Getting admin token..." -ForegroundColor Yellow
try {
    $tokenResponse = Invoke-WebRequest -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "username=admin&password=admin123&grant_type=password&client_id=admin-cli" `
        -UseBasicParsing
    $token = ($tokenResponse.Content | ConvertFrom-Json).access_token
    Write-Host "  Token acquired successfully" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to get admin token: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 2: Get client UUID
Write-Host "`n[2/4] Finding $clientId client UUID..." -ForegroundColor Yellow
try {
    $clientsResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients?clientId=$clientId" `
        -Headers $headers `
        -UseBasicParsing
    $clients = $clientsResponse.Content | ConvertFrom-Json

    if ($clients.Count -eq 0) {
        Write-Host "  ERROR: Client '$clientId' not found in realm '$realm'" -ForegroundColor Red
        exit 1
    }

    $clientUuid = $clients[0].id
    Write-Host "  Found client UUID: $clientUuid" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to find client: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Check existing protocol mappers
Write-Host "`n[3/4] Checking existing protocol mappers..." -ForegroundColor Yellow
try {
    $mappersResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/protocol-mappers/models" `
        -Headers $headers `
        -UseBasicParsing
    $mappers = $mappersResponse.Content | ConvertFrom-Json

    $existingAudMapper = $mappers | Where-Object { $_.name -eq "audience-mapper" }
    if ($existingAudMapper) {
        Write-Host "  Audience mapper already exists, deleting to recreate..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/protocol-mappers/models/$($existingAudMapper.id)" `
            -Method Delete `
            -Headers $headers `
            -UseBasicParsing | Out-Null
        Write-Host "  Deleted old mapper" -ForegroundColor Green
    } else {
        Write-Host "  No existing audience mapper found" -ForegroundColor Green
    }
} catch {
    Write-Host "  Warning: Could not check existing mappers: $_" -ForegroundColor Yellow
}

# Step 4: Create audience mapper
Write-Host "`n[4/4] Creating audience mapper..." -ForegroundColor Yellow

$mapperConfig = @{
    name = "audience-mapper"
    protocol = "openid-connect"
    protocolMapper = "oidc-audience-mapper"
    config = @{
        "included.client.audience" = $clientId
        "id.token.claim" = "true"
        "access.token.claim" = "true"
    }
} | ConvertTo-Json -Depth 3

try {
    $createResponse = Invoke-WebRequest -Uri "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/protocol-mappers/models" `
        -Method Post `
        -Headers $headers `
        -Body $mapperConfig `
        -UseBasicParsing
    Write-Host "  Audience mapper created successfully!" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to create mapper: $_" -ForegroundColor Red
    Write-Host "  Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
Write-Host "The $clientId client now includes '$clientId' in the 'aud' claim of tokens."
Write-Host "Please refresh the browser to get a new token with the audience claim."
