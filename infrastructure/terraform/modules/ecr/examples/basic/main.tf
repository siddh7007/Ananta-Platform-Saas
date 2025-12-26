# =============================================================================
# ECR Module - Basic Example
# =============================================================================
# Minimal ECR setup for development environment
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
  description             = "KMS key for ECR encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "ecr-encryption-key"
    Environment = "dev"
  }
}

resource "aws_kms_alias" "ecr" {
  name          = "alias/ecr-dev"
  target_key_id = aws_kms_key.ecr.key_id
}

# Basic ECR module usage
module "ecr" {
  source = "../../"

  name_prefix = "ananta"
  environment = "dev"

  # Security
  scan_on_push    = true
  encryption_type = "KMS"
  kms_key_arn     = aws_kms_key.ecr.arn

  # Lifecycle policies - conservative for dev
  keep_tagged_images_count = 5
  keep_dev_images_count    = 5
  untagged_image_days      = 3
  keep_any_images_count    = 20

  # Monitoring - disabled for dev
  enable_vulnerability_alarms = false

  tags = {
    Environment = "dev"
    Project     = "ananta-platform"
    ManagedBy   = "terraform"
  }
}

# Outputs
output "registry_url" {
  description = "ECR registry URL"
  value       = module.ecr.registry_url
}

output "repository_urls" {
  description = "All ECR repository URLs"
  value       = module.ecr.all_repository_urls
}

output "docker_login_command" {
  description = "Command to login to ECR"
  value       = module.ecr.docker_login_command
}
