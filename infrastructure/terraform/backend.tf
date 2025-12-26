# =============================================================================
# Terraform Backend Configuration
# =============================================================================
# This file configures the remote state backend for Terraform.
# Using S3 (or compatible) backend with DynamoDB for state locking.
#
# IMPORTANT: Before using this configuration:
# 1. Create the S3 bucket manually or via bootstrap script
# 2. Create the DynamoDB table for state locking
# 3. Configure AWS credentials with appropriate permissions
#
# Bootstrap commands (run once per AWS account):
#   aws s3api create-bucket --bucket ananta-terraform-state-${AWS_ACCOUNT_ID} \
#     --region ${AWS_REGION} --create-bucket-configuration LocationConstraint=${AWS_REGION}
#   aws s3api put-bucket-versioning --bucket ananta-terraform-state-${AWS_ACCOUNT_ID} \
#     --versioning-configuration Status=Enabled
#   aws s3api put-bucket-encryption --bucket ananta-terraform-state-${AWS_ACCOUNT_ID} \
#     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
#   aws dynamodb create-table --table-name ananta-terraform-locks \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST
# =============================================================================

terraform {
  # The backend block cannot contain variable interpolation.
  # Use partial configuration and pass remaining values via -backend-config
  # Example: terraform init -backend-config="bucket=ananta-terraform-state-123456789012"

  backend "s3" {
    # These values should be provided via -backend-config or backend.hcl files
    # bucket         = "ananta-terraform-state-ACCOUNT_ID"
    key            = "ananta-platform/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ananta-terraform-locks"

    # Enable workspace prefix for multi-environment support
    # workspace_key_prefix = "env"
  }

  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# =============================================================================
# Alternative Backend Configurations (Commented)
# =============================================================================
# Uncomment the appropriate backend for your cloud provider

# --- Azure Backend ---
# terraform {
#   backend "azurerm" {
#     resource_group_name  = "ananta-terraform-rg"
#     storage_account_name = "anantaterraformstate"
#     container_name       = "tfstate"
#     key                  = "ananta-platform/terraform.tfstate"
#   }
# }

# --- GCP Backend ---
# terraform {
#   backend "gcs" {
#     bucket = "ananta-terraform-state"
#     prefix = "ananta-platform"
#   }
# }

# --- Terraform Cloud Backend ---
# terraform {
#   cloud {
#     organization = "ananta-platform"
#     workspaces {
#       tags = ["ananta", "platform"]
#     }
#   }
# }
