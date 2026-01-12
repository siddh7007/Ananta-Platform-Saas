# =============================================================================
# Kubernetes Frontend Applications Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# -----------------------------------------------------------------------------
# Kubernetes Configuration
# -----------------------------------------------------------------------------

variable "namespace" {
  description = "Kubernetes namespace for frontend applications"
  type        = string
  default     = "frontends"
}

variable "create_namespace" {
  description = "Create the namespace if it doesn't exist"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# API URLs Configuration
# -----------------------------------------------------------------------------

variable "api_url" {
  description = "Base API URL for backend services"
  type        = string
  default     = "http://localhost:14000"
}

variable "control_plane_api_url" {
  description = "Control Plane API URL (tenant-management-service)"
  type        = string
  default     = "http://localhost:14000"
}

variable "cns_api_url" {
  description = "CNS API URL (Component Normalization Service)"
  type        = string
  default     = "http://localhost:27200"
}

variable "supabase_url" {
  description = "Supabase API URL"
  type        = string
  default     = "http://localhost:27810"
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

variable "keycloak_url" {
  description = "Keycloak server URL"
  type        = string
  default     = "http://localhost:8180"
}

variable "keycloak_realm" {
  description = "Keycloak realm name"
  type        = string
  default     = "ananta"
}

variable "keycloak_client_id" {
  description = "Keycloak client ID"
  type        = string
  default     = "ananta-admin-app"
}

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------

variable "enable_billing" {
  description = "Enable billing features"
  type        = bool
  default     = true
}

variable "enable_workflows" {
  description = "Enable workflow features"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable monitoring features"
  type        = bool
  default     = true
}

variable "enable_audit_logs" {
  description = "Enable audit log features"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# 1. Admin App Configuration
# -----------------------------------------------------------------------------

variable "deploy_admin_app" {
  description = "Deploy admin-app (Control Plane admin portal)"
  type        = bool
  default     = true
}

variable "admin_app_image" {
  description = "Docker image for admin-app"
  type        = string
  default     = "ananta/admin-app:latest"
}

variable "admin_app_replicas" {
  description = "Number of admin-app replicas"
  type        = number
  default     = 1
}

variable "admin_app_port" {
  description = "Service port for admin-app"
  type        = number
  default     = 27555
}

variable "admin_app_cpu_request" {
  description = "CPU request for admin-app"
  type        = string
  default     = "100m"
}

variable "admin_app_cpu_limit" {
  description = "CPU limit for admin-app"
  type        = string
  default     = "500m"
}

variable "admin_app_memory_request" {
  description = "Memory request for admin-app"
  type        = string
  default     = "128Mi"
}

variable "admin_app_memory_limit" {
  description = "Memory limit for admin-app"
  type        = string
  default     = "512Mi"
}

variable "admin_app_hostname" {
  description = "Ingress hostname for admin-app"
  type        = string
  default     = "admin.ananta.local"
}

# -----------------------------------------------------------------------------
# 2. Customer Portal Configuration
# -----------------------------------------------------------------------------

variable "deploy_customer_portal" {
  description = "Deploy customer-portal (Customer facing UI)"
  type        = bool
  default     = true
}

variable "customer_portal_image" {
  description = "Docker image for customer-portal"
  type        = string
  default     = "ananta/customer-portal:latest"
}

variable "customer_portal_replicas" {
  description = "Number of customer-portal replicas"
  type        = number
  default     = 2
}

variable "customer_portal_port" {
  description = "Service port for customer-portal"
  type        = number
  default     = 27100
}

variable "customer_portal_cpu_request" {
  description = "CPU request for customer-portal"
  type        = string
  default     = "100m"
}

variable "customer_portal_cpu_limit" {
  description = "CPU limit for customer-portal"
  type        = string
  default     = "500m"
}

variable "customer_portal_memory_request" {
  description = "Memory request for customer-portal"
  type        = string
  default     = "128Mi"
}

variable "customer_portal_memory_limit" {
  description = "Memory limit for customer-portal"
  type        = string
  default     = "512Mi"
}

variable "customer_portal_hostname" {
  description = "Ingress hostname for customer-portal"
  type        = string
  default     = "portal.ananta.local"
}

# -----------------------------------------------------------------------------
# 3. CNS Dashboard Configuration
# -----------------------------------------------------------------------------

variable "deploy_cns_dashboard" {
  description = "Deploy cns-dashboard (CNS Admin UI)"
  type        = bool
  default     = true
}

variable "cns_dashboard_image" {
  description = "Docker image for cns-dashboard"
  type        = string
  default     = "ananta/cns-dashboard:latest"
}

variable "cns_dashboard_replicas" {
  description = "Number of cns-dashboard replicas"
  type        = number
  default     = 1
}

variable "cns_dashboard_port" {
  description = "Service port for cns-dashboard"
  type        = number
  default     = 27250
}

variable "cns_dashboard_cpu_request" {
  description = "CPU request for cns-dashboard"
  type        = string
  default     = "100m"
}

variable "cns_dashboard_cpu_limit" {
  description = "CPU limit for cns-dashboard"
  type        = string
  default     = "500m"
}

variable "cns_dashboard_memory_request" {
  description = "Memory request for cns-dashboard"
  type        = string
  default     = "128Mi"
}

variable "cns_dashboard_memory_limit" {
  description = "Memory limit for cns-dashboard"
  type        = string
  default     = "512Mi"
}

variable "cns_dashboard_hostname" {
  description = "Ingress hostname for cns-dashboard"
  type        = string
  default     = "cns.ananta.local"
}

# -----------------------------------------------------------------------------
# 4. Backstage Portal Configuration
# -----------------------------------------------------------------------------

variable "deploy_backstage_portal" {
  description = "Deploy backstage-portal (Admin portal)"
  type        = bool
  default     = false
}

variable "backstage_portal_image" {
  description = "Docker image for backstage-portal"
  type        = string
  default     = "ananta/backstage-portal:latest"
}

variable "backstage_portal_replicas" {
  description = "Number of backstage-portal replicas"
  type        = number
  default     = 1
}

variable "backstage_portal_port" {
  description = "Service port for backstage-portal"
  type        = number
  default     = 27150
}

variable "backstage_portal_cpu_request" {
  description = "CPU request for backstage-portal"
  type        = string
  default     = "250m"
}

variable "backstage_portal_cpu_limit" {
  description = "CPU limit for backstage-portal"
  type        = string
  default     = "1000m"
}

variable "backstage_portal_memory_request" {
  description = "Memory request for backstage-portal"
  type        = string
  default     = "512Mi"
}

variable "backstage_portal_memory_limit" {
  description = "Memory limit for backstage-portal"
  type        = string
  default     = "2Gi"
}

variable "backstage_portal_hostname" {
  description = "Ingress hostname for backstage-portal"
  type        = string
  default     = "backstage.ananta.local"
}

# -----------------------------------------------------------------------------
# 5. Dashboard Configuration
# -----------------------------------------------------------------------------

variable "deploy_dashboard" {
  description = "Deploy dashboard (Unified dashboard - Next.js)"
  type        = bool
  default     = true
}

variable "dashboard_image" {
  description = "Docker image for dashboard"
  type        = string
  default     = "ananta/dashboard:latest"
}

variable "dashboard_replicas" {
  description = "Number of dashboard replicas"
  type        = number
  default     = 2
}

variable "dashboard_port" {
  description = "Service port for dashboard"
  type        = number
  default     = 27400
}

variable "dashboard_cpu_request" {
  description = "CPU request for dashboard"
  type        = string
  default     = "100m"
}

variable "dashboard_cpu_limit" {
  description = "CPU limit for dashboard"
  type        = string
  default     = "500m"
}

variable "dashboard_memory_request" {
  description = "Memory request for dashboard"
  type        = string
  default     = "256Mi"
}

variable "dashboard_memory_limit" {
  description = "Memory limit for dashboard"
  type        = string
  default     = "1Gi"
}

variable "dashboard_hostname" {
  description = "Ingress hostname for dashboard"
  type        = string
  default     = "dashboard.ananta.local"
}

# -----------------------------------------------------------------------------
# Ingress Configuration
# -----------------------------------------------------------------------------

variable "create_ingress" {
  description = "Create Ingress resource for external access"
  type        = bool
  default     = false
}

variable "ingress_class" {
  description = "Ingress class to use (nginx, traefik, etc.)"
  type        = string
  default     = "nginx"
}

variable "ingress_annotations" {
  description = "Additional annotations for Ingress"
  type        = map(string)
  default     = {}
}

variable "ingress_tls_enabled" {
  description = "Enable TLS for Ingress"
  type        = bool
  default     = false
}

variable "ingress_tls_secret" {
  description = "Secret name containing TLS certificate"
  type        = string
  default     = "frontends-tls"
}

variable "ingress_hosts" {
  description = "List of hostnames for TLS certificate"
  type        = list(string)
  default     = []
}
