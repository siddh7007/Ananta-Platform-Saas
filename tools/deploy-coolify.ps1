param(
    [Parameter(Mandatory=$true)]
    [string]$AppUUID
)

$script = @'
TOKEN="2|1mxflVojTi1ILcjT3hZfvDCgVn9GpCkEz6yh5o1Y2484572a"
curl -s -X GET -H "Authorization: Bearer $TOKEN" "http://localhost:8000/api/v1/deploy?uuid=$APPUUID"
'@

$script = $script.Replace('$APPUUID', $AppUUID)
$encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($script))
wsl -d Ubuntu-Dev -u root bash -c "echo $encoded | base64 -d | bash"
