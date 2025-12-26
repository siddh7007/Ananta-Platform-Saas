# =============================================================================
# AWS Cache Module - ElastiCache Redis Implementation
# =============================================================================
# AWS-specific implementation of the cloud-agnostic cache interface.
# Uses Amazon ElastiCache for Redis with replication group.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables - Instance Size Mapping
# -----------------------------------------------------------------------------

locals {
  # Map normalized sizes to AWS ElastiCache node types
  node_type_map = {
    micro  = "cache.t3.micro"
    small  = "cache.t3.small"
    medium = "cache.r6g.medium"
    large  = "cache.r6g.large"
    xlarge = "cache.r6g.xlarge"
  }

  node_type = lookup(local.node_type_map, var.instance_size, "cache.t3.small")

  # Parameter group family based on Redis version
  parameter_group_family = "redis${split(".", var.engine_version)[0]}"
}

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
# Security Group (Optional)
# -----------------------------------------------------------------------------

resource "aws_security_group" "redis" {
  count       = var.create_security_group ? 1 : 0
  name        = "${var.name_prefix}-redis-sg"
  description = "Security group for ${var.name_prefix} Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from allowed security groups"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Parameter Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.name_prefix}-redis-params"
  family = local.parameter_group_family

  # Redis configuration optimized for caching
  parameter {
    name  = "maxmemory-policy"
    value = var.maxmemory_policy
  }

  parameter {
    name  = "timeout"
    value = tostring(var.timeout_seconds)
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  # Enable keyspace notifications for pub/sub
  parameter {
    name  = "notify-keyspace-events"
    value = var.notify_keyspace_events
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-params"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Redis Replication Group
# -----------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis cluster for ${var.name_prefix}"

  # Engine configuration
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = local.node_type
  port                 = 6379

  # Cluster configuration
  num_cache_clusters         = var.high_availability ? max(var.replica_count + 1, 2) : 1
  automatic_failover_enabled = var.high_availability && var.replica_count >= 1
  multi_az_enabled           = var.high_availability && var.replica_count >= 1

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = var.create_security_group ? [aws_security_group.redis[0].id] : [var.security_group_id]

  # Parameter group
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # Encryption
  at_rest_encryption_enabled = var.encryption_at_rest
  transit_encryption_enabled = var.encryption_in_transit
  auth_token                 = var.encryption_in_transit ? var.auth_token : null

  # Maintenance
  maintenance_window         = var.maintenance_window
  snapshot_window            = var.snapshot_window
  snapshot_retention_limit   = var.snapshot_retention_days
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

resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  count = var.create_alarms ? 1 : 0

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

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "memory_usage" {
  count = var.create_alarms ? 1 : 0

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

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "evictions" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = var.evictions_alarm_threshold
  alarm_description   = "Redis evictions exceed threshold"

  dimensions = {
    CacheClusterId = "${var.name_prefix}-redis-001"
  }

  alarm_actions = var.alarm_actions

  tags = var.tags
}
