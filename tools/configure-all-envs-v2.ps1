$headers = @{
    'Authorization' = 'Bearer 1|mBE9OAwVoeWXSDdabKRIsViKxdF3QCR2Rl7IyvQn6fd3f949'
    'Content-Type' = 'application/json'
}

$baseUrl = 'http://172.25.76.67:8000/api/v1'

# Application UUIDs
$apps = @{
    'Stack1-Core' = 'dsw0gog8sswc08s8ss088ssw'
    'Stack2-Novu' = 'e0ocw8s0wkc48c4008wgo4co'
    'Stack3-AppInfra' = 'ykkck88s4ck4gcgsgso4c4so'
    'Stack4-AppServices' = 'a4840csk44gwocw0g484ss84'
}

# Read existing passwords from file
$passwordsFile = "e:\Work\Ananta-Platform-Saas\tools\env-passwords.txt"
$passwords = @{}

if (Test-Path $passwordsFile) {
    Write-Host "Reading existing passwords from env-passwords.txt..."
    Get-Content $passwordsFile | ForEach-Object {
        if ($_ -match '^([A-Z_]+)=(.*)$') {
            $passwords[$matches[1]] = $matches[2]
        }
    }
} else {
    Write-Host "ERROR: env-passwords.txt not found. Run configure-all-envs.ps1 first."
    exit 1
}

# All environment variables to configure
$envVars = @{
    # Core database/passwords
    CONTROL_PLANE_DB_PASSWORD = $passwords.CONTROL_PLANE_DB_PASSWORD
    CONTROL_PLANE_REDIS_PASSWORD = ''
    CONTROL_PLANE_MINIO_USER = 'minioadmin'
    CONTROL_PLANE_MINIO_PASSWORD = $passwords.CONTROL_PLANE_MINIO_PASSWORD
    TEMPORAL_DB_PASSWORD = $passwords.TEMPORAL_DB_PASSWORD

    # Keycloak
    KEYCLOAK_ADMIN = 'admin'
    KEYCLOAK_ADMIN_PASSWORD = $passwords.KEYCLOAK_ADMIN_PASSWORD
    KEYCLOAK_REALM = 'ananta-saas'
    KEYCLOAK_HOSTNAME = 'localhost'
    KEYCLOAK_URL = 'http://keycloak:8080'

    # JWT
    JWT_SECRET = $passwords.JWT_SECRET

    # Supabase
    SUPABASE_DB_PASSWORD = $passwords.SUPABASE_DB_PASSWORD
    SUPABASE_JWT_SECRET = $passwords.SUPABASE_JWT_SECRET

    # Components V2
    COMPONENTS_V2_DB_PASSWORD = $passwords.COMPONENTS_V2_DB_PASSWORD

    # App Plane
    APP_PLANE_REDIS_PASSWORD = ''
    APP_PLANE_MINIO_USER = 'minioadmin'
    APP_PLANE_MINIO_PASSWORD = $passwords.APP_PLANE_MINIO_PASSWORD

    # RabbitMQ
    RABBITMQ_USER = 'admin'
    RABBITMQ_PASSWORD = $passwords.RABBITMQ_PASSWORD

    # Novu
    NOVU_JWT_SECRET = $passwords.NOVU_JWT_SECRET
    NOVU_ENCRYPTION_KEY = $passwords.NOVU_ENCRYPTION_KEY
    NOVU_SECRET_KEY = $passwords.NOVU_SECRET_KEY
    NOVU_API_KEY = ''
    NOVU_API_URL = 'http://novu-api:3000'
    NOVU_WEB_URL = 'http://novu-web:4200'
    NOVU_WS_URL = 'ws://novu-ws:3002'

    # Directus
    DIRECTUS_KEY = $passwords.DIRECTUS_KEY
    DIRECTUS_SECRET = $passwords.DIRECTUS_SECRET
    DIRECTUS_ADMIN_EMAIL = 'admin@example.com'
    DIRECTUS_ADMIN_PASSWORD = $passwords.DIRECTUS_ADMIN_PASSWORD
    DIRECTUS_PUBLIC_URL = 'http://directus:8055'

    # Django
    DJANGO_SECRET_KEY = $passwords.DJANGO_SECRET_KEY

    # Webhook
    APP_PLANE_WEBHOOK_SECRET = $passwords.APP_PLANE_WEBHOOK_SECRET
    SUPABASE_SERVICE_ROLE_KEY = ''

    # API URLs
    CONTROL_PLANE_API_URL = 'http://tenant-management-service:14000'
    CNS_API_URL = 'http://cns-service:8000'

    # Admin
    ADMIN_API_TOKEN = $passwords.ADMIN_API_TOKEN

    # Billing (disabled)
    BILLING_PROVIDER = 'none'
    STRIPE_SECRET_KEY = ''
    STRIPE_PUBLISHABLE_KEY = ''
    STRIPE_WEBHOOK_SECRET = ''
    STRIPE_PRICE_STARTER = ''
    STRIPE_PRICE_PROFESSIONAL = ''
    STRIPE_PRICE_ENTERPRISE = ''

    # Supplier APIs (disabled)
    MOUSER_ENABLED = 'false'
    MOUSER_API_KEY = ''
    DIGIKEY_ENABLED = 'false'
    DIGIKEY_CLIENT_ID = ''
    DIGIKEY_CLIENT_SECRET = ''
    ELEMENT14_ENABLED = 'false'
    ELEMENT14_API_KEY = ''
}

$totalVars = $envVars.Count
$totalApps = $apps.Count

Write-Host "Configuring $totalVars environment variables for $totalApps applications..."
Write-Host ""

foreach ($app in $apps.GetEnumerator()) {
    Write-Host "=== $($app.Key) ($($app.Value)) ===" -ForegroundColor Cyan

    # Get existing env vars for this app
    try {
        $existingEnvs = Invoke-RestMethod -Uri "$baseUrl/applications/$($app.Value)/envs" -Headers $headers
        $existingKeys = $existingEnvs | Where-Object { $_.is_preview -eq $false } | Select-Object -ExpandProperty key
    } catch {
        $existingKeys = @()
    }

    $successCount = 0
    $failCount = 0

    foreach ($env in $envVars.GetEnumerator()) {
        $body = @{
            key = $env.Key
            value = $env.Value
        } | ConvertTo-Json -Compress

        if ($existingKeys -contains $env.Key) {
            # Update existing
            try {
                $response = Invoke-RestMethod -Uri "$baseUrl/applications/$($app.Value)/envs" -Method Patch -Headers $headers -Body $body -ErrorAction Stop
                $successCount++
            } catch {
                $failCount++
                Write-Host "  [X] $($env.Key) (update failed)" -ForegroundColor Red
            }
        } else {
            # Create new
            try {
                $response = Invoke-RestMethod -Uri "$baseUrl/applications/$($app.Value)/envs" -Method Post -Headers $headers -Body $body -ErrorAction Stop
                $successCount++
            } catch {
                $failCount++
                Write-Host "  [X] $($env.Key) (create failed: $($_.Exception.Message))" -ForegroundColor Red
            }
        }
    }

    Write-Host "  Updated: $successCount | Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { 'Green' } else { 'Yellow' })
    Write-Host ""
}

Write-Host "=== Configuration Complete ===" -ForegroundColor Green
