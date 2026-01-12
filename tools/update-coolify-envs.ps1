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

# Generate secure passwords
function New-SecurePassword {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    -join ((1..24) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

# Passwords - generate once for all stacks
$CONTROL_PLANE_DB_PASSWORD = New-SecurePassword
$TEMPORAL_DB_PASSWORD = New-SecurePassword
$KEYCLOAK_ADMIN_PASSWORD = New-SecurePassword
$CONTROL_PLANE_MINIO_PASSWORD = New-SecurePassword
$SUPABASE_DB_PASSWORD = New-SecurePassword
$COMPONENTS_V2_DB_PASSWORD = New-SecurePassword
$APP_PLANE_MINIO_PASSWORD = New-SecurePassword
$RABBITMQ_PASSWORD = New-SecurePassword
$JWT_SECRET = (New-SecurePassword) + (New-SecurePassword)
$NOVU_JWT_SECRET = (New-SecurePassword) + (New-SecurePassword)
$NOVU_ENCRYPTION_KEY = New-SecurePassword
$NOVU_SECRET_KEY = New-SecurePassword
$SUPABASE_JWT_SECRET = (New-SecurePassword) + (New-SecurePassword)
$DIRECTUS_KEY = New-SecurePassword
$DIRECTUS_SECRET = New-SecurePassword
$DIRECTUS_ADMIN_PASSWORD = New-SecurePassword
$DJANGO_SECRET_KEY = (New-SecurePassword) + (New-SecurePassword)
$APP_PLANE_WEBHOOK_SECRET = New-SecurePassword
$ADMIN_API_TOKEN = New-SecurePassword

# Save passwords to file
$passwords = @"
# Generated Environment Variables - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# KEEP THIS FILE SECURE - contains all passwords

CONTROL_PLANE_DB_PASSWORD=$CONTROL_PLANE_DB_PASSWORD
TEMPORAL_DB_PASSWORD=$TEMPORAL_DB_PASSWORD
KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD
CONTROL_PLANE_MINIO_PASSWORD=$CONTROL_PLANE_MINIO_PASSWORD
SUPABASE_DB_PASSWORD=$SUPABASE_DB_PASSWORD
COMPONENTS_V2_DB_PASSWORD=$COMPONENTS_V2_DB_PASSWORD
APP_PLANE_MINIO_PASSWORD=$APP_PLANE_MINIO_PASSWORD
RABBITMQ_PASSWORD=$RABBITMQ_PASSWORD
JWT_SECRET=$JWT_SECRET
NOVU_JWT_SECRET=$NOVU_JWT_SECRET
NOVU_ENCRYPTION_KEY=$NOVU_ENCRYPTION_KEY
NOVU_SECRET_KEY=$NOVU_SECRET_KEY
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET
DIRECTUS_KEY=$DIRECTUS_KEY
DIRECTUS_SECRET=$DIRECTUS_SECRET
DIRECTUS_ADMIN_PASSWORD=$DIRECTUS_ADMIN_PASSWORD
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
APP_PLANE_WEBHOOK_SECRET=$APP_PLANE_WEBHOOK_SECRET
ADMIN_API_TOKEN=$ADMIN_API_TOKEN
"@
$passwords | Out-File -FilePath "e:\Work\Ananta-Platform-Saas\tools\env-passwords.txt"
Write-Host "Passwords saved to env-passwords.txt"

# Environment variables to set for each app
$envVars = @{
    # Core database/passwords
    'CONTROL_PLANE_DB_PASSWORD' = $CONTROL_PLANE_DB_PASSWORD
    'CONTROL_PLANE_REDIS_PASSWORD' = ''
    'CONTROL_PLANE_MINIO_USER' = 'minioadmin'
    'CONTROL_PLANE_MINIO_PASSWORD' = $CONTROL_PLANE_MINIO_PASSWORD
    'TEMPORAL_DB_PASSWORD' = $TEMPORAL_DB_PASSWORD

    # Keycloak
    'KEYCLOAK_ADMIN' = 'admin'
    'KEYCLOAK_ADMIN_PASSWORD' = $KEYCLOAK_ADMIN_PASSWORD
    'KEYCLOAK_REALM' = 'ananta-saas'
    'KEYCLOAK_HOSTNAME' = 'localhost'
    'KEYCLOAK_URL' = 'http://keycloak:8080'

    # JWT
    'JWT_SECRET' = $JWT_SECRET

    # Supabase
    'SUPABASE_DB_PASSWORD' = $SUPABASE_DB_PASSWORD
    'SUPABASE_JWT_SECRET' = $SUPABASE_JWT_SECRET

    # Components V2
    'COMPONENTS_V2_DB_PASSWORD' = $COMPONENTS_V2_DB_PASSWORD

    # App Plane
    'APP_PLANE_REDIS_PASSWORD' = ''
    'APP_PLANE_MINIO_USER' = 'minioadmin'
    'APP_PLANE_MINIO_PASSWORD' = $APP_PLANE_MINIO_PASSWORD

    # RabbitMQ
    'RABBITMQ_USER' = 'admin'
    'RABBITMQ_PASSWORD' = $RABBITMQ_PASSWORD

    # Novu
    'NOVU_JWT_SECRET' = $NOVU_JWT_SECRET
    'NOVU_ENCRYPTION_KEY' = $NOVU_ENCRYPTION_KEY
    'NOVU_SECRET_KEY' = $NOVU_SECRET_KEY
    'NOVU_API_KEY' = ''
    'NOVU_API_URL' = 'http://novu-api:3000'
    'NOVU_WEB_URL' = 'http://novu-web:4200'
    'NOVU_WS_URL' = 'ws://novu-ws:3002'

    # Directus
    'DIRECTUS_KEY' = $DIRECTUS_KEY
    'DIRECTUS_SECRET' = $DIRECTUS_SECRET
    'DIRECTUS_ADMIN_EMAIL' = 'admin@example.com'
    'DIRECTUS_ADMIN_PASSWORD' = $DIRECTUS_ADMIN_PASSWORD
    'DIRECTUS_PUBLIC_URL' = 'http://directus:8055'

    # Django
    'DJANGO_SECRET_KEY' = $DJANGO_SECRET_KEY

    # Webhook
    'APP_PLANE_WEBHOOK_SECRET' = $APP_PLANE_WEBHOOK_SECRET
    'SUPABASE_SERVICE_ROLE_KEY' = ''

    # API URLs
    'CONTROL_PLANE_API_URL' = 'http://tenant-management-service:14000'
    'CNS_API_URL' = 'http://cns-service:8000'

    # Admin
    'ADMIN_API_TOKEN' = $ADMIN_API_TOKEN

    # Billing (disabled)
    'BILLING_PROVIDER' = 'none'
    'STRIPE_SECRET_KEY' = ''
    'STRIPE_PUBLISHABLE_KEY' = ''
    'STRIPE_WEBHOOK_SECRET' = ''
    'STRIPE_PRICE_STARTER' = ''
    'STRIPE_PRICE_PROFESSIONAL' = ''
    'STRIPE_PRICE_ENTERPRISE' = ''

    # Supplier APIs (disabled)
    'MOUSER_ENABLED' = 'false'
    'MOUSER_API_KEY' = ''
    'DIGIKEY_ENABLED' = 'false'
    'DIGIKEY_CLIENT_ID' = ''
    'DIGIKEY_CLIENT_SECRET' = ''
    'ELEMENT14_ENABLED' = 'false'
    'ELEMENT14_API_KEY' = ''
}

Write-Host "`nUpdating environment variables for all applications..."

foreach ($app in $apps.GetEnumerator()) {
    Write-Host "`n=== $($app.Key) ($($app.Value)) ==="

    foreach ($env in $envVars.GetEnumerator()) {
        $body = @{
            key = $env.Key
            value = $env.Value
            is_build_time = $true
        } | ConvertTo-Json -Compress

        try {
            # Create or update env var
            $response = Invoke-RestMethod -Uri "$baseUrl/applications/$($app.Value)/envs" -Method Post -Headers $headers -Body $body -ErrorAction SilentlyContinue
            Write-Host "  [+] $($env.Key)"
        } catch {
            # Try PATCH if POST fails (env already exists)
            try {
                $response = Invoke-RestMethod -Uri "$baseUrl/applications/$($app.Value)/envs/update" -Method Patch -Headers $headers -Body $body -ErrorAction SilentlyContinue
                Write-Host "  [U] $($env.Key)"
            } catch {
                Write-Host "  [!] $($env.Key) - Failed"
            }
        }
    }
}

Write-Host "`n=== Done! ==="
Write-Host "Passwords saved to: e:\Work\Ananta-Platform-Saas\tools\env-passwords.txt"
Write-Host "`nNow restart deployments to apply the new environment variables."
