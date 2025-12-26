# =============================================================================
# ECR Module - Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource naming (e.g., 'ananta')"
  type        = string
  default     = "ananta"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Service Lists
# -----------------------------------------------------------------------------

variable "control_plane_services" {
  description = "List of control plane services requiring ECR repositories"
  type        = list(string)
  default = [
    "tenant-management-service",
    "temporal-worker-service",
    "subscription-service",
    "orchestrator-service",
    "admin-app",
    "customer-portal"
  ]
}

variable "app_plane_services" {
  description = "List of app plane services requiring ECR repositories"
  type        = list(string)
  default = [
    "cns-service",
    "cns-dashboard",
    "backend",
    "customer-portal-app",
    "backstage-portal",
    "dashboard",
    "audit-logger",
    "middleware-api",
    "novu-consumer"
  ]
}

# -----------------------------------------------------------------------------
# Repository Configuration
# -----------------------------------------------------------------------------

variable "image_tag_mutability" {
  description = "Image tag mutability setting (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.image_tag_mutability)
    error_message = "Image tag mutability must be MUTABLE or IMMUTABLE."
  }
}

variable "scan_on_push" {
  description = "Enable image scanning on push"
  type        = bool
  default     = true
}

variable "encryption_type" {
  description = "Encryption type for images (AES256 or KMS)"
  type        = string
  default     = "KMS"

  validation {
    condition     = contains(["AES256", "KMS"], var.encryption_type)
    error_message = "Encryption type must be AES256 or KMS."
  }
}

variable "kms_key_arn" {
  description = "ARN of KMS key for ECR encryption (required if encryption_type is KMS)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Lifecycle Policy Configuration
# -----------------------------------------------------------------------------

variable "keep_tagged_images_count" {
  description = "Number of tagged production images to retain"
  type        = number
  default     = 10
}

variable "keep_dev_images_count" {
  description = "Number of dev/staging tagged images to retain"
  type        = number
  default     = 5
}

variable "untagged_image_days" {
  description = "Number of days to retain untagged images"
  type        = number
  default     = 7
}

variable "keep_any_images_count" {
  description = "Maximum total number of images to retain (any tag status)"
  type        = number
  default     = 50
}

# -----------------------------------------------------------------------------
# Cross-Account Access
# -----------------------------------------------------------------------------

variable "allow_pull_accounts" {
  description = "List of AWS account ARNs allowed to pull images (for multi-account setup)"
  type        = list(string)
  default     = null
}

variable "cicd_role_arns" {
  description = "List of CI/CD role ARNs allowed to push images"
  type        = list(string)
  default     = null
}

# -----------------------------------------------------------------------------
# Replication Configuration
# -----------------------------------------------------------------------------

variable "enable_replication" {
  description = "Enable cross-region replication for disaster recovery"
  type        = bool
  default     = false
}

variable "replication_region" {
  description = "Target region for ECR replication (e.g., us-west-2 for DR)"
  type        = string
  default     = "us-west-2"
}

variable "replication_registry_id" {
  description = "Registry ID for cross-account replication (defaults to current account)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Monitoring and Alerting
# -----------------------------------------------------------------------------

variable "enable_vulnerability_alarms" {
  description = "Enable CloudWatch alarms for critical vulnerabilities"
  type        = bool
  default     = true
}

variable "critical_vulnerability_threshold" {
  description = "Threshold for critical vulnerability count to trigger alarm"
  type        = number
  default     = 0
}

variable "alarm_sns_topic_arns" {
  description = "List of SNS topic ARNs for vulnerability alarms"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------

variable "enable_control_plane_repos" {
  description = "Enable creation of control plane ECR repositories"
  type        = bool
  default     = true
}

variable "enable_app_plane_repos" {
  description = "Enable creation of app plane ECR repositories"
  type        = bool
  default     = true
}

variable "enable_lifecycle_policies" {
  description = "Enable lifecycle policies for automatic image cleanup"
  type        = bool
  default     = true
}

variable "enable_cross_account_policy" {
  description = "Enable cross-account pull policies"
  type        = bool
  default     = false
}

variable "enable_ssm_parameters" {
  description = "Create SSM parameters for ECR URIs"
  type        = bool
  default     = true
}
