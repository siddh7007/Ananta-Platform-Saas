# =============================================================================
# AWS Database Module - RDS PostgreSQL Implementation
# =============================================================================
# AWS-specific implementation of the cloud-agnostic database interface
# Uses: Amazon RDS for PostgreSQL, RDS Proxy, Read Replicas
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables - Instance Size Mapping
# -----------------------------------------------------------------------------

locals {
  # Map normalized sizes to AWS RDS instance classes
  instance_class_map = {
    micro  = "db.t3.micro"
    small  = "db.t3.small"
    medium = "db.r6g.medium"
    large  = "db.r6g.large"
    xlarge = "db.r6g.xlarge"
  }

  instance_class = lookup(local.instance_class_map, var.instance_size, "db.t3.medium")

  # PostgreSQL version mapping (normalize to AWS-supported versions)
  pg_version_map = {
    "15" = "15.4"
    "14" = "14.9"
    "13" = "13.12"
  }

  pg_version = lookup(local.pg_version_map, var.engine_version, var.engine_version)

  # Derive parameter group family from version
  pg_family = "postgres${split(".", local.pg_version)[0]}"
}

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# -----------------------------------------------------------------------------
# DB Subnet Group
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
  })
}

# -----------------------------------------------------------------------------
# Security Group
# -----------------------------------------------------------------------------

resource "aws_security_group" "database" {
  count       = var.create_security_group ? 1 : 0
  name        = "${var.name_prefix}-db-sg"
  description = "Security group for ${var.name_prefix} PostgreSQL database"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from allowed security groups"
    from_port       = 5432
    to_port         = 5432
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
    Name = "${var.name_prefix}-db-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Parameter Group
# -----------------------------------------------------------------------------

resource "aws_db_parameter_group" "main" {
  name_prefix = "${var.name_prefix}-${local.pg_family}-"
  family      = local.pg_family
  description = "Parameter group for ${var.name_prefix}"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "pg_stat_statements.track"
    value = "all"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# RDS Instance
# -----------------------------------------------------------------------------

resource "aws_db_instance" "main" {
  identifier = "${var.name_prefix}-postgres"

  # Engine configuration
  engine               = "postgres"
  engine_version       = local.pg_version
  instance_class       = local.instance_class
  parameter_group_name = aws_db_parameter_group.main.name

  # Storage configuration
  allocated_storage     = var.storage_gb
  max_allocated_storage = var.max_storage_gb > 0 ? var.max_storage_gb : null
  storage_type          = "gp3"
  storage_encrypted     = var.encryption_enabled
  kms_key_id            = var.kms_key_id

  # Database configuration
  db_name  = var.database_name
  username = "postgres"
  password = random_password.master.result
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.create_security_group ? [aws_security_group.database[0].id] : [var.security_group_id]
  publicly_accessible    = var.publicly_accessible
  multi_az               = var.high_availability

  # Backup configuration
  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Monitoring
  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_retention_period = var.enable_performance_insights ? 7 : null
  monitoring_interval                   = var.enable_enhanced_monitoring ? var.monitoring_interval_seconds : 0
  monitoring_role_arn                   = var.enable_enhanced_monitoring ? aws_iam_role.rds_monitoring[0].arn : null
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  # Protection settings
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.name_prefix}-final-snapshot" : null
  copy_tags_to_snapshot     = true

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
  })
}

# -----------------------------------------------------------------------------
# Read Replica(s)
# -----------------------------------------------------------------------------

resource "aws_db_instance" "replica" {
  count               = var.create_read_replica ? var.replica_count : 0
  identifier          = "${var.name_prefix}-replica-${count.index + 1}"
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = local.instance_class

  publicly_accessible    = false
  vpc_security_group_ids = var.create_security_group ? [aws_security_group.database[0].id] : [var.security_group_id]

  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_retention_period = var.enable_performance_insights ? 7 : null

  monitoring_interval             = var.enable_enhanced_monitoring ? var.monitoring_interval_seconds : 0
  monitoring_role_arn             = var.enable_enhanced_monitoring ? aws_iam_role.rds_monitoring[0].arn : null
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  auto_minor_version_upgrade = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-replica-${count.index + 1}"
    Role = "replica"
  })

  depends_on = [aws_db_instance.main]
}

# -----------------------------------------------------------------------------
# RDS Proxy (Connection Pooling)
# -----------------------------------------------------------------------------

resource "aws_db_proxy" "main" {
  count                  = var.enable_connection_pooling ? 1 : 0
  name                   = "${var.name_prefix}-proxy"
  debug_logging          = var.environment != "prod"
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy[0].arn
  vpc_security_group_ids = var.create_security_group ? [aws_security_group.database[0].id] : [var.security_group_id]
  vpc_subnet_ids         = var.subnet_ids

  auth {
    auth_scheme               = "SECRETS"
    iam_auth                  = "DISABLED"
    secret_arn                = var.credentials_secret_arn
    client_password_auth_type = "POSTGRES_SCRAM_SHA_256"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-proxy"
  })

  depends_on = [aws_iam_role_policy.rds_proxy]
}

resource "aws_db_proxy_default_target_group" "main" {
  count         = var.enable_connection_pooling ? 1 : 0
  db_proxy_name = aws_db_proxy.main[0].name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = var.max_connections_percent
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "main" {
  count                  = var.enable_connection_pooling ? 1 : 0
  db_proxy_name          = aws_db_proxy.main[0].name
  target_group_name      = aws_db_proxy_default_target_group.main[0].name
  db_instance_identifier = aws_db_instance.main.identifier
}

# -----------------------------------------------------------------------------
# Enhanced Monitoring IAM Role
# -----------------------------------------------------------------------------

resource "aws_iam_role" "rds_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0
  name  = "${var.name_prefix}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count      = var.enable_enhanced_monitoring ? 1 : 0
  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# -----------------------------------------------------------------------------
# RDS Proxy IAM Role
# -----------------------------------------------------------------------------

resource "aws_iam_role" "rds_proxy" {
  count = var.enable_connection_pooling ? 1 : 0
  name  = "${var.name_prefix}-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "rds.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "rds_proxy" {
  count = var.enable_connection_pooling ? 1 : 0
  name  = "${var.name_prefix}-rds-proxy-policy"
  role  = aws_iam_role.rds_proxy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.credentials_secret_arn
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = var.kms_key_id != null ? var.kms_key_id : "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  alarm_name          = "${var.name_prefix}-db-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Database CPU utilization is too high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "free_storage_space" {
  alarm_name          = "${var.name_prefix}-db-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120 # 5 GB in bytes
  alarm_description   = "Database free storage space is too low"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${var.name_prefix}-db-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 100
  alarm_description   = "Database connections are too high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}
