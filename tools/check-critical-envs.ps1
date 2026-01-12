$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
}

$uuid = 'dsw0gog8sswc08s8ss088ssw'
$url = "http://172.25.76.67:8000/api/v1/applications/$uuid/envs"

$criticalKeys = @('CONTROL_PLANE_DB_PASSWORD','TEMPORAL_DB_PASSWORD','KEYCLOAK_ADMIN_PASSWORD','CONTROL_PLANE_MINIO_PASSWORD','CONTROL_PLANE_MINIO_USER')

$envs = Invoke-RestMethod -Uri $url -Headers $headers

Write-Host "=== Stack 1 Critical Environment Variables ===" -ForegroundColor Cyan
foreach ($key in $criticalKeys) {
    $env = $envs | Where-Object { $_.key -eq $key -and $_.is_preview -eq $false }
    if ($env) {
        $hasValue = [string]::IsNullOrEmpty($env.real_value) -eq $false
        $status = if ($hasValue) { "[OK]" } else { "[EMPTY]" }
        $color = if ($hasValue) { "Green" } else { "Red" }
        Write-Host "  $status $key = $(if ($hasValue) { '***set***' } else { '(not set)' })" -ForegroundColor $color
    } else {
        Write-Host "  [MISSING] $key" -ForegroundColor Red
    }
}
