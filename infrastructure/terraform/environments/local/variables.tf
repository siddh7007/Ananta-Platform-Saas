# =============================================================================
# Local Environment Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "project_root" {
  description = "Absolute path to the project root directory"
  type        = string
  default     = ""  # Will be set via tfvars or command line
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "local"
}

variable "kubeconfig_path" {
  description = "Path to kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Kubernetes context to use"
  type        = string
  default     = "rancher-desktop"
}

variable "storage_class" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "local-path"  # Default for Rancher Desktop/k3s
}

# -----------------------------------------------------------------------------
# Vault Configuration
# -----------------------------------------------------------------------------

variable "use_vault" {
  description = "Use Vault for secrets management"
  type        = bool
  default     = true
}

variable "vault_address" {
  description = "Vault server address (set after initial deployment)"
  type        = string
  default     = "http://vault.vault-system.svc.cluster.local:8200"
}

variable "vault_token" {
  description = "Vault root token (only for initial setup, use AppRole in production)"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------

variable "db_instance_size" {
  description = "Database instance size (micro, small, medium, large)"
  type        = string
  default     = "small"
}

variable "db_storage_gb" {
  description = "Database storage size in GB"
  type        = number
  default     = 10
}

variable "migration_image" {
  description = "Docker image for running migrations"
  type        = string
  default     = "postgres:15-alpine"
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "redis_instance_size" {
  description = "Redis instance size (micro, small, medium, large)"
  type        = string
  default     = "small"
}

variable "redis_chart_version" {
  description = "Bitnami Redis Helm chart version"
  type        = string
  default     = "24.0.9"  # Stable version with working images
}

variable "rabbitmq_chart_version" {
  description = "Bitnami RabbitMQ Helm chart version"
  type        = string
  default     = "16.0.14"  # Latest stable with streams support
}

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

variable "keycloak_image" {
  description = "Keycloak Docker image"
  type        = string
  default     = "quay.io/keycloak/keycloak:23.0"
}

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

variable "temporal_version" {
  description = "Temporal version"
  type        = string
  default     = "1.24.2"
}

# -----------------------------------------------------------------------------
# Control Plane Service Images
# -----------------------------------------------------------------------------

variable "tenant_management_image" {
  description = "Tenant Management Service image"
  type        = string
  default     = "ananta/tenant-management-service:latest"
}

variable "orchestrator_image" {
  description = "Orchestrator Service image"
  type        = string
  default     = "ananta/orchestrator-service:latest"
}

variable "subscription_image" {
  description = "Subscription Service image"
  type        = string
  default     = "ananta/subscription-service:latest"
}

variable "temporal_worker_image" {
  description = "Temporal Worker Service image"
  type        = string
  default     = "ananta/temporal-worker-service:latest"
}

variable "admin_app_image" {
  description = "Admin App image"
  type        = string
  default     = "ananta/admin-app:latest"
}

# -----------------------------------------------------------------------------
# Migration Configuration
# -----------------------------------------------------------------------------

variable "include_app_plane_migrations" {
  description = "Include App Plane migrations (Supabase, Components-V2)"
  type        = bool
  default     = true  # Required for end-to-end deployment with seed data
}

# -----------------------------------------------------------------------------
# App Plane Configuration
# -----------------------------------------------------------------------------

variable "deploy_app_plane" {
  description = "Deploy App Plane infrastructure (databases, services)"
  type        = bool
  default     = true  # Enable by default for full platform deployment
}

variable "deploy_cns_service" {
  description = "Deploy CNS Service (component normalization)"
  type        = bool
  default     = false  # Requires CNS service image to be built
}

variable "deploy_customer_portal" {
  description = "Deploy Customer Portal frontend"
  type        = bool
  default     = false  # Requires customer-portal image to be built
}

variable "cns_service_image" {
  description = "CNS Service Docker image"
  type        = string
  default     = "ananta/cns-service:latest"
}

variable "customer_portal_image" {
  description = "Customer Portal Docker image - Build from arc-saas/apps/customer-portal/ (NOT app-plane)"
  type        = string
  default     = "ananta/customer-portal:local"
}

# -----------------------------------------------------------------------------
# CNS Service Vendor API Keys
# -----------------------------------------------------------------------------

variable "cns_jwt_secret" {
  description = "JWT secret for CNS Service authentication"
  type        = string
  default     = "cns-jwt-secret-key-change-in-production-at-least-32-chars"
  sensitive   = true
}

variable "mouser_api_key" {
  description = "Mouser API key for component lookup"
  type        = string
  default     = "b1b7b35c-b654-4012-ba7e-018b7f0b59b0"
  sensitive   = true
}

variable "digikey_client_id" {
  description = "DigiKey OAuth client ID"
  type        = string
  default     = "gpa0gNdLFhHbapxaa4BwRKfWgrqxs6qpHTEBAFgorViBYJpy"
  sensitive   = true
}

variable "digikey_client_secret" {
  description = "DigiKey OAuth client secret"
  type        = string
  default     = "tIBYlRCyO0HGxTWc7NTg6IUZjIn0syx5iw3PIni88xWS2iPsFmGotxXrTjfPE7nd"
  sensitive   = true
}

variable "element14_api_key" {
  description = "Element14/Farnell API key"
  type        = string
  default     = "mafvh5qjd49ns43awtnsesbp"
  sensitive   = true
}

variable "arrow_api_key" {
  description = "Arrow Electronics API key"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# CNS Dashboard Configuration
# -----------------------------------------------------------------------------

variable "deploy_cns_dashboard" {
  description = "Deploy CNS Dashboard"
  type        = bool
  default     = false  # Requires cns-dashboard Docker image
}

variable "cns_dashboard_image" {
  description = "CNS Dashboard Docker image"
  type        = string
  default     = "ananta/cns-dashboard:latest"
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

# -----------------------------------------------------------------------------
# Supabase Studio Configuration
# -----------------------------------------------------------------------------

variable "deploy_supabase_studio" {
  description = "Deploy Supabase Studio (database admin UI)"
  type        = bool
  default     = true  # Deploy by default for database access
}

# -----------------------------------------------------------------------------
# Novu Configuration
# -----------------------------------------------------------------------------

variable "deploy_novu" {
  description = "Deploy Novu notification services (API, Worker, Web, WebSocket)"
  type        = bool
  default     = false  # Optional: requires additional resources
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
  default     = false  # Optional: requires additional resources
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  default     = "admin123"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Directus Configuration
# -----------------------------------------------------------------------------

variable "deploy_directus" {
  description = "Deploy Directus CMS for audit trail and file management"
  type        = bool
  default     = false  # Optional: used for enrichment audit logging
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
  default     = false  # Optional: requires backstage-portal image to be built
}

variable "backstage_portal_image" {
  description = "Backstage Portal Docker image"
  type        = string
  default     = "ananta/backstage-portal:local"
}
