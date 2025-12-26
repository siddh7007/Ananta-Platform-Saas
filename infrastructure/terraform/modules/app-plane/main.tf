# =============================================================================
# App Plane Module
# =============================================================================
# Provisions App Plane infrastructure:
# - Amazon MQ (RabbitMQ) for message queuing
# - S3 buckets for BOM storage and assets
# - Additional resources for App Plane services
# =============================================================================

# -----------------------------------------------------------------------------
# Amazon MQ (RabbitMQ) Broker
# -----------------------------------------------------------------------------

resource "random_password" "rabbitmq" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}:?"
}

resource "aws_mq_broker" "rabbitmq" {
  broker_name        = "${var.name_prefix}-rabbitmq"
  engine_type        = "RabbitMQ"
  engine_version     = var.mq_engine_version
  host_instance_type = var.mq_instance_type
  deployment_mode    = var.mq_deployment_mode

  # Security
  publicly_accessible = false
  security_groups     = [aws_security_group.rabbitmq.id]
  subnet_ids          = var.mq_deployment_mode == "SINGLE_INSTANCE" ? [var.private_subnet_ids[0]] : var.private_subnet_ids

  # Authentication
  user {
    username = "admin"
    password = random_password.rabbitmq.result
  }

  # Maintenance
  maintenance_window_start_time {
    day_of_week = "SUNDAY"
    time_of_day = "04:00"
    time_zone   = "UTC"
  }

  # Logging
  logs {
    general = true
  }

  # Encryption with customer managed KMS key
  encryption_options {
    use_aws_owned_key = var.kms_key_id_mq == null
    kms_key_id        = var.kms_key_id_mq
  }

  auto_minor_version_upgrade = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rabbitmq"
  })
}

# RabbitMQ Security Group
resource "aws_security_group" "rabbitmq" {
  name        = "${var.name_prefix}-rabbitmq-sg"
  description = "Security group for RabbitMQ broker"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rabbitmq-sg"
  })
}

resource "aws_security_group_rule" "rabbitmq_amqp_ingress" {
  type                     = "ingress"
  from_port                = 5671
  to_port                  = 5671
  protocol                 = "tcp"
  source_security_group_id = var.ecs_security_group_id
  security_group_id        = aws_security_group.rabbitmq.id
  description              = "Allow AMQP over TLS from ECS"
}

resource "aws_security_group_rule" "rabbitmq_https_ingress" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = var.ecs_security_group_id
  security_group_id        = aws_security_group.rabbitmq.id
  description              = "Allow HTTPS management console from ECS"
}

resource "aws_security_group_rule" "rabbitmq_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.rabbitmq.id
  description       = "Allow all outbound traffic"
}

# -----------------------------------------------------------------------------
# S3 Bucket - BOM Storage
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "bom" {
  bucket = "${var.s3_bucket_prefix}-${var.environment}-bom-${var.aws_account_id}"

  tags = merge(var.tags, {
    Name    = "${var.s3_bucket_prefix}-${var.environment}-bom"
    Purpose = "BOM file storage"
  })
}

resource "aws_s3_bucket_versioning" "bom" {
  bucket = aws_s3_bucket.bom.id
  versioning_configuration {
    status = var.enable_s3_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bom" {
  bucket = aws_s3_bucket.bom.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id_s3
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "bom" {
  bucket = aws_s3_bucket.bom.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "bom" {
  bucket = aws_s3_bucket.bom.id

  rule {
    id     = "archive-old-boms"
    status = "Enabled"

    filter {
      prefix = "uploads/"
    }

    transition {
      days          = var.s3_lifecycle_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = var.s3_lifecycle_days * 2
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# CORS configuration for direct uploads
resource "aws_s3_bucket_cors_configuration" "bom" {
  bucket = aws_s3_bucket.bom.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# -----------------------------------------------------------------------------
# S3 Bucket - Assets
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "assets" {
  bucket = "${var.s3_bucket_prefix}-${var.environment}-assets-${var.aws_account_id}"

  tags = merge(var.tags, {
    Name    = "${var.s3_bucket_prefix}-${var.environment}-assets"
    Purpose = "Static assets storage"
  })
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = var.enable_s3_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront origin access identity for assets bucket
resource "aws_cloudfront_origin_access_identity" "assets" {
  count = var.enable_cloudfront ? 1 : 0

  comment = "OAI for ${var.s3_bucket_prefix}-${var.environment}-assets"
}

resource "aws_s3_bucket_policy" "assets_cloudfront" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.assets[0].iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# S3 Bucket - Exports
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "exports" {
  bucket = "${var.s3_bucket_prefix}-${var.environment}-exports-${var.aws_account_id}"

  tags = merge(var.tags, {
    Name    = "${var.s3_bucket_prefix}-${var.environment}-exports"
    Purpose = "Export files (reports, data exports)"
  })
}

resource "aws_s3_bucket_versioning" "exports" {
  bucket = aws_s3_bucket.exports.id
  versioning_configuration {
    status = "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "exports" {
  bucket = aws_s3_bucket.exports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    id     = "expire-exports"
    status = "Enabled"

    expiration {
      days = 30  # Exports deleted after 30 days
    }
  }
}

# -----------------------------------------------------------------------------
# IAM Policy for S3 Access
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "s3_access" {
  name        = "${var.name_prefix}-s3-access"
  description = "Policy for ECS tasks to access S3 buckets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BOMBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.bom.arn,
          "${aws_s3_bucket.bom.arn}/*"
        ]
      },
      {
        Sid    = "AssetsBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.assets.arn,
          "${aws_s3_bucket.assets.arn}/*"
        ]
      },
      {
        Sid    = "ExportsBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.exports.arn,
          "${aws_s3_bucket.exports.arn}/*"
        ]
      }
    ]
  })

  tags = var.tags
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups for App Plane Services
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "cns_service" {
  name              = "/ecs/${var.name_prefix}/cns-service"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.cloudwatch_kms_key_id

  tags = merge(var.tags, {
    Service = "cns-service"
  })
}

resource "aws_cloudwatch_log_group" "enrichment_worker" {
  name              = "/ecs/${var.name_prefix}/enrichment-worker"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.cloudwatch_kms_key_id

  tags = merge(var.tags, {
    Service = "enrichment-worker"
  })
}

# -----------------------------------------------------------------------------
# SQS Queues (Alternative to RabbitMQ for AWS-native)
# -----------------------------------------------------------------------------

resource "aws_sqs_queue" "enrichment_dlq" {
  count = var.use_sqs_instead_of_rabbitmq ? 1 : 0

  name                      = "${var.name_prefix}-enrichment-dlq"
  message_retention_seconds = 1209600  # 14 days

  tags = merge(var.tags, {
    Purpose = "Dead letter queue for enrichment"
  })
}

resource "aws_sqs_queue" "enrichment" {
  count = var.use_sqs_instead_of_rabbitmq ? 1 : 0

  name                       = "${var.name_prefix}-enrichment"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400  # 1 day
  receive_wait_time_seconds  = 20  # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.enrichment_dlq[0].arn
    maxReceiveCount     = 3
  })

  tags = merge(var.tags, {
    Purpose = "Enrichment job queue"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rabbitmq_messages" {
  count = var.create_cloudwatch_alarms && !var.use_sqs_instead_of_rabbitmq ? 1 : 0

  alarm_name          = "${var.name_prefix}-rabbitmq-message-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MessageCount"
  namespace           = "AWS/AmazonMQ"
  period              = 300
  statistic           = "Average"
  threshold           = 10000
  alarm_description   = "RabbitMQ message count exceeds 10,000"

  dimensions = {
    Broker = aws_mq_broker.rabbitmq.broker_name
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "s3_bom_size" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-bom-bucket-size"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = 86400
  statistic           = "Average"
  threshold           = 107374182400  # 100 GB
  alarm_description   = "BOM bucket size exceeds 100 GB"

  dimensions = {
    BucketName  = aws_s3_bucket.bom.id
    StorageType = "StandardStorage"
  }

  alarm_actions = var.alarm_actions

  tags = var.tags
}
