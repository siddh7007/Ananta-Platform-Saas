# =============================================================================
# CloudTrail Module - Audit Logging
# =============================================================================
# Provisions CloudTrail for comprehensive audit logging:
# - Management events (API calls)
# - Data events (S3, Lambda)
# - Insights events (anomaly detection)
# - Multi-region trail for production
# - S3 bucket with versioning and lifecycle
# - CloudWatch Logs integration
# - SNS notifications for critical events
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_partition" "current" {}

# -----------------------------------------------------------------------------
# S3 Bucket for CloudTrail Logs
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "cloudtrail" {
  bucket = "${var.bucket_prefix}-cloudtrail-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name    = "${var.bucket_prefix}-cloudtrail"
    Purpose = "CloudTrail audit logs"
  })
}

# Enable versioning for audit trail integrity
resource "aws_s3_bucket_versioning" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
    bucket_key_enabled = true
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy to manage costs
resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    transition {
      days          = var.log_archive_days
      storage_class = "GLACIER"
    }

    expiration {
      days = var.log_retention_days
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# S3 bucket policy for CloudTrail
resource "aws_s3_bucket_policy" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.cloudtrail.arn
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid    = "DenyUnencryptedObjectUploads"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      {
        Sid    = "DenyInsecureTransport"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.cloudtrail.arn,
          "${aws_s3_bucket.cloudtrail.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for CloudTrail
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/aws/cloudtrail/${var.name_prefix}"
  retention_in_days = var.cloudwatch_log_retention_days
  kms_key_id        = var.cloudwatch_kms_key_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-cloudtrail-logs"
  })
}

# IAM role for CloudTrail to write to CloudWatch Logs
resource "aws_iam_role" "cloudtrail_cloudwatch" {
  name = "${var.name_prefix}-cloudtrail-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "cloudtrail_cloudwatch" {
  name = "${var.name_prefix}-cloudtrail-cloudwatch-policy"
  role = aws_iam_role.cloudtrail_cloudwatch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailCreateLogStream"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream"
        ]
        Resource = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
      },
      {
        Sid    = "AWSCloudTrailPutLogEvents"
        Effect = "Allow"
        Action = [
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# SNS Topic for CloudTrail Notifications (Optional)
# -----------------------------------------------------------------------------

resource "aws_sns_topic" "cloudtrail" {
  count = var.enable_sns_notifications ? 1 : 0

  name              = "${var.name_prefix}-cloudtrail-notifications"
  kms_master_key_id = var.kms_key_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-cloudtrail-sns"
  })
}

resource "aws_sns_topic_policy" "cloudtrail" {
  count = var.enable_sns_notifications ? 1 : 0

  arn = aws_sns_topic.cloudtrail[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailSNSPolicy"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = "SNS:Publish"
        Resource = aws_sns_topic.cloudtrail[0].arn
      }
    ]
  })
}

# Email subscription (if provided)
resource "aws_sns_topic_subscription" "cloudtrail_email" {
  count = var.enable_sns_notifications && var.notification_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.cloudtrail[0].arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# -----------------------------------------------------------------------------
# CloudTrail
# -----------------------------------------------------------------------------

resource "aws_cloudtrail" "main" {
  name                          = "${var.name_prefix}-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = true
  is_multi_region_trail         = var.is_multi_region_trail
  enable_logging                = true
  enable_log_file_validation    = true

  # CloudWatch Logs integration
  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_cloudwatch.arn

  # SNS notifications (optional)
  sns_topic_name = var.enable_sns_notifications ? aws_sns_topic.cloudtrail[0].name : null

  # KMS encryption
  kms_key_id = var.kms_key_id

  # Event selectors for data events
  dynamic "event_selector" {
    for_each = var.enable_data_events ? [1] : []
    content {
      read_write_type           = "All"
      include_management_events = true

      # S3 data events for specific buckets
      dynamic "data_resource" {
        for_each = var.s3_bucket_arns
        content {
          type   = "AWS::S3::Object"
          values = ["${data_resource.value}/*"]
        }
      }
    }
  }

  # Insights for anomaly detection
  dynamic "insight_selector" {
    for_each = var.enable_insights ? [1] : []
    content {
      insight_type = "ApiCallRateInsight"
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-cloudtrail"
  })

  depends_on = [
    aws_s3_bucket_policy.cloudtrail,
    aws_iam_role_policy.cloudtrail_cloudwatch
  ]
}

# -----------------------------------------------------------------------------
# CloudWatch Metric Filters and Alarms
# -----------------------------------------------------------------------------

# Unauthorized API calls
resource "aws_cloudwatch_log_metric_filter" "unauthorized_api_calls" {
  count = var.create_metric_filters ? 1 : 0

  name           = "${var.name_prefix}-unauthorized-api-calls"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.errorCode = \"*UnauthorizedOperation\") || ($.errorCode = \"AccessDenied*\") }"

  metric_transformation {
    name      = "UnauthorizedAPICalls"
    namespace = "CloudTrail"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "unauthorized_api_calls" {
  count = var.create_metric_filters && var.alarm_sns_topic_arns != null ? 1 : 0

  alarm_name          = "${var.name_prefix}-unauthorized-api-calls"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "UnauthorizedAPICalls"
  namespace           = "CloudTrail"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Unauthorized API calls detected"
  alarm_actions       = var.alarm_sns_topic_arns

  tags = var.tags
}

# Console sign-in without MFA
resource "aws_cloudwatch_log_metric_filter" "console_signin_without_mfa" {
  count = var.create_metric_filters ? 1 : 0

  name           = "${var.name_prefix}-console-signin-without-mfa"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.eventName = \"ConsoleLogin\") && ($.additionalEventData.MFAUsed != \"Yes\") }"

  metric_transformation {
    name      = "ConsoleSignInWithoutMFA"
    namespace = "CloudTrail"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "console_signin_without_mfa" {
  count = var.create_metric_filters && var.alarm_sns_topic_arns != null ? 1 : 0

  alarm_name          = "${var.name_prefix}-console-signin-without-mfa"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ConsoleSignInWithoutMFA"
  namespace           = "CloudTrail"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Console sign-in without MFA detected"
  alarm_actions       = var.alarm_sns_topic_arns

  tags = var.tags
}

# Root account usage
resource "aws_cloudwatch_log_metric_filter" "root_account_usage" {
  count = var.create_metric_filters ? 1 : 0

  name           = "${var.name_prefix}-root-account-usage"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ $.userIdentity.type = \"Root\" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != \"AwsServiceEvent\" }"

  metric_transformation {
    name      = "RootAccountUsage"
    namespace = "CloudTrail"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "root_account_usage" {
  count = var.create_metric_filters && var.alarm_sns_topic_arns != null ? 1 : 0

  alarm_name          = "${var.name_prefix}-root-account-usage"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "RootAccountUsage"
  namespace           = "CloudTrail"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Root account usage detected"
  alarm_actions       = var.alarm_sns_topic_arns

  tags = var.tags
}

# IAM policy changes
resource "aws_cloudwatch_log_metric_filter" "iam_policy_changes" {
  count = var.create_metric_filters ? 1 : 0

  name           = "${var.name_prefix}-iam-policy-changes"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{($.eventName=DeleteGroupPolicy)||($.eventName=DeleteRolePolicy)||($.eventName=DeleteUserPolicy)||($.eventName=PutGroupPolicy)||($.eventName=PutRolePolicy)||($.eventName=PutUserPolicy)||($.eventName=CreatePolicy)||($.eventName=DeletePolicy)||($.eventName=CreatePolicyVersion)||($.eventName=DeletePolicyVersion)||($.eventName=AttachRolePolicy)||($.eventName=DetachRolePolicy)||($.eventName=AttachUserPolicy)||($.eventName=DetachUserPolicy)||($.eventName=AttachGroupPolicy)||($.eventName=DetachGroupPolicy)}"

  metric_transformation {
    name      = "IAMPolicyChanges"
    namespace = "CloudTrail"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "iam_policy_changes" {
  count = var.create_metric_filters && var.alarm_sns_topic_arns != null ? 1 : 0

  alarm_name          = "${var.name_prefix}-iam-policy-changes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "IAMPolicyChanges"
  namespace           = "CloudTrail"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "IAM policy changes detected"
  alarm_actions       = var.alarm_sns_topic_arns

  tags = var.tags
}

# Security group changes
resource "aws_cloudwatch_log_metric_filter" "security_group_changes" {
  count = var.create_metric_filters ? 1 : 0

  name           = "${var.name_prefix}-security-group-changes"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.eventName = AuthorizeSecurityGroupIngress) || ($.eventName = AuthorizeSecurityGroupEgress) || ($.eventName = RevokeSecurityGroupIngress) || ($.eventName = RevokeSecurityGroupEgress) || ($.eventName = CreateSecurityGroup) || ($.eventName = DeleteSecurityGroup) }"

  metric_transformation {
    name      = "SecurityGroupChanges"
    namespace = "CloudTrail"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "security_group_changes" {
  count = var.create_metric_filters && var.alarm_sns_topic_arns != null ? 1 : 0

  alarm_name          = "${var.name_prefix}-security-group-changes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "SecurityGroupChanges"
  namespace           = "CloudTrail"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Security group changes detected"
  alarm_actions       = var.alarm_sns_topic_arns

  tags = var.tags
}
