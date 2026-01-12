# Decode cbpadmin JWT token
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

# Decode JWT (split by . and decode base64)
$parts = $token.Split('.')
$base64 = $parts[1]
# Add padding if needed
while ($base64.Length % 4 -ne 0) { $base64 += "=" }
# Replace URL-safe characters
$base64 = $base64.Replace('-', '+').Replace('_', '/')
$payload = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($base64))

Write-Host "JWT Payload:" -ForegroundColor Cyan
$payload | ConvertFrom-Json | ConvertTo-Json -Depth 5
