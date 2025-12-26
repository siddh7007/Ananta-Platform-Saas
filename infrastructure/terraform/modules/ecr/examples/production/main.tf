# =============================================================================
# ECR Module - Production Example
# =============================================================================
# Production-ready ECR setup with all security and DR features enabled
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

provider "aws" {
  region = "us-east-1"
}

# KMS key for ECR encryption
resource "aws_kms_key" "ecr" {
  description             = "KMS key for ECR encryption - Production"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "ecr-encryption-key-prod"
    Environment = "prod"
  }
}

resource "aws_kms_alias" "ecr" {
  name          = "alias/ecr-prod"
  target_key_id = aws_kms_key.ecr.key_id
}

# SNS topic for security alerts
resource "aws_sns_topic" "security_alerts" {
  name              = "ecr-security-alerts-prod"
  display_name      = "ECR Security Alerts - Production"
  kms_master_key_id = aws_kms_key.ecr.arn

  tags = {
    Name        = "ecr-security-alerts"
    Environment = "prod"
  }
}

resource "aws_sns_topic_subscription" "security_email" {
  topic_arn = aws_sns_topic.security_alerts.arn
  protocol  = "email"
  endpoint  = "devops@ananta-platform.com"  # Replace with your email
}

# GitHub Actions OIDC provider for CI/CD
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]

  tags = {
    Name        = "github-actions-oidc"
    Environment = "prod"
  }
}

# IAM role for GitHub Actions
resource "aws_iam_role" "github_actions_ecr" {
  name = "github-actions-ecr-push-prod"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:your-org/ananta-platform-saas:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "github-actions-ecr-push"
    Environment = "prod"
  }
}

# ECR push permissions for GitHub Actions
resource "aws_iam_role_policy" "github_actions_ecr_push" {
  name = "ecr-push-policy"
  role = aws_iam_role.github_actions_ecr.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "arn:aws:ecr:us-east-1:*:repository/ananta-*"
      }
    ]
  })
}

# Production ECR module configuration
module "ecr" {
  source = "../../"

  name_prefix = "ananta"
  environment = "prod"

  # Security - Maximum security for production
  image_tag_mutability = "IMMUTABLE"  # Prevent tag overwrites
  scan_on_push         = true
  encryption_type      = "KMS"
  kms_key_arn          = aws_kms_key.ecr.arn

  # Lifecycle policies - Retain more images in production
  keep_tagged_images_count = 30
  keep_dev_images_count    = 10
  untagged_image_days      = 7
  keep_any_images_count    = 100

  # CI/CD access
  cicd_role_arns = [
    aws_iam_role.github_actions_ecr.arn
  ]

  # Disaster recovery - Enable replication to us-west-2
  enable_replication = true
  replication_region = "us-west-2"

  # Monitoring - Enable all alarms
  enable_vulnerability_alarms      = true
  critical_vulnerability_threshold = 0  # Alert on ANY critical CVE
  alarm_sns_topic_arns             = [aws_sns_topic.security_alerts.arn]

  tags = {
    Environment = "prod"
    Project     = "ananta-platform"
    ManagedBy   = "terraform"
    CostCenter  = "platform-ops"
    Compliance  = "required"
  }
}

# Outputs
output "registry_url" {
  description = "ECR registry URL"
  value       = module.ecr.registry_url
}

output "control_plane_repository_urls" {
  description = "Control plane ECR repository URLs"
  value       = module.ecr.control_plane_repository_urls
}

output "app_plane_repository_urls" {
  description = "App plane ECR repository URLs"
  value       = module.ecr.app_plane_repository_urls
}

output "docker_login_command" {
  description = "Command to login to ECR"
  value       = module.ecr.docker_login_command
  sensitive   = true
}

output "github_actions_role_arn" {
  description = "GitHub Actions IAM role ARN for CI/CD"
  value       = aws_iam_role.github_actions_ecr.arn
}

output "security_alerts_topic_arn" {
  description = "SNS topic ARN for security alerts"
  value       = aws_sns_topic.security_alerts.arn
}

output "replication_config" {
  description = "ECR replication configuration"
  value = {
    enabled            = module.ecr.replication_enabled
    destination_region = module.ecr.replication_destination
  }
}
