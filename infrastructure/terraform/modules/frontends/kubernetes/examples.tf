# =============================================================================
# Frontend Module Usage Examples
# =============================================================================
# This file shows example usage patterns for the frontends module.
# Copy and adapt these examples to your environment-specific configurations.
# =============================================================================

# -----------------------------------------------------------------------------
# Example 1: Local Development Setup
# -----------------------------------------------------------------------------

# Deploy all frontends with default settings for local development
module "frontends_local" {
  source = "./modules/frontends/kubernetes"

  name_prefix = "ananta-local"
  environment = "dev"
  namespace   = "frontends"

  # API URLs (pointing to local services)
  control_plane_api_url = "http://localhost:14000"
  cns_api_url           = "http://localhost:27200"
  supabase_url          = "http://localhost:27810"
  supabase_anon_key     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Replace with actual key

  # Keycloak (local Docker)
  keycloak_url       = "http://localhost:8180"
  keycloak_realm     = "ananta"
  keycloak_client_id = "ananta-admin-app"

  # Feature flags (all enabled for development)
  enable_billing    = true
  enable_workflows  = true
  enable_monitoring = true
  enable_audit_logs = true

  # Deploy all frontends
  deploy_admin_app        = true
  deploy_customer_portal  = true
  deploy_cns_dashboard    = true
  deploy_backstage_portal = false # Resource-intensive, optional
  deploy_dashboard        = true

  # Single replica for local dev
  admin_app_replicas       = 1
  customer_portal_replicas = 1
  cns_dashboard_replicas   = 1
  dashboard_replicas       = 1

  # Use latest tags for development
  admin_app_image       = "ananta/admin-app:latest"
  customer_portal_image = "ananta/customer-portal:latest"
  cns_dashboard_image   = "ananta/cns-dashboard:latest"
  dashboard_image       = "ananta/dashboard:latest"
}

# -----------------------------------------------------------------------------
# Example 2: Production Deployment with HA
# -----------------------------------------------------------------------------

module "frontends_prod" {
  source = "./modules/frontends/kubernetes"

  name_prefix = "ananta-prod"
  environment = "prod"
  namespace   = "frontends"

  # API URLs (Kubernetes internal services)
  control_plane_api_url = "http://tenant-mgmt.control-plane.svc.cluster.local:14000"
  cns_api_url           = "http://cns-service.app-plane.svc.cluster.local:27200"
  supabase_url          = "http://supabase-api.app-plane.svc.cluster.local:27810"
  supabase_anon_key     = var.supabase_anon_key # From Terraform variables

  # Keycloak (production cluster)
  keycloak_url       = "http://keycloak.auth.svc.cluster.local:8080"
  keycloak_realm     = "ananta"
  keycloak_client_id = "ananta-admin-app"

  # Feature flags (production settings)
  enable_billing    = true
  enable_workflows  = true
  enable_monitoring = true
  enable_audit_logs = true

  # Deploy production frontends
  deploy_admin_app        = true
  deploy_customer_portal  = true
  deploy_cns_dashboard    = true
  deploy_backstage_portal = true
  deploy_dashboard        = true

  # High availability with multiple replicas
  admin_app_replicas       = 3
  customer_portal_replicas = 5 # Customer-facing, needs more replicas
  cns_dashboard_replicas   = 2
  backstage_portal_replicas = 2
  dashboard_replicas       = 3

  # Production images with specific versions
  admin_app_image        = "ananta/admin-app:v1.2.3"
  customer_portal_image  = "ananta/customer-portal:v1.2.3"
  cns_dashboard_image    = "ananta/cns-dashboard:v1.2.3"
  backstage_portal_image = "ananta/backstage-portal:v1.2.3"
  dashboard_image        = "ananta/dashboard:v1.2.3"

  # Increased resources for production
  admin_app_cpu_limit    = "1000m"
  admin_app_memory_limit = "1Gi"

  customer_portal_cpu_limit    = "1000m"
  customer_portal_memory_limit = "1Gi"

  cns_dashboard_cpu_limit    = "1000m"
  cns_dashboard_memory_limit = "1Gi"

  dashboard_cpu_limit    = "1000m"
  dashboard_memory_limit = "1Gi"

  # Enable Ingress with TLS
  create_ingress      = true
  ingress_class       = "nginx"
  ingress_tls_enabled = true
  ingress_tls_secret  = "ananta-tls"

  # Production hostnames
  admin_app_hostname        = "admin.ananta.com"
  customer_portal_hostname  = "portal.ananta.com"
  cns_dashboard_hostname    = "cns.ananta.com"
  backstage_portal_hostname = "backstage.ananta.com"
  dashboard_hostname        = "dashboard.ananta.com"

  ingress_hosts = [
    "admin.ananta.com",
    "portal.ananta.com",
    "cns.ananta.com",
    "backstage.ananta.com",
    "dashboard.ananta.com",
  ]

  # Ingress annotations for cert-manager and production settings
  ingress_annotations = {
    "cert-manager.io/cluster-issuer"                 = "letsencrypt-prod"
    "nginx.ingress.kubernetes.io/ssl-redirect"       = "true"
    "nginx.ingress.kubernetes.io/force-ssl-redirect" = "true"
    "nginx.ingress.kubernetes.io/proxy-body-size"    = "10m"
    "nginx.ingress.kubernetes.io/rate-limit"         = "100"
  }

  labels = {
    "team"        = "platform"
    "cost-center" = "engineering"
  }
}

# -----------------------------------------------------------------------------
# Example 3: Staging Environment (Subset of Frontends)
# -----------------------------------------------------------------------------

module "frontends_staging" {
  source = "./modules/frontends/kubernetes"

  name_prefix = "ananta-staging"
  environment = "staging"
  namespace   = "frontends"

  # Deploy only essential frontends for testing
  deploy_admin_app        = true
  deploy_customer_portal  = true
  deploy_cns_dashboard    = false # Not needed for staging
  deploy_backstage_portal = false # Not needed for staging
  deploy_dashboard        = true

  # Staging resources (between dev and prod)
  admin_app_replicas       = 2
  customer_portal_replicas = 2
  dashboard_replicas       = 2

  admin_app_cpu_limit    = "500m"
  admin_app_memory_limit = "512Mi"

  customer_portal_cpu_limit    = "500m"
  customer_portal_memory_limit = "512Mi"

  dashboard_cpu_limit    = "500m"
  dashboard_memory_limit = "512Mi"

  # Staging images (often use :staging tag or latest prod candidate)
  admin_app_image       = "ananta/admin-app:staging"
  customer_portal_image = "ananta/customer-portal:staging"
  dashboard_image       = "ananta/dashboard:staging"

  # API URLs (staging cluster services)
  control_plane_api_url = "http://tenant-mgmt.control-plane-staging.svc.cluster.local:14000"
  cns_api_url           = "http://cns-service.app-plane-staging.svc.cluster.local:27200"
  supabase_url          = "http://supabase-api.app-plane-staging.svc.cluster.local:27810"
  supabase_anon_key     = var.staging_supabase_anon_key

  # Keycloak staging
  keycloak_url       = "http://keycloak.auth-staging.svc.cluster.local:8080"
  keycloak_realm     = "ananta-staging"
  keycloak_client_id = "ananta-admin-app"

  # Ingress with staging domains
  create_ingress      = true
  ingress_class       = "nginx"
  ingress_tls_enabled = true
  ingress_tls_secret  = "ananta-staging-tls"

  admin_app_hostname       = "admin.staging.ananta.com"
  customer_portal_hostname = "portal.staging.ananta.com"
  dashboard_hostname       = "dashboard.staging.ananta.com"

  ingress_hosts = [
    "admin.staging.ananta.com",
    "portal.staging.ananta.com",
    "dashboard.staging.ananta.com",
  ]

  ingress_annotations = {
    "cert-manager.io/cluster-issuer"           = "letsencrypt-staging"
    "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
  }
}

# -----------------------------------------------------------------------------
# Example 4: Customer-Only Deployment (White-Label SaaS)
# -----------------------------------------------------------------------------

module "frontends_customer_only" {
  source = "./modules/frontends/kubernetes"

  name_prefix = "customer-xyz"
  environment = "prod"
  namespace   = "customer-xyz"

  # Deploy only customer-facing portal
  deploy_admin_app        = false
  deploy_customer_portal  = true
  deploy_cns_dashboard    = false
  deploy_backstage_portal = false
  deploy_dashboard        = false

  # Customer portal configuration
  customer_portal_replicas      = 3
  customer_portal_cpu_limit     = "1000m"
  customer_portal_memory_limit  = "1Gi"
  customer_portal_image         = "ananta/customer-portal:v2.0.0"
  customer_portal_hostname      = "portal.customer-xyz.com"

  # API URLs (shared SaaS infrastructure)
  control_plane_api_url = "https://api.ananta.com"
  cns_api_url           = "https://cns.ananta.com"
  supabase_url          = "https://supabase.ananta.com"
  supabase_anon_key     = var.customer_xyz_supabase_key

  # Keycloak
  keycloak_url       = "https://auth.ananta.com"
  keycloak_realm     = "customer-xyz"
  keycloak_client_id = "customer-xyz-portal"

  # Feature flags (customized per customer)
  enable_billing    = false # Customer doesn't manage billing
  enable_workflows  = true
  enable_monitoring = false
  enable_audit_logs = true

  # Ingress for customer domain
  create_ingress      = true
  ingress_class       = "nginx"
  ingress_tls_enabled = true
  ingress_tls_secret  = "customer-xyz-tls"

  ingress_hosts = ["portal.customer-xyz.com"]

  ingress_annotations = {
    "cert-manager.io/cluster-issuer"           = "letsencrypt-prod"
    "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
  }

  labels = {
    "customer" = "customer-xyz"
    "tier"     = "premium"
  }
}

# -----------------------------------------------------------------------------
# Example 5: Multi-Tenant with Different Backends
# -----------------------------------------------------------------------------

module "frontends_multi_tenant" {
  source = "./modules/frontends/kubernetes"

  name_prefix = "ananta"
  environment = "prod"
  namespace   = "frontends"

  # All frontends deployed
  deploy_admin_app        = true
  deploy_customer_portal  = true
  deploy_cns_dashboard    = true
  deploy_backstage_portal = true
  deploy_dashboard        = true

  # Each frontend can point to different backend services
  # This is useful when backends are scaled independently

  # Admin app -> Control Plane API
  control_plane_api_url = "http://tenant-mgmt-lb.control-plane.svc.cluster.local:14000"

  # Customer portal -> App Plane APIs
  cns_api_url   = "http://cns-lb.app-plane.svc.cluster.local:27200"
  supabase_url  = "http://supabase-lb.app-plane.svc.cluster.local:27810"
  supabase_anon_key = var.supabase_anon_key

  # Dashboard -> Unified API (aggregates multiple backends)
  api_url = "http://unified-api.api-gateway.svc.cluster.local:8000"

  # Keycloak for all
  keycloak_url       = "http://keycloak-ha.auth.svc.cluster.local:8080"
  keycloak_realm     = "ananta"
  keycloak_client_id = "ananta-admin-app"

  # High availability configuration
  admin_app_replicas        = 3
  customer_portal_replicas  = 5
  cns_dashboard_replicas    = 2
  backstage_portal_replicas = 2
  dashboard_replicas        = 3

  # Resource allocation based on usage patterns
  # Customer portal gets more resources (public-facing)
  customer_portal_cpu_limit    = "2000m"
  customer_portal_memory_limit = "2Gi"

  # Admin app moderate resources
  admin_app_cpu_limit    = "1000m"
  admin_app_memory_limit = "1Gi"

  # Internal tools get standard resources
  cns_dashboard_cpu_limit    = "500m"
  cns_dashboard_memory_limit = "512Mi"

  backstage_portal_cpu_limit    = "1000m"
  backstage_portal_memory_limit = "2Gi"

  dashboard_cpu_limit    = "1000m"
  dashboard_memory_limit = "1Gi"
}
