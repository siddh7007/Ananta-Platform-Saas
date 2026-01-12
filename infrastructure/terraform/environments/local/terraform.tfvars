# =============================================================================
# Local Environment Terraform Variables
# =============================================================================
# Override image tags to use :local instead of :latest

# Control Plane Service Images - using :local tag
tenant_management_image = "ananta/tenant-management-service:local"
orchestrator_image      = "ananta/orchestrator-service:local"
subscription_image      = "ananta/subscription-service:local"
temporal_worker_image   = "ananta/temporal-worker-service:local"
admin_app_image         = "ananta/admin-app:local"

# App Plane Service Images - using :local tag
cns_service_image      = "ananta/cns-service:local"
cns_dashboard_image    = "ananta/cns-dashboard:local"
customer_portal_image  = "ananta/customer-portal:local"

# Kubernetes context
kubeconfig_context = "rancher-desktop"

# Environment
environment = "local"

# =============================================================================
# App Plane Deployment Flags - Enable all services for local development
# =============================================================================
deploy_app_plane        = true
deploy_cns_service      = true
deploy_customer_portal  = true
deploy_cns_dashboard    = true
deploy_supabase_studio  = true
deploy_novu             = false  # Disable Novu for now (optional service)
deploy_observability    = false  # Disable observability for now (optional)

# CNS Service Vendor API Keys (placeholders for local development)
cns_jwt_secret        = "dev-jwt-secret-change-in-production"
mouser_api_key        = ""
digikey_client_id     = ""
digikey_client_secret = ""
element14_api_key     = ""
arrow_api_key         = ""

# CNS Dashboard Configuration
# Note: These are for documentation - actual values are baked into the
# dashboard at build time via .env.production (Vite build-time env vars)
cns_dashboard_keycloak_url       = "http://localhost:8180"
cns_dashboard_keycloak_realm     = "ananta-saas"
cns_dashboard_keycloak_client_id = "cns-dashboard"
cns_dashboard_auth_provider      = "keycloak"

# =============================================================================
# Helm Chart Versions - Override defaults with working versions
# =============================================================================
redis_chart_version    = "24.0.9"   # Bitnami Redis 8.4.0 (stable, working image)
rabbitmq_chart_version = "16.0.14"  # Bitnami RabbitMQ 4.1.3 (latest stable with streams)
