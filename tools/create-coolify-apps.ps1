$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
    'Content-Type' = 'application/json'
}

$baseUrl = 'http://172.25.76.67:8000/api/v1'

# Stack 1: Core Infrastructure
Write-Host "Creating Stack 1: Core Infrastructure..."
$body1 = @{
    project_uuid = 'es8k4kwco0gcsg0kcc88kccg'
    server_uuid = 'd00c0kgksg48w04w84wwkwgo'
    environment_name = 'production'
    name = '1-core-infrastructure'
    description = 'Core: Postgres, Redis, Keycloak, Temporal, MinIO, Jaeger'
    git_repository = 'https://github.com/siddh7007/Ananta-Platform-Saas'
    git_branch = 'main'
    build_pack = 'dockercompose'
    docker_compose_location = 'coolify/docker-compose.1-core.yml'
} | ConvertTo-Json -Compress

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/applications/public" -Method Post -Headers $headers -Body $body1
    Write-Host "Stack 1 created: $($response1.uuid)"
} catch {
    Write-Host "Stack 1 error: $($_.Exception.Message)"
    Write-Host $_.ErrorDetails.Message
}

# Stack 2: Novu Services
Write-Host "`nCreating Stack 2: Novu Services..."
$body2 = @{
    project_uuid = 'es8k4kwco0gcsg0kcc88kccg'
    server_uuid = 'd00c0kgksg48w04w84wwkwgo'
    environment_name = 'production'
    name = '2-novu-services'
    description = 'Novu: MongoDB, Redis, API, WS, Worker, Web'
    git_repository = 'https://github.com/siddh7007/Ananta-Platform-Saas'
    git_branch = 'main'
    build_pack = 'dockercompose'
    docker_compose_location = 'coolify/docker-compose.2-novu.yml'
} | ConvertTo-Json -Compress

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/applications/public" -Method Post -Headers $headers -Body $body2
    Write-Host "Stack 2 created: $($response2.uuid)"
} catch {
    Write-Host "Stack 2 error: $($_.Exception.Message)"
    Write-Host $_.ErrorDetails.Message
}

# Stack 3: App Plane Infrastructure
Write-Host "`nCreating Stack 3: App Plane Infrastructure..."
$body3 = @{
    project_uuid = 'es8k4kwco0gcsg0kcc88kccg'
    server_uuid = 'd00c0kgksg48w04w84wwkwgo'
    environment_name = 'production'
    name = '3-app-plane-infra'
    description = 'App Infra: Supabase, Components-v2, RabbitMQ, MinIO'
    git_repository = 'https://github.com/siddh7007/Ananta-Platform-Saas'
    git_branch = 'main'
    build_pack = 'dockercompose'
    docker_compose_location = 'coolify/docker-compose.3-app-infra.yml'
} | ConvertTo-Json -Compress

try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/applications/public" -Method Post -Headers $headers -Body $body3
    Write-Host "Stack 3 created: $($response3.uuid)"
} catch {
    Write-Host "Stack 3 error: $($_.Exception.Message)"
    Write-Host $_.ErrorDetails.Message
}

# Stack 4: App Plane Services
Write-Host "`nCreating Stack 4: App Plane Services..."
$body4 = @{
    project_uuid = 'es8k4kwco0gcsg0kcc88kccg'
    server_uuid = 'd00c0kgksg48w04w84wwkwgo'
    environment_name = 'production'
    name = '4-app-plane-services'
    description = 'App Services: CNS, Django, Directus, Frontends'
    git_repository = 'https://github.com/siddh7007/Ananta-Platform-Saas'
    git_branch = 'main'
    build_pack = 'dockercompose'
    docker_compose_location = 'coolify/docker-compose.4-app-services.yml'
} | ConvertTo-Json -Compress

try {
    $response4 = Invoke-RestMethod -Uri "$baseUrl/applications/public" -Method Post -Headers $headers -Body $body4
    Write-Host "Stack 4 created: $($response4.uuid)"
} catch {
    Write-Host "Stack 4 error: $($_.Exception.Message)"
    Write-Host $_.ErrorDetails.Message
}

Write-Host "`nDone! All 4 stacks created."
