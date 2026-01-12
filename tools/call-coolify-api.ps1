param(
    [Parameter(Mandatory=$false)]
    [string]$Action = "add-key"
)

$BaseUrl = "http://172.25.76.67:8000/api/v1"
$Token = "2|1mxflVojTi1ILcjT3hZfvDCgVn9GpCkEz6yh5o1Y2484572a"

$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

if ($Action -eq "add-key") {
    $KeyData = Get-Content -Path "e:\Work\Ananta-Platform-Saas\tools\add-key.json" -Raw
    Write-Host "Adding private key to Coolify..."
    try {
        $Response = Invoke-RestMethod -Uri "$BaseUrl/security/keys" -Method Post -Headers $Headers -Body $KeyData -TimeoutSec 30
        $Response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $reader.BaseStream.Position = 0
            $reader.DiscardBufferedData()
            Write-Host $reader.ReadToEnd()
        }
    }
} elseif ($Action -eq "version") {
    try {
        $Response = Invoke-RestMethod -Uri "$BaseUrl/version" -Method Get -Headers $Headers -TimeoutSec 10
        $Response | ConvertTo-Json
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
    }
} elseif ($Action -eq "list-keys") {
    try {
        $Response = Invoke-RestMethod -Uri "$BaseUrl/security/keys" -Method Get -Headers $Headers -TimeoutSec 10
        $Response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
    }
}
