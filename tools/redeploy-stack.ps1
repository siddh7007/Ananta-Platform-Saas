param(
    [string]$StackNumber = "1"
)

$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
    'Content-Type' = 'application/json'
}

$baseUrl = 'http://172.25.76.67:8000/api/v1'

# Application UUIDs
$apps = @{
    '1' = @{ name = 'Stack1-Core'; uuid = 'dsw0gog8sswc08s8ss088ssw' }
    '2' = @{ name = 'Stack2-Novu'; uuid = 'e0ocw8s0wkc48c4008wgo4co' }
    '3' = @{ name = 'Stack3-AppInfra'; uuid = 'ykkck88s4ck4gcgsgso4c4so' }
    '4' = @{ name = 'Stack4-AppServices'; uuid = 'a4840csk44gwocw0g484ss84' }
}

if (-not $apps.ContainsKey($StackNumber)) {
    Write-Host "Invalid stack number. Use 1, 2, 3, or 4" -ForegroundColor Red
    exit 1
}

$app = $apps[$StackNumber]
Write-Host "=== Redeploying $($app.name) ($($app.uuid)) ===" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/applications/$($app.uuid)/restart" -Method Post -Headers $headers
    Write-Host "Restart triggered!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Trying deploy endpoint..."
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/applications/$($app.uuid)/deploy" -Method Post -Headers $headers
        Write-Host "Deploy triggered!" -ForegroundColor Green
        Write-Host "Response: $($response | ConvertTo-Json -Compress)"
    } catch {
        Write-Host "Deploy error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
