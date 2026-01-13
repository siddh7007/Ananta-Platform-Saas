# =============================================================================
# App Plane Kubernetes Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace for App Plane"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
}

# -----------------------------------------------------------------------------
# Helm Chart Versions (DEPRECATED - Native Kubernetes resources now used)
# -----------------------------------------------------------------------------
# Note: Redis, RabbitMQ, and MinIO are all deployed using native Kubernetes
# StatefulSets instead of Bitnami Helm charts. Bitnami frequently deletes old
# image tags when publishing new chart versions, causing deployment failures.
# These variables are kept for backwards compatibility but are not used.

variable "redis_chart_version" {
  description = "DEPRECATED: Redis now uses native StatefulSet with redis:7-alpine image"
  type        = string
  default     = "18.6.1"
}

variable "rabbitmq_chart_version" {
  description = "DEPRECATED: RabbitMQ now uses native StatefulSet with rabbitmq:3.13-management-alpine image"
  type        = string
  default     = "12.5.6"
}

# -----------------------------------------------------------------------------
# Container Images
# -----------------------------------------------------------------------------

variable "images" {
  description = "Container images for App Plane services"
  type = object({
    supabase_db      = string
    components_db    = string
    redis            = string
    rabbitmq         = string
    minio            = string
    supabase_api     = string
    supabase_studio  = optional(string)
    supabase_meta    = optional(string)
    cns_service      = optional(string)
    cns_dashboard    = optional(string)
    customer_portal  = optional(string)
    dashboard        = optional(string)
    # Novu services
    novu_api         = optional(string)
    novu_worker      = optional(string)
    novu_web         = optional(string)
    novu_ws          = optional(string)
    mongodb          = optional(string)
    # Observability
    jaeger           = optional(string)
    prometheus       = optional(string)
    grafana          = optional(string)
  })
  default = {
    supabase_db      = "supabase/postgres:15.1.0.147"
    components_db    = "postgres:15-alpine"
    redis            = "redis:7-alpine"
    rabbitmq         = "rabbitmq:3.12-management-alpine"
    minio            = "minio/minio:latest"
    supabase_api     = "postgrest/postgrest:v11.2.2"
    supabase_studio  = "supabase/studio:latest"
    supabase_meta    = "supabase/postgres-meta:v0.74.0"
    cns_service      = null
    cns_dashboard    = null
    customer_portal  = null
    dashboard        = null
    # Novu services
    novu_api         = "ghcr.io/novuhq/novu/api:latest"
    novu_worker      = "ghcr.io/novuhq/novu/worker:latest"
    novu_web         = "ghcr.io/novuhq/novu/web:latest"
    novu_ws          = "ghcr.io/novuhq/novu/ws:latest"
    mongodb          = "mongo:6"
    # Observability
    jaeger           = "jaegertracing/all-in-one:1.51"
    prometheus       = "prom/prometheus:v2.47.0"
    grafana          = "grafana/grafana:10.2.0"
  }
}

# -----------------------------------------------------------------------------
# Database Passwords
# -----------------------------------------------------------------------------

variable "supabase_db_password" {
  description = "Password for Supabase PostgreSQL"
  type        = string
  default     = null
  sensitive   = true
}

variable "components_db_password" {
  description = "Password for Components-V2 PostgreSQL"
  type        = string
  default     = null
  sensitive   = true
}

variable "redis_password" {
  description = "Password for Redis (empty for local dev)"
  type        = string
  default     = null
  sensitive   = true
}

variable "rabbitmq_password" {
  description = "Password for RabbitMQ"
  type        = string
  default     = null
  sensitive   = true
}

variable "minio_root_password" {
  description = "Root password for MinIO"
  type        = string
  default     = null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Supabase Configuration
# -----------------------------------------------------------------------------

variable "supabase_jwt_secret" {
  description = "JWT secret for Supabase PostgREST"
  type        = string
  default     = "your-super-secret-jwt-token-with-at-least-32-characters-long"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------

variable "storage_class" {
  description = "Kubernetes storage class for PVCs"
  type        = string
  default     = "local-path"
}

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------

variable "temporal_address" {
  description = "Temporal server gRPC address"
  type        = string
  default     = "temporal:7233"
}

variable "keycloak_url" {
  description = "Keycloak URL for authentication"
  type        = string
  default     = "http://keycloak:8080"
}

variable "control_plane_api_url" {
  description = "Control Plane API URL"
  type        = string
  default     = "http://tenant-management-service:14000"
}

# -----------------------------------------------------------------------------
# Migration Configuration
# -----------------------------------------------------------------------------

variable "run_migrations" {
  description = "Run database migrations on deployment"
  type        = bool
  default     = true  # Run migrations by default for complete deployment
}

variable "migrations_config_map" {
  description = "ConfigMap name containing migration SQL files"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Service Deployment Flags
# -----------------------------------------------------------------------------

variable "deploy_cns_service" {
  description = "Deploy CNS Service"
  type        = bool
  default     = false
}

variable "deploy_customer_portal" {
  description = "Deploy Customer Portal"
  type        = bool
  default     = false
}

variable "deploy_dashboard" {
  description = "Deploy Dashboard"
  type        = bool
  default     = false
}

variable "deploy_supabase_studio" {
  description = "Deploy Supabase Studio (admin UI)"
  type        = bool
  default     = true
}

variable "deploy_supabase_api" {
  description = "Deploy Supabase PostgREST API (not needed - CNS connects directly to DB)"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# CNS Service Vendor API Keys
# -----------------------------------------------------------------------------

variable "cns_jwt_secret" {
  description = "JWT secret for CNS Service authentication"
  type        = string
  default     = "your-super-secret-jwt-token-with-at-least-32-characters-long"
  sensitive   = true
}

variable "mouser_api_key" {
  description = "Mouser API key for component lookup"
  type        = string
  default     = "placeholder-mouser-key"
  sensitive   = true
}

variable "digikey_client_id" {
  description = "DigiKey OAuth client ID"
  type        = string
  default     = "placeholder-digikey-client-id"
  sensitive   = true
}

variable "digikey_client_secret" {
  description = "DigiKey OAuth client secret"
  type        = string
  default     = "placeholder-digikey-client-secret"
  sensitive   = true
}

variable "element14_api_key" {
  description = "Element14/Farnell API key"
  type        = string
  default     = "placeholder-element14-key"
  sensitive   = true
}

variable "arrow_api_key" {
  description = "Arrow Electronics API key"
  type        = string
  default     = "placeholder-arrow-key"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# CNS Dashboard Configuration
# -----------------------------------------------------------------------------

variable "deploy_cns_dashboard" {
  description = "Deploy CNS Dashboard"
  type        = bool
  default     = false
}

variable "cns_dashboard_keycloak_url" {
  description = "Keycloak URL for CNS Dashboard authentication (external URL for browser redirects)"
  type        = string
  default     = "http://localhost:8180"
}

variable "cns_dashboard_keycloak_realm" {
  description = "Keycloak realm for CNS Dashboard"
  type        = string
  default     = "ananta-saas"
}

variable "cns_dashboard_keycloak_client_id" {
  description = "Keycloak client ID for CNS Dashboard"
  type        = string
  default     = "cns-dashboard"
}

variable "cns_dashboard_auth_provider" {
  description = "Auth provider for CNS Dashboard (keycloak, auth0, none)"
  type        = string
  default     = "keycloak"
}

variable "cns_service_api_url" {
  description = "CNS Service API URL for dashboard to connect to (defaults to internal k8s service)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Novu Configuration
# -----------------------------------------------------------------------------

variable "deploy_novu" {
  description = "Deploy Novu notification services"
  type        = bool
  default     = false
}

variable "novu_jwt_secret" {
  description = "JWT secret for Novu"
  type        = string
  default     = "novu-jwt-secret-change-in-production-32chars"
  sensitive   = true
}

variable "novu_encryption_key" {
  description = "Encryption key for Novu store"
  type        = string
  default     = "novu-encryption-key-change-in-production"
  sensitive   = true
}

variable "novu_secret_key" {
  description = "Novu secret key for API authentication"
  type        = string
  default     = "novu-secret-key-change-in-production"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Observability Stack Configuration
# -----------------------------------------------------------------------------

variable "deploy_observability" {
  description = "Deploy observability stack (Jaeger, Prometheus, Grafana)"
  type        = bool
  default     = false
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  default     = "admin123"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Common Labels
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Local Development Configuration
# -----------------------------------------------------------------------------

variable "use_nodeport" {
  description = "Use NodePort services for local development (exposes ports on localhost without port-forward)"
  type        = bool
  default     = false
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Directus Configuration
# -----------------------------------------------------------------------------

variable "deploy_directus" {
  description = "Deploy Directus CMS for audit trail and file management"
  type        = bool
  default     = false
}

variable "directus_image" {
  description = "Directus Docker image"
  type        = string
  default     = "directus/directus:10.10.4"
}

variable "directus_admin_email" {
  description = "Directus admin email"
  type        = string
  default     = "admin@ananta.local"
}

variable "directus_admin_password" {
  description = "Directus admin password"
  type        = string
  default     = "directus123"
  sensitive   = true
}

variable "directus_secret" {
  description = "Directus secret key for encryption"
  type        = string
  default     = "directus-secret-key-change-in-production"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Backstage Portal Configuration
# -----------------------------------------------------------------------------

variable "deploy_backstage_portal" {
  description = "Deploy Backstage Portal (internal staff admin portal)"
  type        = bool
  default     = false
}

variable "backstage_portal_image" {
  description = "Backstage Portal Docker image"
  type        = string
  default     = "ananta/backstage-portal:local"
}
