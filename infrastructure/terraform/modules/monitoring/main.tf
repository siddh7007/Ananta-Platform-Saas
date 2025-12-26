# =============================================================================
# Monitoring Module - AWS CloudWatch & SNS Integration
# =============================================================================
# Creates CloudWatch alarms, SNS topics, and Lambda functions for alerting
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

  # Common tags
  common_tags = merge(
    var.tags,
    {
      Module = "monitoring"
    }
  )
}

# =============================================================================
# SNS TOPICS FOR ALERTS
# =============================================================================

# Critical alerts topic (PagerDuty integration)
resource "aws_sns_topic" "critical_alerts" {
  name              = "${local.name_prefix}-critical-alerts"
  display_name      = "Ananta Platform Critical Alerts"
  kms_master_key_id = var.enable_encryption ? aws_kms_key.sns[0].id : null

  tags = merge(local.common_tags, {
    Severity = "critical"
  })
}

# Warning alerts topic (Slack integration)
resource "aws_sns_topic" "warning_alerts" {
  name              = "${local.name_prefix}-warning-alerts"
  display_name      = "Ananta Platform Warning Alerts"
  kms_master_key_id = var.enable_encryption ? aws_kms_key.sns[0].id : null

  tags = merge(local.common_tags, {
    Severity = "warning"
  })
}

# SLO violations topic
resource "aws_sns_topic" "slo_violations" {
  name              = "${local.name_prefix}-slo-violations"
  display_name      = "Ananta Platform SLO Violations"
  kms_master_key_id = var.enable_encryption ? aws_kms_key.sns[0].id : null

  tags = merge(local.common_tags, {
    Type = "slo"
  })
}

# Infrastructure alerts topic
resource "aws_sns_topic" "infrastructure_alerts" {
  name              = "${local.name_prefix}-infrastructure-alerts"
  display_name      = "Ananta Platform Infrastructure Alerts"
  kms_master_key_id = var.enable_encryption ? aws_kms_key.sns[0].id : null

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# SNS Topic Policies
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "sns_topic_policy" {
  statement {
    sid    = "AllowCloudWatchToPublish"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }

    actions = [
      "SNS:Publish",
    ]

    resources = [
      aws_sns_topic.critical_alerts.arn,
      aws_sns_topic.warning_alerts.arn,
      aws_sns_topic.slo_violations.arn,
      aws_sns_topic.infrastructure_alerts.arn,
    ]
  }

  statement {
    sid    = "AllowLambdaToPublish"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = [
      "SNS:Publish",
    ]

    resources = [
      aws_sns_topic.critical_alerts.arn,
      aws_sns_topic.warning_alerts.arn,
      aws_sns_topic.slo_violations.arn,
      aws_sns_topic.infrastructure_alerts.arn,
    ]
  }
}

resource "aws_sns_topic_policy" "critical_alerts" {
  arn    = aws_sns_topic.critical_alerts.arn
  policy = data.aws_iam_policy_document.sns_topic_policy.json
}

resource "aws_sns_topic_policy" "warning_alerts" {
  arn    = aws_sns_topic.warning_alerts.arn
  policy = data.aws_iam_policy_document.sns_topic_policy.json
}

resource "aws_sns_topic_policy" "slo_violations" {
  arn    = aws_sns_topic.slo_violations.arn
  policy = data.aws_iam_policy_document.sns_topic_policy.json
}

resource "aws_sns_topic_policy" "infrastructure_alerts" {
  arn    = aws_sns_topic.infrastructure_alerts.arn
  policy = data.aws_iam_policy_document.sns_topic_policy.json
}

# -----------------------------------------------------------------------------
# KMS Key for SNS Encryption (optional)
# -----------------------------------------------------------------------------

resource "aws_kms_key" "sns" {
  count = var.enable_encryption ? 1 : 0

  description             = "KMS key for SNS topic encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.common_tags
}

resource "aws_kms_alias" "sns" {
  count = var.enable_encryption ? 1 : 0

  name          = "alias/${local.name_prefix}-sns"
  target_key_id = aws_kms_key.sns[0].key_id
}

# =============================================================================
# CLOUDWATCH ALARMS - RDS
# =============================================================================

# Control Plane Database - CPU High
resource "aws_cloudwatch_metric_alarm" "control_plane_db_cpu" {
  count = var.control_plane_db_id != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-control-plane-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.db_cpu_threshold
  alarm_description   = "Control Plane database CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.control_plane_db_id
  }

  tags = local.common_tags
}

# Control Plane Database - Free Storage Low
resource "aws_cloudwatch_metric_alarm" "control_plane_db_storage" {
  count = var.control_plane_db_id != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-control-plane-db-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.db_storage_threshold_bytes
  alarm_description   = "Control Plane database free storage is running low"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.control_plane_db_id
  }

  tags = local.common_tags
}

# Control Plane Database - Connection Count High
resource "aws_cloudwatch_metric_alarm" "control_plane_db_connections" {
  count = var.control_plane_db_id != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-control-plane-db-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.db_connections_threshold
  alarm_description   = "Control Plane database connection count is high"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.control_plane_db_id
  }

  tags = local.common_tags
}

# App Plane Database - CPU High
resource "aws_cloudwatch_metric_alarm" "app_plane_db_cpu" {
  count = var.app_plane_db_id != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-app-plane-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.db_cpu_threshold
  alarm_description   = "App Plane database CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.app_plane_db_id
  }

  tags = local.common_tags
}

# =============================================================================
# CLOUDWATCH ALARMS - ELASTICACHE (REDIS)
# =============================================================================

# Redis CPU High
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = var.redis_cluster_id != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Redis CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  tags = local.common_tags
}

# Redis Memory High
resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count = var.redis_cluster_id != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Redis memory usage is too high"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  tags = local.common_tags
}

# Redis Evictions
resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = var.redis_cluster_id != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Redis is evicting cached items"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  tags = local.common_tags
}

# =============================================================================
# CLOUDWATCH ALARMS - ECS
# =============================================================================

# ECS Service CPU High
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each = var.ecs_services

  alarm_name          = "${local.name_prefix}-${each.key}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.ecs_cpu_threshold
  alarm_description   = "ECS service ${each.key} CPU utilization is high"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = each.value
  }

  tags = local.common_tags
}

# ECS Service Memory High
resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each = var.ecs_services

  alarm_name          = "${local.name_prefix}-${each.key}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.ecs_memory_threshold
  alarm_description   = "ECS service ${each.key} memory utilization is high"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = each.value
  }

  tags = local.common_tags
}

# =============================================================================
# LAMBDA FUNCTIONS FOR ALERT ROUTING
# =============================================================================

# Lambda function for PagerDuty integration
resource "aws_lambda_function" "pagerduty_forwarder" {
  count = var.enable_pagerduty ? 1 : 0

  filename         = data.archive_file.pagerduty_lambda[0].output_path
  function_name    = "${local.name_prefix}-pagerduty-forwarder"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.pagerduty_lambda[0].output_base64sha256
  runtime          = "python3.11"
  timeout          = 30

  environment {
    variables = {
      PAGERDUTY_INTEGRATION_KEY = var.pagerduty_integration_key
    }
  }

  tags = local.common_tags
}

# Lambda function for Slack integration
resource "aws_lambda_function" "slack_forwarder" {
  count = var.enable_slack ? 1 : 0

  filename         = data.archive_file.slack_lambda[0].output_path
  function_name    = "${local.name_prefix}-slack-forwarder"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.slack_lambda[0].output_base64sha256
  runtime          = "python3.11"
  timeout          = 30

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }

  tags = local.common_tags
}

# SNS subscriptions for Lambda functions
resource "aws_sns_topic_subscription" "pagerduty" {
  count = var.enable_pagerduty ? 1 : 0

  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.pagerduty_forwarder[0].arn
}

resource "aws_sns_topic_subscription" "slack" {
  count = var.enable_slack ? 1 : 0

  topic_arn = aws_sns_topic.warning_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_forwarder[0].arn
}

# Lambda permissions for SNS invocation
resource "aws_lambda_permission" "sns_pagerduty" {
  count = var.enable_pagerduty ? 1 : 0

  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pagerduty_forwarder[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.critical_alerts.arn
}

resource "aws_lambda_permission" "sns_slack" {
  count = var.enable_slack ? 1 : 0

  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_forwarder[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.warning_alerts.arn
}

# =============================================================================
# IAM ROLES FOR LAMBDA
# =============================================================================

resource "aws_iam_role" "lambda_execution" {
  count = var.enable_pagerduty || var.enable_slack ? 1 : 0

  name = "${local.name_prefix}-lambda-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  count = var.enable_pagerduty || var.enable_slack ? 1 : 0

  role       = aws_iam_role.lambda_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# =============================================================================
# LAMBDA FUNCTION CODE
# =============================================================================

# PagerDuty Lambda code
data "archive_file" "pagerduty_lambda" {
  count = var.enable_pagerduty ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/lambda_pagerduty.zip"

  source {
    content  = file("${path.module}/lambda/pagerduty_forwarder.py")
    filename = "index.py"
  }
}

# Slack Lambda code
data "archive_file" "slack_lambda" {
  count = var.enable_slack ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/lambda_slack.zip"

  source {
    content  = file("${path.module}/lambda/slack_forwarder.py")
    filename = "index.py"
  }
}

# =============================================================================
# CLOUDWATCH LOG GROUPS FOR LAMBDAS
# =============================================================================

resource "aws_cloudwatch_log_group" "pagerduty_lambda" {
  count = var.enable_pagerduty ? 1 : 0

  name              = "/aws/lambda/${aws_lambda_function.pagerduty_forwarder[0].function_name}"
  retention_in_days = 7

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "slack_lambda" {
  count = var.enable_slack ? 1 : 0

  name              = "/aws/lambda/${aws_lambda_function.slack_forwarder[0].function_name}"
  retention_in_days = 7

  tags = local.common_tags
}
