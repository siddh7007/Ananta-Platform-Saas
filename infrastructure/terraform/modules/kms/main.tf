# =============================================================================
# KMS Module - Customer Managed Keys with Rotation
# =============================================================================
# Provides CMKs for encryption at rest:
# - RDS databases
# - S3 buckets
# - Secrets Manager
# - CloudWatch Logs
# - EBS volumes
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# -----------------------------------------------------------------------------
# KMS Key for RDS Databases
# -----------------------------------------------------------------------------

resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS database encryption - ${var.name_prefix}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = true
  multi_region            = var.multi_region

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
        Sid    = "Allow RDS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "rds.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${data.aws_region.current.name}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/rds/*"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-rds-kms"
    Purpose = "RDS database encryption"
  })
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.name_prefix}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for S3 Buckets
# -----------------------------------------------------------------------------

resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption - ${var.name_prefix}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = true
  multi_region            = var.multi_region

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
        Sid    = "Allow S3 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "s3.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      },
      {
        Sid    = "Allow CloudTrail to use the key for S3"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:GenerateDataKey*",
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringLike = {
            "kms:EncryptionContext:aws:s3:arn" = "arn:aws:s3:::${var.cloudtrail_bucket_name}/*"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-s3-kms"
    Purpose = "S3 bucket encryption"
  })
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.name_prefix}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for Secrets Manager
# -----------------------------------------------------------------------------

resource "aws_kms_key" "secrets" {
  description             = "KMS key for Secrets Manager - ${var.name_prefix}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = true
  multi_region            = var.multi_region

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
        Sid    = "Allow Secrets Manager to use the key"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      },
      {
        Sid    = "Allow ECS Tasks to decrypt secrets"
        Effect = "Allow"
        Principal = {
          AWS = var.ecs_task_execution_role_arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-secrets-kms"
    Purpose = "Secrets Manager encryption"
  })
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.name_prefix}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for CloudWatch Logs
# -----------------------------------------------------------------------------

resource "aws_kms_key" "cloudwatch" {
  description             = "KMS key for CloudWatch Logs encryption - ${var.name_prefix}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = true
  multi_region            = var.multi_region

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
        Sid    = "Allow CloudWatch Logs to use the key"
        Effect = "Allow"
        Principal = {
          Service = "logs.${data.aws_region.current.name}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:*"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-cloudwatch-kms"
    Purpose = "CloudWatch Logs encryption"
  })
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/${var.name_prefix}-cloudwatch"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for EBS Volumes
# -----------------------------------------------------------------------------

resource "aws_kms_key" "ebs" {
  description             = "KMS key for EBS volume encryption - ${var.name_prefix}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = true
  multi_region            = var.multi_region

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
        Sid    = "Allow EC2 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ec2.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      },
      {
        Sid    = "Allow autoscaling to use the key"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService"    = "ec2.${data.aws_region.current.name}.amazonaws.com"
            "kms:CallerAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-ebs-kms"
    Purpose = "EBS volume encryption"
  })
}

resource "aws_kms_alias" "ebs" {
  name          = "alias/${var.name_prefix}-ebs"
  target_key_id = aws_kms_key.ebs.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for Amazon MQ (RabbitMQ)
# -----------------------------------------------------------------------------

resource "aws_kms_key" "mq" {
  description             = "KMS key for Amazon MQ encryption - ${var.name_prefix}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = true
  multi_region            = var.multi_region

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
        Sid    = "Allow Amazon MQ to use the key"
        Effect = "Allow"
        Principal = {
          Service = "mq.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "mq.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-mq-kms"
    Purpose = "Amazon MQ encryption"
  })
}

resource "aws_kms_alias" "mq" {
  name          = "alias/${var.name_prefix}-mq"
  target_key_id = aws_kms_key.mq.key_id
}
