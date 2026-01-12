# =============================================================================
# Control Plane Kubernetes Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource naming"
  type        = string
  default     = "ananta"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace for control plane services"
  type        = string
  default     = "control-plane"
}

variable "create_namespace" {
  description = "Whether to create the namespace"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Additional labels for all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------

variable "database_host" {
  description = "PostgreSQL database host"
  type        = string
}

variable "database_port" {
  description = "PostgreSQL database port"
  type        = number
  default     = 5432
}

variable "database_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "arc_saas"
}

variable "database_user" {
  description = "PostgreSQL database user"
  type        = string
  default     = "postgres"
}

variable "database_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "database_schema" {
  description = "PostgreSQL database schema"
  type        = string
  default     = "tenant_management"
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "redis_host" {
  description = "Redis host"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "redis_database" {
  description = "Redis database number"
  type        = number
  default     = 0
}

# -----------------------------------------------------------------------------
# Auth Configuration
# -----------------------------------------------------------------------------

variable "jwt_secret" {
  description = "JWT secret for token signing"
  type        = string
  sensitive   = true
}

variable "jwt_issuer" {
  description = "JWT issuer"
  type        = string
  default     = "ananta-platform"
}

variable "keycloak_url" {
  description = "Keycloak URL"
  type        = string
}

variable "keycloak_realm" {
  description = "Keycloak realm name"
  type        = string
  default     = "ananta"
}

variable "keycloak_client_id" {
  description = "Keycloak client ID"
  type        = string
}

variable "keycloak_client_secret" {
  description = "Keycloak client secret"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

variable "temporal_address" {
  description = "Temporal server address"
  type        = string
  default     = "temporal:7233"
}

variable "temporal_namespace" {
  description = "Temporal namespace"
  type        = string
  default     = "arc-saas"
}

variable "temporal_task_queue" {
  description = "Temporal task queue name"
  type        = string
  default     = "tenant-provisioning"
}

# -----------------------------------------------------------------------------
# Novu Configuration
# -----------------------------------------------------------------------------

variable "novu_api_key" {
  description = "Novu API key"
  type        = string
  sensitive   = true
}

variable "novu_backend_url" {
  description = "Novu backend URL"
  type        = string
  default     = "http://novu-api:3000"
}

# -----------------------------------------------------------------------------
# Application Configuration
# -----------------------------------------------------------------------------

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

variable "enable_swagger" {
  description = "Enable Swagger API documentation"
  type        = bool
  default     = true
}

variable "cors_origins" {
  description = "CORS allowed origins (comma-separated)"
  type        = string
  default     = "*"
}

# -----------------------------------------------------------------------------
# Tenant Management Service Configuration
# -----------------------------------------------------------------------------

variable "tenant_mgmt_image" {
  description = "Docker image for tenant-management-service"
  type        = string
  default     = "ananta/tenant-management-service:latest"
}

variable "tenant_mgmt_replicas" {
  description = "Number of tenant management service replicas"
  type        = number
  default     = 2
}

variable "tenant_mgmt_cpu_request" {
  description = "CPU request for tenant management service"
  type        = string
  default     = "500m"
}

variable "tenant_mgmt_cpu_limit" {
  description = "CPU limit for tenant management service"
  type        = string
  default     = "2"
}

variable "tenant_mgmt_memory_request" {
  description = "Memory request for tenant management service"
  type        = string
  default     = "512Mi"
}

variable "tenant_mgmt_memory_limit" {
  description = "Memory limit for tenant management service"
  type        = string
  default     = "2Gi"
}

# -----------------------------------------------------------------------------
# Temporal Worker Service Configuration
# -----------------------------------------------------------------------------

variable "temporal_worker_image" {
  description = "Docker image for temporal-worker-service"
  type        = string
  default     = "ananta/temporal-worker-service:latest"
}

variable "temporal_worker_replicas" {
  description = "Number of temporal worker service replicas"
  type        = number
  default     = 2
}

variable "temporal_worker_cpu_request" {
  description = "CPU request for temporal worker service"
  type        = string
  default     = "500m"
}

variable "temporal_worker_cpu_limit" {
  description = "CPU limit for temporal worker service"
  type        = string
  default     = "2"
}

variable "temporal_worker_memory_request" {
  description = "Memory request for temporal worker service"
  type        = string
  default     = "512Mi"
}

variable "temporal_worker_memory_limit" {
  description = "Memory limit for temporal worker service"
  type        = string
  default     = "2Gi"
}

# -----------------------------------------------------------------------------
# Subscription Service Configuration
# -----------------------------------------------------------------------------

variable "subscription_image" {
  description = "Docker image for subscription-service"
  type        = string
  default     = "ananta/subscription-service:latest"
}

variable "subscription_replicas" {
  description = "Number of subscription service replicas"
  type        = number
  default     = 2
}

variable "subscription_cpu_request" {
  description = "CPU request for subscription service"
  type        = string
  default     = "250m"
}

variable "subscription_cpu_limit" {
  description = "CPU limit for subscription service"
  type        = string
  default     = "1"
}

variable "subscription_memory_request" {
  description = "Memory request for subscription service"
  type        = string
  default     = "256Mi"
}

variable "subscription_memory_limit" {
  description = "Memory limit for subscription service"
  type        = string
  default     = "1Gi"
}

# -----------------------------------------------------------------------------
# Orchestrator Service Configuration
# -----------------------------------------------------------------------------

variable "orchestrator_image" {
  description = "Docker image for orchestrator-service"
  type        = string
  default     = "ananta/orchestrator-service:latest"
}

variable "orchestrator_replicas" {
  description = "Number of orchestrator service replicas"
  type        = number
  default     = 2
}

variable "orchestrator_cpu_request" {
  description = "CPU request for orchestrator service"
  type        = string
  default     = "250m"
}

variable "orchestrator_cpu_limit" {
  description = "CPU limit for orchestrator service"
  type        = string
  default     = "1"
}

variable "orchestrator_memory_request" {
  description = "Memory request for orchestrator service"
  type        = string
  default     = "256Mi"
}

variable "orchestrator_memory_limit" {
  description = "Memory limit for orchestrator service"
  type        = string
  default     = "1Gi"
}
