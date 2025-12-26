# Quick token fetch and test script
param(
    [string]$BomId = "ffaac87c-d3de-4b31-ba1a-839786f0e089"
)

$ErrorActionPreference = "Stop"

# Get token
$body = @{
    username = "cnsstaff"
    password = "Test123!"
    grant_type = "password"
    client_id = "admin-cli"
}

Write-Host "Getting token from Keycloak..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" `
    -Method Post -ContentType "application/x-www-form-urlencoded" -Body $body

$token = $response.access_token
Write-Host "Token obtained (expires in $($response.expires_in) seconds)" -ForegroundColor Green

# Save token for other scripts
$token | Out-File -FilePath "$PSScriptRoot\current_token.txt" -NoNewline
Write-Host "Token saved to: $PSScriptRoot\current_token.txt" -ForegroundColor Gray

# Test headers
$headers = @{
    Authorization = "Bearer $token"
}

Write-Host ""
Write-Host "=== Enrichment Status ===" -ForegroundColor Yellow
$status = Invoke-RestMethod -Uri "http://localhost:27200/api/boms/$BomId/enrichment/status" -Headers $headers
$status | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host "=== BOM Details ===" -ForegroundColor Yellow
try {
    $bom = Invoke-RestMethod -Uri "http://localhost:27200/api/boms/$BomId" -Headers $headers
    Write-Host "BOM Name: $($bom.name)"
    Write-Host "Status: $($bom.status)"
    Write-Host "Enrichment Status: $($bom.enrichment_status)"
    Write-Host "Component Count: $($bom.component_count)"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Line Items Summary ===" -ForegroundColor Yellow
try {
    $items = Invoke-RestMethod -Uri "http://localhost:27200/api/boms/$BomId/line-items" -Headers $headers
    Write-Host "Total Items: $($items.Count)"

    $enriched = ($items | Where-Object { $_.enrichment_status -eq "enriched" }).Count
    $pending = ($items | Where-Object { $_.enrichment_status -eq "pending" }).Count
    $failed = ($items | Where-Object { $_.enrichment_status -eq "failed" }).Count

    Write-Host "  Enriched: $enriched"
    Write-Host "  Pending: $pending"
    Write-Host "  Failed: $failed"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
