$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
}

$response = Invoke-RestMethod -Uri 'http://172.25.76.67:8000/api/v1/applications/dsw0gog8sswc08s8ss088ssw' -Headers $headers

# Show all properties containing 'env'
$response.PSObject.Properties | Where-Object { $_.Name -match 'env' } | ForEach-Object {
    Write-Host "$($_.Name): $($_.Value)"
}

# Show environment_variables if exists
if ($response.environment_variables) {
    Write-Host "`nEnvironment Variables:"
    $response.environment_variables | ForEach-Object {
        Write-Host "  $($_.key)=$($_.value)"
    }
}
