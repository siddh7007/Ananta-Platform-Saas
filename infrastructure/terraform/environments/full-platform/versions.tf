#
# Ananta Platform SaaS - Provider Versions
# Terraform and provider version constraints
#

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20.0, < 3.0.0"
    }

    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.10.0, < 3.0.0"
    }

    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0, < 4.0.0"
    }

    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0, < 4.0.0"
    }

    time = {
      source  = "hashicorp/time"
      version = ">= 0.9.0, < 1.0.0"
    }
  }
}

#==============================================================================
# PROVIDER CONFIGURATION
#==============================================================================

provider "kubernetes" {
  config_path    = var.kubernetes_config_path
  config_context = var.kubernetes_context
}

provider "helm" {
  kubernetes {
    config_path    = var.kubernetes_config_path
    config_context = var.kubernetes_context
  }
}

provider "random" {
  # No configuration required
}

provider "null" {
  # No configuration required
}

provider "time" {
  # No configuration required
}
