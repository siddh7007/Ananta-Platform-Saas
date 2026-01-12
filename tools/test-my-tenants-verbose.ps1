# Test /tenants/my-tenants API endpoint with verbose output
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

Write-Host "Testing GET /tenants/my-tenants..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:14000/tenants/my-tenants" `
        -Headers @{Authorization="Bearer $token"} `
        -ErrorAction Stop

    Write-Host "SUCCESS: API returned $($response.Count) tenant(s)" -ForegroundColor Green
    foreach ($tenant in $response) {
        Write-Host "  - ID: $($tenant.id)" -ForegroundColor Yellow
        Write-Host "    Name: $($tenant.name)" -ForegroundColor Yellow
        Write-Host "    Key: $($tenant.key)" -ForegroundColor Yellow
        Write-Host "    Status: $($tenant.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}
