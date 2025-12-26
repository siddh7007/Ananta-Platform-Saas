# =============================================================================
# AWS Storage Module - S3 Implementation
# =============================================================================
# AWS-specific implementation of the cloud-agnostic storage interface.
# Uses Amazon S3 for object storage with optional versioning, encryption,
# lifecycle rules, and replication.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  bucket_name = "${var.name_prefix}-${var.bucket_suffix}"
}

# -----------------------------------------------------------------------------
# S3 Bucket
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "main" {
  bucket        = local.bucket_name
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Name = local.bucket_name
  })
}

# -----------------------------------------------------------------------------
# Bucket Versioning
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id

  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Suspended"
  }
}

# -----------------------------------------------------------------------------
# Server-Side Encryption
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  count  = var.encryption_enabled ? 1 : 0
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn != null ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = var.kms_key_arn != null
  }
}

# -----------------------------------------------------------------------------
# Public Access Block
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = !var.public_access
  block_public_policy     = !var.public_access
  ignore_public_acls      = !var.public_access
  restrict_public_buckets = !var.public_access
}

# -----------------------------------------------------------------------------
# Bucket Policy
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "main" {
  count  = var.bucket_policy != null ? 1 : 0
  bucket = aws_s3_bucket.main.id
  policy = var.bucket_policy
}

# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_cors_configuration" "main" {
  count  = length(var.cors_rules) > 0 ? 1 : 0
  bucket = aws_s3_bucket.main.id

  dynamic "cors_rule" {
    for_each = var.cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = cors_rule.value.expose_headers
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}

# -----------------------------------------------------------------------------
# Lifecycle Rules
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_lifecycle_configuration" "main" {
  count  = length(var.lifecycle_rules) > 0 ? 1 : 0
  bucket = aws_s3_bucket.main.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.enabled ? "Enabled" : "Disabled"

      filter {
        prefix = rule.value.prefix
      }

      dynamic "transition" {
        for_each = rule.value.transitions
        content {
          days          = transition.value.days
          storage_class = transition.value.storage_class
        }
      }

      dynamic "expiration" {
        for_each = rule.value.expiration_days != null ? [1] : []
        content {
          days = rule.value.expiration_days
        }
      }

      dynamic "noncurrent_version_transition" {
        for_each = rule.value.noncurrent_version_transitions
        content {
          noncurrent_days = noncurrent_version_transition.value.days
          storage_class   = noncurrent_version_transition.value.storage_class
        }
      }

      dynamic "noncurrent_version_expiration" {
        for_each = rule.value.noncurrent_version_expiration_days != null ? [1] : []
        content {
          noncurrent_days = rule.value.noncurrent_version_expiration_days
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_logging" "main" {
  count  = var.logging_bucket != null ? 1 : 0
  bucket = aws_s3_bucket.main.id

  target_bucket = var.logging_bucket
  target_prefix = var.logging_prefix
}

# -----------------------------------------------------------------------------
# Cross-Region Replication
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_replication_configuration" "main" {
  count  = var.replication_enabled && var.replication_destination_bucket_arn != null ? 1 : 0
  bucket = aws_s3_bucket.main.id
  role   = var.replication_role_arn

  rule {
    id     = "replication-rule"
    status = "Enabled"

    filter {
      prefix = var.replication_prefix
    }

    destination {
      bucket        = var.replication_destination_bucket_arn
      storage_class = var.replication_storage_class
    }

    delete_marker_replication {
      status = var.replicate_delete_markers ? "Enabled" : "Disabled"
    }
  }

  depends_on = [aws_s3_bucket_versioning.main]
}

# -----------------------------------------------------------------------------
# Object Lock (Compliance/Governance)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_object_lock_configuration" "main" {
  count  = var.object_lock_enabled ? 1 : 0
  bucket = aws_s3_bucket.main.id

  rule {
    default_retention {
      mode = var.object_lock_mode
      days = var.object_lock_retention_days
    }
  }
}

# -----------------------------------------------------------------------------
# Intelligent Tiering
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_intelligent_tiering_configuration" "main" {
  count  = var.intelligent_tiering_enabled ? 1 : 0
  bucket = aws_s3_bucket.main.id
  name   = "entire-bucket"

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = var.archive_access_tier_days
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = var.deep_archive_access_tier_days
  }
}

# -----------------------------------------------------------------------------
# Bucket Notifications (Optional)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_notification" "main" {
  count  = var.enable_notifications ? 1 : 0
  bucket = aws_s3_bucket.main.id

  dynamic "lambda_function" {
    for_each = var.lambda_notifications
    content {
      lambda_function_arn = lambda_function.value.lambda_arn
      events              = lambda_function.value.events
      filter_prefix       = lambda_function.value.filter_prefix
      filter_suffix       = lambda_function.value.filter_suffix
    }
  }

  dynamic "sqs_queue" {
    for_each = var.sqs_notifications
    content {
      queue_arn     = sqs_queue.value.queue_arn
      events        = sqs_queue.value.events
      filter_prefix = sqs_queue.value.filter_prefix
      filter_suffix = sqs_queue.value.filter_suffix
    }
  }

  dynamic "sns_topic" {
    for_each = var.sns_notifications
    content {
      topic_arn     = sns_topic.value.topic_arn
      events        = sns_topic.value.events
      filter_prefix = sns_topic.value.filter_prefix
      filter_suffix = sns_topic.value.filter_suffix
    }
  }
}
