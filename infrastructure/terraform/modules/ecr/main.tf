# =============================================================================
# ECR Module - Container Registry with Security Scanning
# =============================================================================
# Creates ECR repositories for all microservices with:
# - Image scanning on push
# - KMS encryption
# - Lifecycle policies for cleanup
# - Cross-account pull permissions (optional)
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# ECR Repositories - Control Plane Services
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "control_plane" {
  for_each = toset(var.control_plane_services)

  name                 = "${var.name_prefix}-control-plane-${each.key}"
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = var.encryption_type
    kms_key         = var.encryption_type == "KMS" ? var.kms_key_arn : null
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.name_prefix}-control-plane-${each.key}"
      Service     = each.key
      Plane       = "control"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  )
}

# -----------------------------------------------------------------------------
# ECR Repositories - App Plane Services
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "app_plane" {
  for_each = toset(var.app_plane_services)

  name                 = "${var.name_prefix}-app-plane-${each.key}"
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = var.encryption_type
    kms_key         = var.encryption_type == "KMS" ? var.kms_key_arn : null
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.name_prefix}-app-plane-${each.key}"
      Service     = each.key
      Plane       = "app"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  )
}

# -----------------------------------------------------------------------------
# Lifecycle Policies - Automatic Image Cleanup
# -----------------------------------------------------------------------------

resource "aws_ecr_lifecycle_policy" "control_plane" {
  for_each   = aws_ecr_repository.control_plane
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.keep_tagged_images_count} tagged production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["prod", "v"]
          countType     = "imageCountMoreThan"
          countNumber   = var.keep_tagged_images_count
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last ${var.keep_dev_images_count} dev/staging tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["dev", "staging", "test"]
          countType     = "imageCountMoreThan"
          countNumber   = var.keep_dev_images_count
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Remove untagged images older than ${var.untagged_image_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_image_days
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 4
        description  = "Keep only ${var.keep_any_images_count} total images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.keep_any_images_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "app_plane" {
  for_each   = aws_ecr_repository.app_plane
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.keep_tagged_images_count} tagged production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["prod", "v"]
          countType     = "imageCountMoreThan"
          countNumber   = var.keep_tagged_images_count
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last ${var.keep_dev_images_count} dev/staging tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["dev", "staging", "test"]
          countType     = "imageCountMoreThan"
          countNumber   = var.keep_dev_images_count
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Remove untagged images older than ${var.untagged_image_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_image_days
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Repository Policies - Cross-Account Pull Permissions
# -----------------------------------------------------------------------------

resource "aws_ecr_repository_policy" "control_plane_cross_account" {
  for_each   = var.allow_pull_accounts != null ? aws_ecr_repository.control_plane : {}
  repository = each.value.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCrossAccountPull"
        Effect = "Allow"
        Principal = {
          AWS = var.allow_pull_accounts
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      },
      {
        Sid    = "AllowCrossAccountListImages"
        Effect = "Allow"
        Principal = {
          AWS = var.allow_pull_accounts
        }
        Action = [
          "ecr:ListImages",
          "ecr:DescribeImages"
        ]
      }
    ]
  })
}

resource "aws_ecr_repository_policy" "app_plane_cross_account" {
  for_each   = var.allow_pull_accounts != null ? aws_ecr_repository.app_plane : {}
  repository = each.value.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCrossAccountPull"
        Effect = "Allow"
        Principal = {
          AWS = var.allow_pull_accounts
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Repository Policies - CI/CD Push Permissions
# -----------------------------------------------------------------------------

resource "aws_ecr_repository_policy" "cicd_push" {
  for_each   = var.cicd_role_arns != null ? merge(aws_ecr_repository.control_plane, aws_ecr_repository.app_plane) : {}
  repository = each.value.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCICDPush"
        Effect = "Allow"
        Principal = {
          AWS = var.cicd_role_arns
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Replication Configuration (Multi-Region DR)
# -----------------------------------------------------------------------------

resource "aws_ecr_replication_configuration" "main" {
  count = var.enable_replication ? 1 : 0

  replication_configuration {
    rule {
      destination {
        region      = var.replication_region
        registry_id = var.replication_registry_id != null ? var.replication_registry_id : data.aws_caller_identity.current.account_id
      }

      repository_filter {
        filter      = "${var.name_prefix}-*"
        filter_type = "PREFIX_MATCH"
      }
    }
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Image Vulnerabilities
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "critical_vulnerabilities" {
  for_each = var.enable_vulnerability_alarms ? merge(
    aws_ecr_repository.control_plane,
    aws_ecr_repository.app_plane
  ) : {}

  alarm_name          = "${each.value.name}-critical-vulnerabilities"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CriticalVulnerabilityCount"
  namespace           = "AWS/ECR"
  period              = 3600
  statistic           = "Maximum"
  threshold           = var.critical_vulnerability_threshold
  alarm_description   = "Alert when critical vulnerabilities detected in ${each.value.name}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    RepositoryName = each.value.name
  }

  alarm_actions = var.alarm_sns_topic_arns

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# -----------------------------------------------------------------------------
# SSM Parameters for Container Image URIs
# -----------------------------------------------------------------------------

resource "aws_ssm_parameter" "control_plane_image_uris" {
  for_each = aws_ecr_repository.control_plane

  name        = "/${var.environment}/ecr/control-plane/${each.key}/uri"
  description = "ECR URI for ${each.key} service"
  type        = "String"
  value       = each.value.repository_url

  tags = merge(
    var.tags,
    {
      Service = each.key
      Plane   = "control"
    }
  )
}

resource "aws_ssm_parameter" "app_plane_image_uris" {
  for_each = aws_ecr_repository.app_plane

  name        = "/${var.environment}/ecr/app-plane/${each.key}/uri"
  description = "ECR URI for ${each.key} service"
  type        = "String"
  value       = each.value.repository_url

  tags = merge(
    var.tags,
    {
      Service = each.key
      Plane   = "app"
    }
  )
}
