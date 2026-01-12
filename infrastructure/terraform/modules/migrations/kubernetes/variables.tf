# Terraform variables for database migrations module

# Namespace configuration
variable "namespace" {
  description = "Kubernetes namespace for migration jobs"
  type        = string
  default     = "default"
}

variable "service_account_name" {
  description = "Kubernetes service account for migration jobs"
  type        = string
  default     = "default"
}

# Migration run flags
variable "run_control_plane_migrations" {
  description = "Enable Control Plane (LoopBack) migrations"
  type        = bool
  default     = true
}

variable "run_supabase_migrations" {
  description = "Enable Supabase PostgreSQL migrations"
  type        = bool
  default     = true
}

variable "run_components_v2_migrations" {
  description = "Enable Components-V2 PostgreSQL migrations"
  type        = bool
  default     = true
}

# Control Plane database configuration
variable "control_plane_db_host" {
  description = "Control Plane PostgreSQL host"
  type        = string
}

variable "control_plane_db_port" {
  description = "Control Plane PostgreSQL port"
  type        = number
  default     = 5432
}

variable "control_plane_db_name" {
  description = "Control Plane database name"
  type        = string
  default     = "arc_saas"
}

variable "control_plane_db_user" {
  description = "Control Plane database user"
  type        = string
  sensitive   = true
}

variable "control_plane_db_password" {
  description = "Control Plane database password"
  type        = string
  sensitive   = true
}

variable "control_plane_db_schema" {
  description = "Control Plane database schema"
  type        = string
  default     = "tenant_management"
}

# Supabase database configuration
variable "supabase_db_host" {
  description = "Supabase PostgreSQL host"
  type        = string
}

variable "supabase_db_port" {
  description = "Supabase PostgreSQL port"
  type        = number
  default     = 27432
}

variable "supabase_db_name" {
  description = "Supabase database name"
  type        = string
  default     = "postgres"
}

variable "supabase_db_user" {
  description = "Supabase database user"
  type        = string
  sensitive   = true
}

variable "supabase_db_password" {
  description = "Supabase database password"
  type        = string
  sensitive   = true
}

# Components-V2 database configuration
variable "components_v2_db_host" {
  description = "Components-V2 PostgreSQL host"
  type        = string
}

variable "components_v2_db_port" {
  description = "Components-V2 PostgreSQL port"
  type        = number
  default     = 27010
}

variable "components_v2_db_name" {
  description = "Components-V2 database name"
  type        = string
  default     = "components_v2"
}

variable "components_v2_db_user" {
  description = "Components-V2 database user"
  type        = string
  sensitive   = true
}

variable "components_v2_db_password" {
  description = "Components-V2 database password"
  type        = string
  sensitive   = true
}

# Migration container images
variable "control_plane_migration_image" {
  description = "Docker image for Control Plane migrations (contains LoopBack app with db-migrate)"
  type        = string
  default     = "ananta/tenant-management-service:latest"
}

variable "supabase_migration_image" {
  description = "Docker image for Supabase migrations (contains psql and migration SQL files)"
  type        = string
  default     = "postgres:15-alpine"
}

variable "components_v2_migration_image" {
  description = "Docker image for Components-V2 migrations (contains psql and migration SQL files)"
  type        = string
  default     = "postgres:15-alpine"
}

variable "postgres_wait_image" {
  description = "Docker image for PostgreSQL readiness checks (must have pg_isready)"
  type        = string
  default     = "postgres:15-alpine"
}

# Resource allocation
variable "migration_resources" {
  description = "Resource requests and limits for migration jobs"
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  default = {
    requests = {
      cpu    = "100m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "512Mi"
    }
  }
}

# Timeout configuration
variable "migration_timeout" {
  description = "Timeout for migration job creation/updates"
  type        = string
  default     = "10m"
}

variable "wait_for_completion" {
  description = "Wait for migration jobs to complete before marking terraform apply as done"
  type        = bool
  default     = true
}

# Labels and annotations
variable "labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default     = {}
}
