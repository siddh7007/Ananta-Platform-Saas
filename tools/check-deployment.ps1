param($uuid)

$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
}

$resp = Invoke-RestMethod -Uri "http://172.25.76.67:8000/api/v1/deployments/$uuid" -Headers $headers

Write-Host "Status: $($resp.status)"
Write-Host "Finished: $($resp.finished_at)"
Write-Host ""
Write-Host "Last 5 log entries:"

$logsArray = $resp.logs | ConvertFrom-Json
$logsArray | Select-Object -Last 5 | ForEach-Object {
    Write-Host "  [$($_.type)] $($_.output)"
}
