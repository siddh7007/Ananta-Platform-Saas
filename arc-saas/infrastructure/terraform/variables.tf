# =============================================================================
# ARC-SaaS Terraform Variables - Cloud-Agnostic
# =============================================================================
# These variables define the interface for deploying ARC-SaaS infrastructure
# across any cloud provider (AWS, GCP, Oracle) or Kubernetes-native setup.
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Selection
# -----------------------------------------------------------------------------

variable "cloud_provider" {
  description = "Cloud provider to deploy to: aws, gcp, oracle, kubernetes"
  type        = string
  default     = "kubernetes"

  validation {
    condition     = contains(["aws", "gcp", "oracle", "kubernetes"], var.cloud_provider)
    error_message = "cloud_provider must be one of: aws, gcp, oracle, kubernetes"
  }
}

variable "region" {
  description = "Region/location for cloud resources (provider-specific format)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Project & Environment
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "arc-saas"
}

variable "environment" {
  description = "Environment name: dev, staging, prod"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod"
  }
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Database Configuration (Provider-Agnostic)
# -----------------------------------------------------------------------------

variable "database" {
  description = "Database configuration"
  type = object({
    # Connection details (for external databases)
    host              = optional(string, "")
    port              = optional(number, 5432)
    name              = optional(string, "arc_saas")
    username          = optional(string, "arc_saas")
    password          = optional(string, "")  # Should come from secrets
    connection_string = optional(string, "")  # Override full connection string

    # Managed database settings (when provisioning)
    instance_type     = optional(string, "small")  # small, medium, large, xlarge
    storage_gb        = optional(number, 20)
    postgres_version  = optional(string, "15")
    high_availability = optional(bool, false)
    backup_retention  = optional(number, 7)

    # Secrets reference
    secret_provider   = optional(string, "kubernetes")  # kubernetes, vault, aws, gcp, oracle
    secret_name       = optional(string, "database-credentials")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Redis/Cache Configuration (Provider-Agnostic)
# -----------------------------------------------------------------------------

variable "redis" {
  description = "Redis/cache configuration"
  type = object({
    # Connection details (for external Redis)
    host              = optional(string, "")
    port              = optional(number, 6379)
    password          = optional(string, "")
    connection_string = optional(string, "")

    # Managed Redis settings (when provisioning)
    instance_type     = optional(string, "small")
    high_availability = optional(bool, false)

    # Secrets reference
    secret_provider   = optional(string, "kubernetes")
    secret_name       = optional(string, "redis-credentials")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

variable "keycloak" {
  description = "Keycloak IAM configuration"
  type = object({
    # External Keycloak
    url           = optional(string, "")
    realm         = optional(string, "arc-saas")
    client_id     = optional(string, "tenant-management-service")
    client_secret = optional(string, "")

    # Deployed Keycloak settings
    deploy        = optional(bool, true)
    admin_user    = optional(string, "admin")
    admin_password = optional(string, "")

    # Secrets reference
    secret_provider = optional(string, "kubernetes")
    secret_name     = optional(string, "keycloak-credentials")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

variable "temporal" {
  description = "Temporal workflow engine configuration"
  type = object({
    address    = optional(string, "temporal:7233")
    namespace  = optional(string, "arc-saas")
    task_queue = optional(string, "tenant-provisioning")

    # Deployed Temporal settings
    deploy     = optional(bool, true)

    # Secrets reference (for mTLS if enabled)
    secret_provider = optional(string, "kubernetes")
    secret_name     = optional(string, "temporal-credentials")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# JWT/Authentication Configuration
# -----------------------------------------------------------------------------

variable "jwt" {
  description = "JWT authentication configuration"
  type = object({
    secret    = optional(string, "")
    issuer    = optional(string, "arc-saas")
    audience  = optional(string, "arc-saas-api")
    expires_in = optional(string, "24h")

    # Secrets reference
    secret_provider = optional(string, "kubernetes")
    secret_name     = optional(string, "jwt-secret")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Notification Service (Novu) Configuration
# -----------------------------------------------------------------------------

variable "novu" {
  description = "Novu notification service configuration"
  type = object({
    api_url    = optional(string, "")
    api_key    = optional(string, "")
    app_id     = optional(string, "")

    # Secrets reference
    secret_provider = optional(string, "kubernetes")
    secret_name     = optional(string, "novu-credentials")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Payment Gateway (Stripe) Configuration
# -----------------------------------------------------------------------------

variable "stripe" {
  description = "Stripe payment gateway configuration"
  type = object({
    api_key         = optional(string, "")
    webhook_secret  = optional(string, "")
    price_ids = optional(object({
      basic    = optional(string, "")
      standard = optional(string, "")
      premium  = optional(string, "")
    }), {})

    # Secrets reference
    secret_provider = optional(string, "kubernetes")
    secret_name     = optional(string, "stripe-credentials")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Networking Configuration
# -----------------------------------------------------------------------------

variable "networking" {
  description = "Networking configuration"
  type = object({
    # VPC/Network settings (for cloud providers)
    vpc_cidr           = optional(string, "10.0.0.0/16")
    availability_zones = optional(number, 2)
    enable_nat         = optional(bool, true)
    single_nat         = optional(bool, true)

    # Domain configuration
    domain             = optional(string, "")
    subdomain          = optional(string, "")
    enable_https       = optional(bool, true)
    certificate_arn    = optional(string, "")  # Provider-specific cert reference

    # Kubernetes-specific
    ingress_class      = optional(string, "nginx")
    cert_manager_issuer = optional(string, "letsencrypt-prod")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Container Registry Configuration
# -----------------------------------------------------------------------------

variable "registry" {
  description = "Container registry configuration"
  type = object({
    url      = optional(string, "")
    username = optional(string, "")
    password = optional(string, "")

    # Secrets reference
    secret_provider = optional(string, "kubernetes")
    secret_name     = optional(string, "registry-credentials")
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Monitoring & Observability
# -----------------------------------------------------------------------------

variable "monitoring" {
  description = "Monitoring and observability configuration"
  type = object({
    enable_prometheus   = optional(bool, true)
    enable_grafana      = optional(bool, true)
    enable_jaeger       = optional(bool, false)
    enable_loki         = optional(bool, false)

    # External monitoring endpoints
    prometheus_url      = optional(string, "")
    grafana_url         = optional(string, "")

    # Alert configuration
    alert_email         = optional(string, "")
    slack_webhook       = optional(string, "")
    pagerduty_key       = optional(string, "")
  })
  default = {}
}
