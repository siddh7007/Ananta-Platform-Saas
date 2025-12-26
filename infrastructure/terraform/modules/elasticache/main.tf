# =============================================================================
# ElastiCache Redis Module
# =============================================================================
# Provisions Redis cluster for caching and session management
# =============================================================================

# -----------------------------------------------------------------------------
# Subnet Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name_prefix}-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-subnet-group"
  })
}

# -----------------------------------------------------------------------------
# Parameter Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.name_prefix}-redis-params"
  family = var.parameter_group_family

  # Redis configuration optimized for caching
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  # Enable keyspace notifications for pub/sub
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-params"
  })
}

# -----------------------------------------------------------------------------
# Security Group
# -----------------------------------------------------------------------------
# NOTE: Security group is now provided externally via var.redis_security_group_id
# to break circular dependencies. See modules/security-groups for
# centralized security group creation.

# -----------------------------------------------------------------------------
# Redis Replication Group (Cluster Mode Disabled)
# -----------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis cluster for ${var.name_prefix}"

  # Engine configuration
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  port                 = 6379

  # Cluster configuration
  num_cache_clusters         = var.num_cache_nodes
  automatic_failover_enabled = var.automatic_failover_enabled && var.num_cache_nodes > 1
  multi_az_enabled           = var.multi_az_enabled && var.num_cache_nodes > 1

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.redis_security_group_id]

  # Parameter group
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = var.transit_encryption_enabled
  auth_token                 = var.transit_encryption_enabled ? var.auth_token : null

  # Maintenance
  maintenance_window       = var.maintenance_window
  snapshot_window          = var.snapshot_window
  snapshot_retention_limit = var.snapshot_retention_limit
  auto_minor_version_upgrade = true

  # Notifications
  notification_topic_arn = var.sns_topic_arn

  # Apply changes immediately in non-prod
  apply_immediately = var.environment != "prod"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis"
  })

  lifecycle {
    ignore_changes = [
      engine_version,  # Managed via maintenance windows
    ]
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-redis-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Redis CPU utilization exceeds 75%"

  dimensions = {
    CacheClusterId = "${var.name_prefix}-redis-001"
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-redis-memory-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis memory usage exceeds 80%"

  dimensions = {
    CacheClusterId = "${var.name_prefix}-redis-001"
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000
  alarm_description   = "Redis evictions exceed 1000 in 5 minutes"

  dimensions = {
    CacheClusterId = "${var.name_prefix}-redis-001"
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-redis-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.max_connections_alarm_threshold
  alarm_description   = "Redis connections exceed threshold"

  dimensions = {
    CacheClusterId = "${var.name_prefix}-redis-001"
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = var.tags
}

# -----------------------------------------------------------------------------
# CloudWatch Dashboard (Optional)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "redis" {
  count = var.create_cloudwatch_dashboard ? 1 : 0

  dashboard_name = "${var.name_prefix}-redis-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "CPU Utilization"
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${var.name_prefix}-redis-001"]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Memory Usage"
          metrics = [
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "CacheClusterId", "${var.name_prefix}-redis-001"],
            [".", "BytesUsedForCache", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Cache Hits vs Misses"
          metrics = [
            ["AWS/ElastiCache", "CacheHits", "CacheClusterId", "${var.name_prefix}-redis-001"],
            [".", "CacheMisses", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Connections & Commands"
          metrics = [
            ["AWS/ElastiCache", "CurrConnections", "CacheClusterId", "${var.name_prefix}-redis-001"],
            [".", "NewConnections", ".", "."],
            [".", "SetTypeCmds", ".", "."],
            [".", "GetTypeCmds", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title   = "Evictions & Reclaimed"
          metrics = [
            ["AWS/ElastiCache", "Evictions", "CacheClusterId", "${var.name_prefix}-redis-001"],
            [".", "Reclaimed", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title   = "Network"
          metrics = [
            ["AWS/ElastiCache", "NetworkBytesIn", "CacheClusterId", "${var.name_prefix}-redis-001"],
            [".", "NetworkBytesOut", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      }
    ]
  })
}
