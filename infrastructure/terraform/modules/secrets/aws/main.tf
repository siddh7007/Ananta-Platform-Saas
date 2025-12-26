# =============================================================================
# AWS Secrets Module - Secrets Manager Implementation
# =============================================================================
# AWS-specific implementation of the cloud-agnostic secrets interface.
# Uses AWS Secrets Manager with optional rotation via Lambda.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  secret_name_prefix = "${var.secrets_prefix}/${var.name_prefix}"
}

# -----------------------------------------------------------------------------
# Generic Secrets
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "secrets" {
  for_each = var.secrets

  name        = "${local.secret_name_prefix}/${each.key}"
  description = each.value.description

  recovery_window_in_days = var.recovery_window_days

  dynamic "replica" {
    for_each = var.replica_regions
    content {
      region = replica.value
    }
  }

  kms_key_id = var.kms_key_arn

  tags = merge(var.tags, {
    Name        = each.key
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "secrets" {
  for_each = var.secrets

  secret_id     = aws_secretsmanager_secret.secrets[each.key].id
  secret_string = jsonencode(each.value.value)
}

# -----------------------------------------------------------------------------
# Database Secrets (with special structure)
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "database" {
  for_each = var.database_secrets

  name        = "${local.secret_name_prefix}/db/${each.key}"
  description = "Database credentials for ${each.key}"

  recovery_window_in_days = var.recovery_window_days

  kms_key_id = var.kms_key_arn

  tags = merge(var.tags, {
    Name        = "${each.key}-db"
    Environment = var.environment
    Type        = "database"
  })
}

resource "aws_secretsmanager_secret_version" "database" {
  for_each = var.database_secrets

  secret_id = aws_secretsmanager_secret.database[each.key].id
  secret_string = jsonencode({
    host              = each.value.host
    port              = each.value.port
    dbname            = each.value.database
    username          = each.value.username
    password          = each.value.password
    engine            = each.value.engine
    connection_string = "${each.value.engine}://${each.value.username}:${each.value.password}@${each.value.host}:${each.value.port}/${each.value.database}"
  })
}

# -----------------------------------------------------------------------------
# Auto-Generated Secrets
# -----------------------------------------------------------------------------

resource "random_password" "generated" {
  for_each = var.generated_secrets

  length           = each.value.length
  special          = each.value.special
  override_special = each.value.override_special
  upper            = each.value.upper
  lower            = each.value.lower
  numeric          = each.value.numeric
}

resource "aws_secretsmanager_secret" "generated" {
  for_each = var.generated_secrets

  name        = "${local.secret_name_prefix}/${each.key}"
  description = each.value.description

  recovery_window_in_days = var.recovery_window_days

  kms_key_id = var.kms_key_arn

  tags = merge(var.tags, {
    Name        = each.key
    Environment = var.environment
    Generated   = "true"
  })
}

resource "aws_secretsmanager_secret_version" "generated" {
  for_each = var.generated_secrets

  secret_id     = aws_secretsmanager_secret.generated[each.key].id
  secret_string = random_password.generated[each.key].result
}

# -----------------------------------------------------------------------------
# Secret Rotation (Optional)
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret_rotation" "database" {
  for_each = var.enable_rotation ? var.database_secrets : {}

  secret_id           = aws_secretsmanager_secret.database[each.key].id
  rotation_lambda_arn = var.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }
}

# -----------------------------------------------------------------------------
# IAM Policy for Secrets Access
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "secrets_read" {
  count = var.create_access_policy ? 1 : 0

  name        = "${var.name_prefix}-secrets-read"
  description = "Read-only access to secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = concat(
          [for s in aws_secretsmanager_secret.secrets : s.arn],
          [for s in aws_secretsmanager_secret.database : s.arn],
          [for s in aws_secretsmanager_secret.generated : s.arn]
        )
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.kms_key_arn != null ? [var.kms_key_arn] : []
        Condition = var.kms_key_arn != null ? {} : null
      }
    ]
  })

  tags = var.tags
}
