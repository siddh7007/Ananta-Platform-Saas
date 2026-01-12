# Test CNS Service /api/workspaces endpoint with Keycloak token
$tokenResp = Invoke-RestMethod -Uri "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" `
    -Method Post `
    -Body @{
        client_id='cbp-frontend'
        grant_type='password'
        username='cbpadmin'
        password='Test123!'
    } `
    -ContentType 'application/x-www-form-urlencoded'

$token = $tokenResp.access_token
Write-Host "Token obtained for cbpadmin" -ForegroundColor Green

Write-Host "Testing GET /api/workspaces..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:27200/api/workspaces?organization_id=b0000000-0000-4000-a000-000000000001" `
        -Headers @{Authorization="Bearer $token"} `
        -ErrorAction Stop

    Write-Host "SUCCESS: API returned $($response.Count) workspace(s)" -ForegroundColor Green
    foreach ($workspace in $response) {
        Write-Host "  - ID: $($workspace.id)" -ForegroundColor Yellow
        Write-Host "    Name: $($workspace.name)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
