# =============================================================================
# ECS Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

# Security Groups (from security-groups module)
variable "alb_security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# ALB Configuration
variable "enable_alb_deletion_protection" {
  description = "Enable ALB deletion protection"
  type        = bool
  default     = false
}

variable "alb_logs_bucket" {
  description = "S3 bucket for ALB access logs"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
  default     = ""
}

# Tenant Management Service
variable "tenant_mgmt_cpu" {
  description = "CPU units for tenant management service"
  type        = number
  default     = 512
}

variable "tenant_mgmt_memory" {
  description = "Memory in MB for tenant management service"
  type        = number
  default     = 1024
}

variable "tenant_mgmt_desired_count" {
  description = "Desired number of tenant management tasks"
  type        = number
  default     = 2
}

variable "tenant_mgmt_image" {
  description = "Docker image for tenant management service"
  type        = string
  default     = "ghcr.io/ananta-platform/tenant-management-service:latest"
}

# CNS Service
variable "cns_service_cpu" {
  description = "CPU units for CNS service"
  type        = number
  default     = 512
}

variable "cns_service_memory" {
  description = "Memory in MB for CNS service"
  type        = number
  default     = 1024
}

variable "cns_service_desired_count" {
  description = "Desired number of CNS service tasks"
  type        = number
  default     = 2
}

variable "cns_service_image" {
  description = "Docker image for CNS service"
  type        = string
  default     = "ghcr.io/ananta-platform/cns-service:latest"
}

# Secrets
variable "control_plane_db_secret_arn" {
  description = "ARN of control plane database secret"
  type        = string
}

variable "app_plane_db_secret_arn" {
  description = "ARN of app plane database secret"
  type        = string
}

variable "components_db_secret_arn" {
  description = "ARN of components database secret"
  type        = string
}

variable "redis_endpoint" {
  description = "Redis endpoint"
  type        = string
}

variable "jaeger_endpoint" {
  description = "Jaeger OTLP endpoint for tracing"
  type        = string
  default     = "http://jaeger:4317"
}

# Auto Scaling
variable "enable_autoscaling" {
  description = "Enable ECS service auto scaling"
  type        = bool
  default     = true
}

variable "autoscaling_min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "autoscaling_max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "autoscaling_cpu_target" {
  description = "Target CPU utilization percentage"
  type        = number
  default     = 70
}

variable "autoscaling_memory_target" {
  description = "Target memory utilization percentage"
  type        = number
  default     = 80
}

variable "autoscaling_scale_in_cooldown" {
  description = "Cooldown period in seconds before scale in"
  type        = number
  default     = 300
}

variable "autoscaling_scale_out_cooldown" {
  description = "Cooldown period in seconds before scale out"
  type        = number
  default     = 60
}

variable "cloudwatch_kms_key_id" {
  description = "KMS key ID for CloudWatch Logs encryption"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# New Services - Temporal Worker, Orchestrator, Subscription, etc.
# -----------------------------------------------------------------------------

# Temporal Worker Service (No HTTP)
variable "temporal_worker_cpu" {
  description = "CPU units for temporal worker service"
  type        = number
  default     = 512
}

variable "temporal_worker_memory" {
  description = "Memory in MB for temporal worker service"
  type        = number
  default     = 1024
}

variable "temporal_worker_desired_count" {
  description = "Desired number of temporal worker tasks"
  type        = number
  default     = 2
}

variable "temporal_worker_image" {
  description = "Docker image for temporal worker service"
  type        = string
  default     = "ghcr.io/ananta-platform/temporal-worker-service:latest"
}

# Orchestrator Service
variable "orchestrator_cpu" {
  description = "CPU units for orchestrator service"
  type        = number
  default     = 512
}

variable "orchestrator_memory" {
  description = "Memory in MB for orchestrator service"
  type        = number
  default     = 1024
}

variable "orchestrator_desired_count" {
  description = "Desired number of orchestrator tasks"
  type        = number
  default     = 2
}

variable "orchestrator_image" {
  description = "Docker image for orchestrator service"
  type        = string
  default     = "ghcr.io/ananta-platform/orchestrator-service:latest"
}

# Subscription Service
variable "subscription_cpu" {
  description = "CPU units for subscription service"
  type        = number
  default     = 512
}

variable "subscription_memory" {
  description = "Memory in MB for subscription service"
  type        = number
  default     = 1024
}

variable "subscription_desired_count" {
  description = "Desired number of subscription tasks"
  type        = number
  default     = 2
}

variable "subscription_image" {
  description = "Docker image for subscription service"
  type        = string
  default     = "ghcr.io/ananta-platform/subscription-service:latest"
}

# Keycloak
variable "keycloak_cpu" {
  description = "CPU units for Keycloak"
  type        = number
  default     = 1024
}

variable "keycloak_memory" {
  description = "Memory in MB for Keycloak"
  type        = number
  default     = 2048
}

variable "keycloak_desired_count" {
  description = "Desired number of Keycloak tasks"
  type        = number
  default     = 2
}

variable "keycloak_image" {
  description = "Docker image for Keycloak"
  type        = string
  default     = "quay.io/keycloak/keycloak:latest"
}

# Temporal Server
variable "temporal_cpu" {
  description = "CPU units for Temporal server"
  type        = number
  default     = 1024
}

variable "temporal_memory" {
  description = "Memory in MB for Temporal server"
  type        = number
  default     = 2048
}

variable "temporal_desired_count" {
  description = "Desired number of Temporal server tasks"
  type        = number
  default     = 1
}

variable "temporal_image" {
  description = "Docker image for Temporal server"
  type        = string
  default     = "temporalio/auto-setup:latest"
}

variable "temporal_address" {
  description = "Temporal server address (host:port)"
  type        = string
  default     = "temporal:7233"
}

variable "rds_endpoint" {
  description = "RDS endpoint for Temporal database"
  type        = string
}

# Temporal UI
variable "temporal_ui_cpu" {
  description = "CPU units for Temporal UI"
  type        = number
  default     = 256
}

variable "temporal_ui_memory" {
  description = "Memory in MB for Temporal UI"
  type        = number
  default     = 512
}

variable "temporal_ui_desired_count" {
  description = "Desired number of Temporal UI tasks"
  type        = number
  default     = 1
}

variable "temporal_ui_image" {
  description = "Docker image for Temporal UI"
  type        = string
  default     = "temporalio/ui:latest"
}

# Admin App
variable "admin_app_cpu" {
  description = "CPU units for admin app"
  type        = number
  default     = 256
}

variable "admin_app_memory" {
  description = "Memory in MB for admin app"
  type        = number
  default     = 512
}

variable "admin_app_desired_count" {
  description = "Desired number of admin app tasks"
  type        = number
  default     = 2
}

variable "admin_app_image" {
  description = "Docker image for admin app"
  type        = string
  default     = "ghcr.io/ananta-platform/admin-app:latest"
}

# Customer Portal
variable "customer_portal_cpu" {
  description = "CPU units for customer portal"
  type        = number
  default     = 256
}

variable "customer_portal_memory" {
  description = "Memory in MB for customer portal"
  type        = number
  default     = 512
}

variable "customer_portal_desired_count" {
  description = "Desired number of customer portal tasks"
  type        = number
  default     = 2
}

variable "customer_portal_image" {
  description = "Docker image for customer portal"
  type        = string
  default     = "ghcr.io/ananta-platform/customer-portal:latest"
}

# CNS Dashboard
variable "cns_dashboard_cpu" {
  description = "CPU units for CNS dashboard"
  type        = number
  default     = 256
}

variable "cns_dashboard_memory" {
  description = "Memory in MB for CNS dashboard"
  type        = number
  default     = 512
}

variable "cns_dashboard_desired_count" {
  description = "Desired number of CNS dashboard tasks"
  type        = number
  default     = 1
}

variable "cns_dashboard_image" {
  description = "Docker image for CNS dashboard"
  type        = string
  default     = "ghcr.io/ananta-platform/cns-dashboard:latest"
}

# Novu Notification Service
variable "novu_cpu" {
  description = "CPU units for Novu service"
  type        = number
  default     = 512
}

variable "novu_memory" {
  description = "Memory in MB for Novu service"
  type        = number
  default     = 1024
}

variable "novu_desired_count" {
  description = "Desired number of Novu tasks"
  type        = number
  default     = 1
}

variable "novu_image" {
  description = "Docker image for Novu service"
  type        = string
  default     = "ghcr.io/novuhq/novu/api:latest"
}

# Domain name for routing
variable "domain_name" {
  description = "Base domain name for the platform"
  type        = string
  default     = "ananta-platform.com"
}

# -----------------------------------------------------------------------------
# Service Discovery Configuration
# -----------------------------------------------------------------------------

variable "service_discovery_arns" {
  description = "Map of service names to their Cloud Map service ARNs for service registration"
  type        = map(string)
  default     = {}
}

variable "enable_service_discovery" {
  description = "Enable Cloud Map service discovery registration for ECS services"
  type        = bool
  default     = true
}
