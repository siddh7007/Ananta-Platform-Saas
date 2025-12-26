# =============================================================================
# Cloud-Agnostic Storage Module Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Selection
# -----------------------------------------------------------------------------

variable "cloud_provider" {
  description = "Cloud provider to use (aws, azure, gcp, kubernetes)"
  type        = string
  default     = ""

  validation {
    condition     = var.cloud_provider == "" || contains(["aws", "azure", "gcp", "kubernetes"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, azure, gcp, kubernetes."
  }
}

# -----------------------------------------------------------------------------
# Common Variables (Provider-Agnostic Interface)
# -----------------------------------------------------------------------------

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "bucket_suffix" {
  description = "Suffix for bucket/container name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "instance_size" {
  description = "Normalized instance size for Kubernetes (micro, small, medium, large, xlarge)"
  type        = string
  default     = ""
}

variable "versioning_enabled" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "public_access" {
  description = "Allow public access to the bucket"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags/labels to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# AWS-Specific Configuration
# -----------------------------------------------------------------------------

variable "aws_config" {
  description = "AWS S3 specific configuration"
  type = object({
    acl                         = optional(string, "private")
    force_destroy               = optional(bool, false)
    kms_key_arn                 = optional(string)
    cors_rules = optional(list(object({
      allowed_headers = list(string)
      allowed_methods = list(string)
      allowed_origins = list(string)
      expose_headers  = optional(list(string), [])
      max_age_seconds = optional(number, 3600)
    })), [])
    lifecycle_rules = optional(list(object({
      id                            = string
      enabled                       = optional(bool, true)
      prefix                        = optional(string, "")
      expiration_days               = optional(number)
      noncurrent_version_expiration = optional(number)
      transition_days               = optional(number)
      transition_storage_class      = optional(string)
      abort_incomplete_days         = optional(number)
    })), [])
    logging_bucket              = optional(string)
    logging_prefix              = optional(string, "logs/")
    replication_role_arn        = optional(string)
    replication_destination     = optional(object({
      bucket_arn        = string
      storage_class     = optional(string, "STANDARD")
      replica_kms_key_id = optional(string)
    }))
    object_lock_enabled         = optional(bool, false)
    object_lock_mode            = optional(string, "GOVERNANCE")
    object_lock_days            = optional(number, 30)
    intelligent_tiering_enabled = optional(bool, false)
    notification_config = optional(object({
      topic_arn    = optional(string)
      queue_arn    = optional(string)
      function_arn = optional(string)
      events       = optional(list(string), ["s3:ObjectCreated:*"])
      filter_prefix = optional(string)
      filter_suffix = optional(string)
    }))
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Azure-Specific Configuration
# -----------------------------------------------------------------------------

variable "azure_config" {
  description = "Azure Blob Storage specific configuration"
  type = object({
    resource_group_name        = optional(string, "")
    location                   = optional(string, "eastus")
    account_tier               = optional(string, "Standard")
    replication_type           = optional(string, "LRS")
    access_tier                = optional(string, "Hot")
    is_hns_enabled             = optional(bool, false)
    min_tls_version            = optional(string, "TLS1_2")
    network_rules = optional(object({
      default_action             = optional(string, "Deny")
      bypass                     = optional(list(string), ["AzureServices"])
      ip_rules                   = optional(list(string), [])
      virtual_network_subnet_ids = optional(list(string), [])
    }))
    key_vault_key_id           = optional(string)
    user_assigned_identity_id  = optional(string)
    lifecycle_rules = optional(list(object({
      name                   = string
      enabled                = optional(bool, true)
      prefix_match           = optional(list(string), [])
      blob_types             = optional(list(string), ["blockBlob"])
      tier_to_cool_days      = optional(number)
      tier_to_archive_days   = optional(number)
      delete_after_days      = optional(number)
      snapshot_delete_days   = optional(number)
      version_delete_days    = optional(number)
    })), [])
    cors_rules = optional(list(object({
      allowed_headers    = list(string)
      allowed_methods    = list(string)
      allowed_origins    = list(string)
      exposed_headers    = optional(list(string), [])
      max_age_in_seconds = optional(number, 3600)
    })), [])
    private_endpoint_subnet_id = optional(string)
    private_dns_zone_ids       = optional(list(string), [])
    log_analytics_workspace_id = optional(string)
    immutable_storage_days     = optional(number, 0)
  })
  default = {}
}

# -----------------------------------------------------------------------------
# GCP-Specific Configuration
# -----------------------------------------------------------------------------

variable "gcp_config" {
  description = "GCP Cloud Storage specific configuration"
  type = object({
    project_id                  = optional(string, "")
    location                    = optional(string, "US")
    storage_class               = optional(string, "STANDARD")
    labels                      = optional(map(string), {})
    force_destroy               = optional(bool, false)
    multi_regional              = optional(bool, false)
    dual_region                 = optional(bool, false)
    uniform_bucket_level_access = optional(bool, true)
    kms_key_name                = optional(string)
    cors_rules = optional(list(object({
      allowed_origins = list(string)
      allowed_methods = list(string)
      allowed_headers = list(string)
      max_age_seconds = number
    })), [])
    lifecycle_rules = optional(list(object({
      age_days              = optional(number)
      created_before        = optional(string)
      with_state            = optional(string)
      prefix                = optional(list(string))
      matches_storage_class = optional(list(string))
      num_newer_versions    = optional(number)
      action_type           = string
      action_storage_class  = optional(string)
    })), [])
    logging_bucket              = optional(string)
    logging_prefix              = optional(string, "logs/")
    retention_period_days       = optional(number, 0)
    retention_policy_locked     = optional(bool, false)
    soft_delete_retention_days  = optional(number, 7)
    website_config = optional(object({
      main_page_suffix = string
      not_found_page   = string
    }))
    iam_bindings = optional(list(object({
      role   = string
      member = string
    })), [])
    default_object_acl          = optional(list(string), [])
    notification_topic          = optional(string)
    notification_payload_format = optional(string, "JSON_API_V1")
    notification_event_types    = optional(list(string), ["OBJECT_FINALIZE"])
    notification_object_prefix  = optional(string)
    create_alerts               = optional(bool, false)
    max_storage_bytes           = optional(number, 0)
    notification_channels       = optional(list(string), [])
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Configuration
# -----------------------------------------------------------------------------

variable "kubernetes_config" {
  description = "Kubernetes MinIO specific configuration"
  type = object({
    namespace                  = optional(string, "minio")
    create_namespace           = optional(bool, true)
    use_operator               = optional(bool, false)
    high_availability          = optional(bool, false)
    service_account_name       = optional(string, "default")
    minio_image                = optional(string, "minio/minio")
    minio_version              = optional(string, "RELEASE.2024-01-01T16-36-33Z")
    access_key                 = optional(string)
    secret_key                 = optional(string)
    minio_extra_env            = optional(map(string), {})
    storage_class_name         = optional(string)
    storage_size               = optional(string)
    tls_enabled                = optional(bool, false)
    tls_cert                   = optional(string)
    tls_key                    = optional(string)
    service_type               = optional(string, "ClusterIP")
    service_annotations        = optional(map(string), {})
    ingress_enabled            = optional(bool, false)
    ingress_class_name         = optional(string, "nginx")
    ingress_host               = optional(string, "")
    ingress_path               = optional(string, "/")
    ingress_annotations        = optional(map(string), {})
    ingress_tls_secret         = optional(string)
    console_ingress_enabled    = optional(bool, false)
    console_ingress_host       = optional(string, "")
    console_ingress_tls_secret = optional(string)
    pod_annotations            = optional(map(string), {})
    pod_security_context = optional(object({
      run_as_user     = optional(number)
      run_as_group    = optional(number)
      fs_group        = optional(number)
      run_as_non_root = optional(bool)
    }))
    pod_affinity = optional(object({
      pod_anti_affinity = optional(object({
        required = optional(bool, true)
      }))
    }))
    tolerations = optional(list(object({
      key      = string
      operator = string
      value    = optional(string)
      effect   = string
    })), [])
    node_selector              = optional(map(string), {})
    create_default_bucket      = optional(bool, true)
    default_bucket_name        = optional(string, "default")
    metrics_enabled            = optional(bool, true)
    prometheus_labels          = optional(map(string), { "prometheus" = "kube-prometheus" })
  })
  default = {}
}
