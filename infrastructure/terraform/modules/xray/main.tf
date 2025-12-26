# =============================================================================
# AWS X-Ray Module - Distributed Tracing Infrastructure
# =============================================================================
# Provides production-ready distributed tracing with X-Ray sampling rules,
# encryption, and trace groups for filtering
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  name_prefix = var.name_prefix

  common_tags = merge(
    var.tags,
    {
      Module = "xray"
    }
  )
}

# =============================================================================
# X-RAY SAMPLING RULES
# =============================================================================

# High-priority sampling for critical API paths
resource "aws_xray_sampling_rule" "critical_apis" {
  rule_name      = "${local.name_prefix}-critical-apis"
  priority       = 100
  version        = 1
  reservoir_size = 10
  fixed_rate     = 1.0 # 100% sampling
  url_path       = "/api/tenants*"
  host           = "*"
  http_method    = "POST"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {
    critical = "true"
  }

  tags = merge(local.common_tags, {
    Purpose = "Critical API sampling"
  })
}

# Moderate sampling for authentication flows
resource "aws_xray_sampling_rule" "auth_apis" {
  rule_name      = "${local.name_prefix}-auth-apis"
  priority       = 200
  version        = 1
  reservoir_size = 5
  fixed_rate     = 0.5 # 50% sampling
  url_path       = "/auth/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {}

  tags = merge(local.common_tags, {
    Purpose = "Authentication flow sampling"
  })
}

# Light sampling for health checks (reduce noise)
resource "aws_xray_sampling_rule" "health_checks" {
  rule_name      = "${local.name_prefix}-health-checks"
  priority       = 300
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.01 # 1% sampling
  url_path       = "/health*"
  host           = "*"
  http_method    = "GET"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {}

  tags = merge(local.common_tags, {
    Purpose = "Health check sampling (reduced)"
  })
}

# Default sampling rule for all other traffic
resource "aws_xray_sampling_rule" "default" {
  rule_name      = "${local.name_prefix}-default"
  priority       = 1000
  version        = 1
  reservoir_size = var.default_reservoir_size
  fixed_rate     = var.default_sampling_rate
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {}

  tags = merge(local.common_tags, {
    Purpose = "Default sampling"
  })
}

# =============================================================================
# X-RAY ENCRYPTION CONFIGURATION
# =============================================================================

# Encrypt X-Ray traces at rest with KMS
resource "aws_xray_encryption_config" "main" {
  type   = var.enable_kms_encryption ? "KMS" : "NONE"
  key_id = var.enable_kms_encryption ? var.kms_key_id : null

  depends_on = [
    aws_kms_key.xray[0]
  ]
}

# KMS key for X-Ray encryption
resource "aws_kms_key" "xray" {
  count = var.enable_kms_encryption && var.kms_key_id == "" ? 1 : 0

  description             = "KMS key for AWS X-Ray trace encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow X-Ray to use the key"
        Effect = "Allow"
        Principal = {
          Service = "xray.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_kms_alias" "xray" {
  count = var.enable_kms_encryption && var.kms_key_id == "" ? 1 : 0

  name          = "alias/${local.name_prefix}-xray"
  target_key_id = aws_kms_key.xray[0].key_id
}

# =============================================================================
# X-RAY TRACE GROUPS
# =============================================================================

# Group for API service traces
resource "aws_xray_group" "api_services" {
  group_name        = "${local.name_prefix}-api-services"
  filter_expression = "service(id(name: \"tenant-management-service\", type: \"*\")) OR service(id(name: \"cns-service\", type: \"*\"))"

  insights_configuration {
    insights_enabled      = var.enable_insights
    notifications_enabled = var.enable_insights_notifications
  }

  tags = merge(local.common_tags, {
    ServiceType = "API"
  })
}

# Group for workflow traces (Temporal)
resource "aws_xray_group" "workflows" {
  group_name        = "${local.name_prefix}-workflows"
  filter_expression = "service(id(name: \"temporal-worker-service\", type: \"*\")) OR annotation.workflow_type EXISTS"

  insights_configuration {
    insights_enabled      = var.enable_insights
    notifications_enabled = var.enable_insights_notifications
  }

  tags = merge(local.common_tags, {
    ServiceType = "Workflow"
  })
}

# Group for error traces
resource "aws_xray_group" "errors" {
  group_name        = "${local.name_prefix}-errors"
  filter_expression = "error = true OR fault = true"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = var.enable_insights_notifications
  }

  tags = merge(local.common_tags, {
    Purpose = "Error tracking"
  })
}

# Group for slow requests (> 1 second)
resource "aws_xray_group" "slow_requests" {
  group_name        = "${local.name_prefix}-slow-requests"
  filter_expression = "duration >= 1"

  insights_configuration {
    insights_enabled      = var.enable_insights
    notifications_enabled = var.enable_insights_notifications
  }

  tags = merge(local.common_tags, {
    Purpose = "Performance monitoring"
  })
}

# Group for high-value tenant operations
resource "aws_xray_group" "tenant_operations" {
  group_name        = "${local.name_prefix}-tenant-operations"
  filter_expression = "annotation.tenant_id EXISTS AND (annotation.operation = \"provision\" OR annotation.operation = \"delete\")"

  insights_configuration {
    insights_enabled      = var.enable_insights
    notifications_enabled = var.enable_insights_notifications
  }

  tags = merge(local.common_tags, {
    Purpose = "Tenant lifecycle tracking"
  })
}

# =============================================================================
# IAM POLICIES FOR X-RAY ACCESS
# =============================================================================

# Policy document for ECS tasks to write to X-Ray
data "aws_iam_policy_document" "xray_write" {
  statement {
    sid    = "AllowXRayWrite"
    effect = "Allow"

    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets",
      "xray:GetSamplingStatisticSummaries"
    ]

    resources = ["*"]
  }
}

# Managed policy for X-Ray write access
resource "aws_iam_policy" "xray_write" {
  name        = "${local.name_prefix}-xray-write-policy"
  description = "Allows ECS tasks to write traces to AWS X-Ray"
  policy      = data.aws_iam_policy_document.xray_write.json

  tags = local.common_tags
}

# =============================================================================
# CLOUDWATCH ALARMS FOR X-RAY INSIGHTS
# =============================================================================

# Alarm for high error rate detected by X-Ray Insights
resource "aws_cloudwatch_metric_alarm" "xray_error_rate" {
  count = var.enable_insights && var.alarm_sns_topic_arn != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-xray-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FaultRate"
  namespace           = "AWS/XRay"
  period              = 300
  statistic           = "Average"
  threshold           = var.error_rate_threshold
  alarm_description   = "X-Ray Insights detected high error rate"
  alarm_actions       = [var.alarm_sns_topic_arn]
  ok_actions          = [var.alarm_sns_topic_arn]

  dimensions = {
    GroupName = aws_xray_group.api_services.group_name
  }

  tags = local.common_tags
}

# Alarm for high latency detected by X-Ray Insights
resource "aws_cloudwatch_metric_alarm" "xray_latency" {
  count = var.enable_insights && var.alarm_sns_topic_arn != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-xray-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ResponseTime"
  namespace           = "AWS/XRay"
  period              = 300
  statistic           = "Average"
  threshold           = var.latency_threshold_ms
  alarm_description   = "X-Ray Insights detected high response latency"
  alarm_actions       = [var.alarm_sns_topic_arn]
  ok_actions          = [var.alarm_sns_topic_arn]

  dimensions = {
    GroupName = aws_xray_group.api_services.group_name
  }

  tags = local.common_tags
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
