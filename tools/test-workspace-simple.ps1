# Simple test for workspace API
$tokenResp = Invoke-RestMethod -Uri "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" -Method Post -Body @{client_id='cbp-frontend';grant_type='password';username='cbpadmin';password='Test123!'} -ContentType 'application/x-www-form-urlencoded'

Write-Host "Token obtained" -ForegroundColor Green

$response = Invoke-RestMethod -Uri "http://localhost:27200/api/workspaces?organization_id=b0000000-0000-4000-a000-000000000001" -Headers @{Authorization="Bearer $($tokenResp.access_token)"}

Write-Host "Response:" -ForegroundColor Yellow
$response | ConvertTo-Json -Depth 5
