# =============================================================================
# GCP Storage Module - Cloud Storage Implementation
# =============================================================================
# GCP-specific implementation of the cloud-agnostic storage interface.
# Uses Google Cloud Storage with optional versioning, encryption, and lifecycle.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  bucket_name = "${var.name_prefix}-${var.bucket_suffix}"

  # Location type based on high availability
  location_type = var.multi_regional ? "MULTI_REGIONAL" : (var.dual_region ? "DUAL_REGION" : "REGIONAL")
}

# -----------------------------------------------------------------------------
# Cloud Storage Bucket
# -----------------------------------------------------------------------------

resource "google_storage_bucket" "main" {
  name          = local.bucket_name
  project       = var.project_id
  location      = var.location
  storage_class = var.storage_class
  force_destroy = var.force_destroy

  # Versioning
  versioning {
    enabled = var.versioning_enabled
  }

  # Public access prevention
  public_access_prevention = var.public_access ? "inherited" : "enforced"
  uniform_bucket_level_access = var.uniform_bucket_level_access

  # Encryption
  dynamic "encryption" {
    for_each = var.kms_key_name != null ? [1] : []
    content {
      default_kms_key_name = var.kms_key_name
    }
  }

  # CORS configuration
  dynamic "cors" {
    for_each = var.cors_rules
    content {
      origin          = cors.value.allowed_origins
      method          = cors.value.allowed_methods
      response_header = cors.value.allowed_headers
      max_age_seconds = cors.value.max_age_seconds
    }
  }

  # Lifecycle rules
  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_rules
    content {
      condition {
        age                   = lifecycle_rule.value.age_days
        created_before        = lifecycle_rule.value.created_before
        with_state            = lifecycle_rule.value.with_state
        matches_prefix        = lifecycle_rule.value.prefix
        matches_storage_class = lifecycle_rule.value.matches_storage_class
        num_newer_versions    = lifecycle_rule.value.num_newer_versions
      }
      action {
        type          = lifecycle_rule.value.action_type
        storage_class = lifecycle_rule.value.action_storage_class
      }
    }
  }

  # Logging
  dynamic "logging" {
    for_each = var.logging_bucket != null ? [1] : []
    content {
      log_bucket        = var.logging_bucket
      log_object_prefix = var.logging_prefix
    }
  }

  # Retention policy
  dynamic "retention_policy" {
    for_each = var.retention_period_days > 0 ? [1] : []
    content {
      retention_period = var.retention_period_days * 86400  # Convert days to seconds
      is_locked        = var.retention_policy_locked
    }
  }

  # Website hosting (optional)
  dynamic "website" {
    for_each = var.website_config != null ? [var.website_config] : []
    content {
      main_page_suffix = website.value.main_page_suffix
      not_found_page   = website.value.not_found_page
    }
  }

  # Soft delete policy
  soft_delete_policy {
    retention_duration_seconds = var.soft_delete_retention_days * 86400
  }

  labels = merge(var.labels, {
    environment = var.environment
    managed-by  = "terraform"
  })
}

# -----------------------------------------------------------------------------
# IAM Bindings
# -----------------------------------------------------------------------------

resource "google_storage_bucket_iam_member" "members" {
  for_each = { for binding in var.iam_bindings : "${binding.role}-${binding.member}" => binding }

  bucket = google_storage_bucket.main.name
  role   = each.value.role
  member = each.value.member
}

# -----------------------------------------------------------------------------
# Bucket Notifications (Pub/Sub)
# -----------------------------------------------------------------------------

resource "google_storage_notification" "main" {
  count  = var.notification_topic != null ? 1 : 0
  bucket = google_storage_bucket.main.name

  topic              = var.notification_topic
  payload_format     = var.notification_payload_format
  event_types        = var.notification_event_types
  object_name_prefix = var.notification_object_prefix
}

# -----------------------------------------------------------------------------
# Object Default ACL (Legacy - use IAM instead)
# -----------------------------------------------------------------------------

resource "google_storage_default_object_acl" "main" {
  count  = !var.uniform_bucket_level_access && length(var.default_object_acl) > 0 ? 1 : 0
  bucket = google_storage_bucket.main.name

  role_entity = var.default_object_acl
}

# -----------------------------------------------------------------------------
# Cloud Monitoring Alerts
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "storage_size" {
  count        = var.create_alerts && var.max_storage_bytes > 0 ? 1 : 0
  project      = var.project_id
  display_name = "${local.bucket_name}-size-alert"
  combiner     = "OR"

  conditions {
    display_name = "Storage Size High"

    condition_threshold {
      filter          = "resource.type = \"gcs_bucket\" AND resource.labels.bucket_name = \"${local.bucket_name}\" AND metric.type = \"storage.googleapis.com/storage/total_bytes\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.max_storage_bytes

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}
