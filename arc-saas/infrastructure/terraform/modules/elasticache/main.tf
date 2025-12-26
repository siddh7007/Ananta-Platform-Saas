# =============================================================================
# ARC-SaaS ElastiCache Module
# =============================================================================
# Creates ElastiCache Redis cluster for caching and session management

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Auth Token Generation (for Redis AUTH)
# -----------------------------------------------------------------------------

resource "random_password" "redis_auth_token" {
  count   = var.transit_encryption_enabled && var.auth_token == null ? 1 : 0
  length  = 32
  special = false
}

locals {
  auth_token = var.transit_encryption_enabled ? (var.auth_token != null ? var.auth_token : random_password.redis_auth_token[0].result) : null
}

# -----------------------------------------------------------------------------
# ElastiCache Parameter Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "main" {
  family = "redis${var.redis_version}"
  name   = "${var.project_name}-${var.environment}-redis-params"

  # Memory management
  parameter {
    name  = "maxmemory-policy"
    value = var.maxmemory_policy
  }

  # Connection management
  parameter {
    name  = "timeout"
    value = "300"
  }

  # Persistence settings
  parameter {
    name  = "appendonly"
    value = "yes"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-params"
  })
}

# -----------------------------------------------------------------------------
# ElastiCache Replication Group (Redis Cluster)
# -----------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Redis cluster for ${var.project_name} ${var.environment}"

  # Engine configuration
  engine               = "redis"
  engine_version       = var.redis_version
  node_type            = var.node_type
  parameter_group_name = aws_elasticache_parameter_group.main.name
  port                 = 6379

  # Cluster configuration
  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  # Network configuration
  subnet_group_name  = var.subnet_group_name
  security_group_ids = var.security_group_ids

  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = var.transit_encryption_enabled
  auth_token                 = local.auth_token

  # Maintenance configuration
  maintenance_window         = "Mon:03:00-Mon:04:00"
  snapshot_window            = "02:00-03:00"
  snapshot_retention_limit   = var.snapshot_retention_days
  auto_minor_version_upgrade = true
  apply_immediately          = var.environment != "prod"

  # Notifications
  notification_topic_arn = var.notification_topic_arn

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis"
  })

  lifecycle {
    ignore_changes = [num_cache_clusters]
  }
}

# -----------------------------------------------------------------------------
# Secrets Manager for Redis Credentials
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "redis_credentials" {
  count       = var.transit_encryption_enabled ? 1 : 0
  name        = "${var.project_name}/${var.environment}/redis/credentials"
  description = "Redis credentials for ${var.project_name} ${var.environment}"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  count     = var.transit_encryption_enabled ? 1 : 0
  secret_id = aws_secretsmanager_secret.redis_credentials[0].id
  secret_string = jsonencode({
    auth_token           = local.auth_token
    primary_endpoint     = aws_elasticache_replication_group.main.primary_endpoint_address
    reader_endpoint      = aws_elasticache_replication_group.main.reader_endpoint_address
    port                 = 6379
    connection_string    = "rediss://:${local.auth_token}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
    reader_connection    = "rediss://:${local.auth_token}@${aws_elasticache_replication_group.main.reader_endpoint_address}:6379"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Redis CPU utilization is high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    CacheClusterId = "${var.project_name}-${var.environment}-redis-001"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "memory_usage" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Redis memory usage is high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    CacheClusterId = "${var.project_name}-${var.environment}-redis-001"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "evictions" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-redis-evictions-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000
  alarm_description   = "Redis evictions are high - consider scaling up"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    CacheClusterId = "${var.project_name}-${var.environment}-redis-001"
  }

  tags = var.tags
}
