# =============================================================================
# Multi-Cloud Provider Configuration - Ananta Platform
# =============================================================================
# This file configures providers for all supported cloud platforms.
# The active provider is determined by var.cloud_provider
# =============================================================================

# -----------------------------------------------------------------------------
# AWS Provider
# -----------------------------------------------------------------------------

provider "aws" {
  region = var.cloud_provider == "aws" ? var.aws_region : "us-east-1"

  # Skip configuration if not using AWS
  skip_credentials_validation = var.cloud_provider != "aws"
  skip_requesting_account_id  = var.cloud_provider != "aws"
  skip_metadata_api_check     = var.cloud_provider != "aws"

  default_tags {
    tags = merge(
      {
        Project       = var.project_name
        Environment   = var.environment
        ManagedBy     = "terraform"
        Platform      = "ananta-saas"
        CloudProvider = var.cloud_provider
      },
      var.tags
    )
  }
}

# -----------------------------------------------------------------------------
# Azure Provider
# -----------------------------------------------------------------------------

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = var.environment == "prod"
    }
    key_vault {
      purge_soft_delete_on_destroy    = var.environment != "prod"
      recover_soft_deleted_key_vaults = true
    }
  }

  # Skip configuration if not using Azure
  skip_provider_registration = var.cloud_provider != "azure"

  # Azure-specific configuration (only used when cloud_provider = "azure")
  subscription_id = var.cloud_provider == "azure" ? var.azure_subscription_id : null
  tenant_id       = var.cloud_provider == "azure" ? var.azure_tenant_id : null
}

# -----------------------------------------------------------------------------
# GCP Provider
# -----------------------------------------------------------------------------

provider "google" {
  project = var.cloud_provider == "gcp" ? var.gcp_project_id : null
  region  = var.cloud_provider == "gcp" ? var.gcp_region : "us-central1"
}

provider "google-beta" {
  project = var.cloud_provider == "gcp" ? var.gcp_project_id : null
  region  = var.cloud_provider == "gcp" ? var.gcp_region : "us-central1"
}

# -----------------------------------------------------------------------------
# Kubernetes Provider (for cloud-agnostic K8s deployments)
# -----------------------------------------------------------------------------

provider "kubernetes" {
  # Configuration is provided dynamically based on the compute module outputs
  # or via kubeconfig for self-managed Kubernetes

  # For local/self-managed K8s
  config_path = var.cloud_provider == "kubernetes" ? var.kubeconfig_path : null

  # For managed K8s (EKS, AKS, GKE), these are set from module outputs
  # host                   = local.k8s_host
  # cluster_ca_certificate = local.k8s_ca_cert
  # token                  = local.k8s_token
}

# -----------------------------------------------------------------------------
# Helm Provider (for Kubernetes operator deployments)
# -----------------------------------------------------------------------------

provider "helm" {
  kubernetes {
    config_path = var.cloud_provider == "kubernetes" ? var.kubeconfig_path : null

    # For managed K8s, these are set from module outputs
    # host                   = local.k8s_host
    # cluster_ca_certificate = local.k8s_ca_cert
    # token                  = local.k8s_token
  }
}

# -----------------------------------------------------------------------------
# Random Provider (used for password generation, etc.)
# -----------------------------------------------------------------------------

provider "random" {}

# -----------------------------------------------------------------------------
# Null Provider (used for local-exec provisioners)
# -----------------------------------------------------------------------------

provider "null" {}

# -----------------------------------------------------------------------------
# Local Variables for Provider Configuration
# -----------------------------------------------------------------------------

locals {
  # Determine which cloud provider is active
  is_aws        = var.cloud_provider == "aws"
  is_azure      = var.cloud_provider == "azure"
  is_gcp        = var.cloud_provider == "gcp"
  is_kubernetes = var.cloud_provider == "kubernetes"

  # Cloud-specific naming conventions
  resource_prefix = {
    aws        = "${var.project_name}-${var.environment}"
    azure      = "${var.project_name}-${var.environment}"
    gcp        = "${var.project_name}-${var.environment}"
    kubernetes = "${var.project_name}-${var.environment}"
  }

  # Instance size normalization mapping
  # Maps our normalized sizes to cloud-specific instance types
  database_instance_sizes = {
    aws = {
      micro  = "db.t3.micro"
      small  = "db.t3.small"
      medium = "db.r6g.medium"
      large  = "db.r6g.large"
      xlarge = "db.r6g.xlarge"
    }
    azure = {
      micro  = "B_Gen5_1"
      small  = "B_Gen5_2"
      medium = "GP_Gen5_2"
      large  = "GP_Gen5_4"
      xlarge = "GP_Gen5_8"
    }
    gcp = {
      micro  = "db-f1-micro"
      small  = "db-g1-small"
      medium = "db-custom-2-4096"
      large  = "db-custom-4-8192"
      xlarge = "db-custom-8-16384"
    }
    kubernetes = {
      micro  = "256Mi/0.25"
      small  = "512Mi/0.5"
      medium = "2Gi/1"
      large  = "4Gi/2"
      xlarge = "8Gi/4"
    }
  }

  cache_instance_sizes = {
    aws = {
      micro  = "cache.t3.micro"
      small  = "cache.t3.small"
      medium = "cache.r6g.medium"
      large  = "cache.r6g.large"
      xlarge = "cache.r6g.xlarge"
    }
    azure = {
      micro  = "C0"
      small  = "C1"
      medium = "C2"
      large  = "P1"
      xlarge = "P2"
    }
    gcp = {
      micro  = "BASIC"
      small  = "BASIC"
      medium = "STANDARD_HA"
      large  = "STANDARD_HA"
      xlarge = "STANDARD_HA"
    }
    kubernetes = {
      micro  = "256Mi/0.25"
      small  = "512Mi/0.5"
      medium = "2Gi/1"
      large  = "4Gi/2"
      xlarge = "8Gi/4"
    }
  }
}
