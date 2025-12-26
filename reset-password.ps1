# Get Keycloak admin token and reset password for demo user
$tokenResponse = Invoke-RestMethod -Uri 'http://localhost:8180/realms/master/protocol/openid-connect/token' -Method Post -ContentType 'application/x-www-form-urlencoded' -Body 'username=admin&password=admin&grant_type=password&client_id=admin-cli'
$token = $tokenResponse.access_token
Write-Host "Token retrieved successfully"

# Reset password for user in tenant-demo realm
$userId = "6a24740d-f052-4027-92a3-7629092a5e02"
$realm = "tenant-demo"

$body = @{
    type = "password"
    value = "demo123"
    temporary = $false
} | ConvertTo-Json

Write-Host "`nResetting password for demo@example.com in tenant-demo realm..."
try {
    Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/$realm/users/$userId/reset-password" -Method Put -Headers @{Authorization="Bearer $token"; "Content-Type"="application/json"} -Body $body
    Write-Host "Password reset successfully to: demo123"
} catch {
    Write-Host "Error: $_"
}

# Also reset password for admin in arc-saas realm
$userId2 = "409704f5-19b1-4bde-bcee-705a1c2d878a"
$realm2 = "arc-saas"

$body2 = @{
    type = "password"
    value = "admin123"
    temporary = $false
} | ConvertTo-Json

Write-Host "`nResetting password for admin in arc-saas realm..."
try {
    Invoke-RestMethod -Uri "http://localhost:8180/admin/realms/$realm2/users/$userId2/reset-password" -Method Put -Headers @{Authorization="Bearer $token"; "Content-Type"="application/json"} -Body $body2
    Write-Host "Password reset successfully to: admin123"
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n=== Login Credentials ==="
Write-Host "tenant-demo realm (http://localhost:8180/realms/tenant-demo):"
Write-Host "  Username: demo@example.com"
Write-Host "  Password: demo123"
Write-Host ""
Write-Host "arc-saas realm (http://localhost:8180/realms/arc-saas):"
Write-Host "  Username: admin"
Write-Host "  Password: admin123"
