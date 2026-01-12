# ArgoCD Terraform Module - Usage Examples
# This file contains example configurations for different use cases

# Example 1: Basic Local Development Setup
# ==========================================
# Minimal configuration for local Kubernetes (kind, minikube, etc.)

module "argocd_local" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  argocd_version = "5.51.6"

  # Service configuration - use ClusterIP for local
  service_type = "ClusterIP"

  # Git repository
  git_repo_url = "https://github.com/your-org/ananta-platform-saas"
  git_username = var.git_username
  git_password = var.git_token

  # Disable HA for local development
  ha_enabled = false

  # Basic sync policy
  sync_policy_automated = true
  sync_policy_prune     = true
  sync_policy_self_heal = true

  # Single environment for local
  environments = [
    {
      name      = "local"
      namespace = "ananta-local"
      repo_path = "infrastructure/gitops/local"
    }
  ]
}

# Example 2: Production Deployment with High Availability
# ========================================================
# Full production setup with HA, Ingress, TLS, and monitoring

module "argocd_production" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  argocd_version = "5.51.6"

  # High availability configuration
  ha_enabled = true

  # Service configuration - use LoadBalancer for cloud
  service_type = "LoadBalancer"
  service_annotations = {
    "service.beta.kubernetes.io/aws-load-balancer-type" = "nlb"
    "service.beta.kubernetes.io/aws-load-balancer-internal" = "false"
  }

  # Git repository with HTTPS auth
  git_repo_url = "https://github.com/your-org/ananta-platform-saas"
  git_username = var.git_username
  git_password = var.git_token
  git_branch   = "main"

  # Ingress with TLS
  create_ingress      = true
  ingress_host        = "argocd.ananta-platform.com"
  ingress_tls_enabled = true
  ingress_tls_secret_name = "argocd-tls"
  ingress_annotations = {
    "kubernetes.io/ingress.class"                      = "nginx"
    "cert-manager.io/cluster-issuer"                   = "letsencrypt-prod"
    "nginx.ingress.kubernetes.io/ssl-passthrough"       = "true"
    "nginx.ingress.kubernetes.io/backend-protocol"      = "HTTPS"
    "nginx.ingress.kubernetes.io/force-ssl-redirect"    = "true"
  }

  # Custom admin password (use from secrets manager)
  admin_password = var.argocd_admin_password

  # Enable all production features
  enable_metrics        = true
  enable_applicationset = true
  enable_notifications  = true
  enable_dex           = false  # Enable if using SSO

  # Server configuration
  insecure_server      = false
  reconciliation_timeout = "180s"
  server_config = {
    "url" = "https://argocd.ananta-platform.com"
    "application.instanceLabelKey" = "argocd.argoproj.io/instance"
  }

  # Project configuration
  create_project      = true
  project_name        = "ananta-platform"
  project_description = "Ananta Platform multi-tenant SaaS control plane"

  additional_source_repos = [
    "https://github.com/your-org/app-plane",
    "https://charts.bitnami.com/bitnami",
    "https://helm.temporal.io"
  ]

  # Multi-environment setup
  create_applicationset = true
  applicationset_name   = "ananta-platform"

  environments = [
    {
      name       = "dev"
      namespace  = "ananta-dev"
      git_branch = "develop"
      repo_path  = "infrastructure/gitops/dev"
    },
    {
      name       = "staging"
      namespace  = "ananta-staging"
      git_branch = "main"
      repo_path  = "infrastructure/gitops/staging"
    },
    {
      name       = "prod"
      namespace  = "ananta-prod"
      git_branch = "main"
      repo_path  = "infrastructure/gitops/prod"
    }
  ]

  # Sync policy with retry
  sync_policy_automated   = true
  sync_policy_prune       = true
  sync_policy_self_heal   = true
  sync_policy_allow_empty = false

  sync_options = [
    "CreateNamespace=true",
    "PruneLast=true",
    "PruneWhenPropagationStatusIsUnknown=true",
    "RespectIgnoreDifferences=true"
  ]

  sync_retry_enabled              = true
  sync_retry_limit                = 5
  sync_retry_backoff_duration     = "5s"
  sync_retry_backoff_factor       = 2
  sync_retry_backoff_max_duration = "3m"

  # Ignore differences for known issues
  ignore_differences = [
    {
      group = "apps"
      kind  = "Deployment"
      jsonPointers = [
        "/spec/replicas"  # Ignore HPA-managed replicas
      ]
    }
  ]

  # Additional standalone applications
  additional_applications = {
    "cert-manager" = {
      source = {
        path = "infrastructure/cert-manager"
      }
      destination = {
        namespace = "cert-manager"
      }
    }
    "ingress-nginx" = {
      source = {
        path = "infrastructure/ingress-nginx"
      }
      destination = {
        namespace = "ingress-nginx"
      }
    }
  }

  # Labels for all resources
  labels = {
    "managed-by"  = "terraform"
    "platform"    = "ananta"
    "environment" = "production"
    "team"        = "platform"
  }
}

# Example 3: SSH Authentication
# ==============================
# Using SSH keys for private Git repositories

module "argocd_ssh" {
  source = "./modules/argocd/kubernetes"

  namespace    = "argocd"
  git_repo_url = "git@github.com:your-org/ananta-platform-saas.git"

  # SSH authentication
  git_ssh_private_key = file("${path.module}/secrets/argocd_deploy_key")

  # Other configurations...
  service_type = "ClusterIP"
}

# Example 4: Multi-Cluster Setup
# ===============================
# ArgoCD managing applications across multiple clusters

module "argocd_multi_cluster" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  git_repo_url   = "https://github.com/your-org/ananta-platform-saas"
  git_username   = var.git_username
  git_password   = var.git_token

  # Project with multiple cluster destinations
  create_project = true
  project_name   = "ananta-platform"

  additional_destinations = [
    {
      namespace = "*"
      server    = "https://kubernetes.default.svc"  # In-cluster
      name      = "in-cluster"
    },
    {
      namespace = "*"
      server    = "https://prod-cluster-1.example.com"
      name      = "prod-cluster-1"
    },
    {
      namespace = "*"
      server    = "https://prod-cluster-2.example.com"
      name      = "prod-cluster-2"
    }
  ]

  # Environments across clusters
  environments = [
    {
      name         = "prod-us-east"
      namespace    = "ananta-prod"
      cluster_name = "prod-cluster-1"
      repo_path    = "infrastructure/gitops/prod"
    },
    {
      name         = "prod-eu-west"
      namespace    = "ananta-prod"
      cluster_name = "prod-cluster-2"
      repo_path    = "infrastructure/gitops/prod"
    }
  ]
}

# Example 5: Helm-based Applications
# ===================================
# Using Helm charts as source type

module "argocd_helm" {
  source = "./modules/argocd/kubernetes"

  namespace    = "argocd"
  git_repo_url = "https://github.com/your-org/ananta-platform-saas"
  git_username = var.git_username
  git_password = var.git_token

  # Enable Helm source type
  use_helm_source = true
  helm_value_files = [
    "values.yaml",
    "values-{{environment}}.yaml"
  ]

  environments = [
    {
      name      = "dev"
      namespace = "ananta-dev"
      repo_path = "charts/ananta-platform"
      values    = <<-EOT
        replicaCount: 1
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
      EOT
    },
    {
      name      = "prod"
      namespace = "ananta-prod"
      repo_path = "charts/ananta-platform"
      values    = <<-EOT
        replicaCount: 3
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
      EOT
    }
  ]
}

# Example 6: Restrictive RBAC
# ============================
# Locked-down project with resource whitelists

module "argocd_rbac" {
  source = "./modules/argocd/kubernetes"

  namespace    = "argocd"
  git_repo_url = "https://github.com/your-org/ananta-platform-saas"
  git_username = var.git_username
  git_password = var.git_token

  create_project = true
  project_name   = "ananta-platform"

  # Whitelist specific resources
  cluster_resource_whitelist = [
    {
      group = ""
      kind  = "Namespace"
    },
    {
      group = "rbac.authorization.k8s.io"
      kind  = "*"
    }
  ]

  namespace_resource_whitelist = [
    {
      group = ""
      kind  = "ConfigMap"
    },
    {
      group = ""
      kind  = "Secret"
    },
    {
      group = ""
      kind  = "Service"
    },
    {
      group = "apps"
      kind  = "Deployment"
    },
    {
      group = "apps"
      kind  = "StatefulSet"
    },
    {
      group = "batch"
      kind  = "Job"
    },
    {
      group = "batch"
      kind  = "CronJob"
    }
  ]

  # Project roles
  project_roles = [
    {
      name = "developer"
      description = "Developer role with read-only access"
      policies = [
        "p, proj:ananta-platform:developer, applications, get, ananta-platform/*, allow",
        "p, proj:ananta-platform:developer, applications, list, ananta-platform/*, allow"
      ]
    },
    {
      name = "deployer"
      description = "Deployer role with sync permissions"
      policies = [
        "p, proj:ananta-platform:deployer, applications, *, ananta-platform/*, allow"
      ]
    }
  ]
}

# Example 7: Sync Windows
# ========================
# Maintenance windows for controlled deployments

module "argocd_sync_windows" {
  source = "./modules/argocd/kubernetes"

  namespace    = "argocd"
  git_repo_url = "https://github.com/your-org/ananta-platform-saas"
  git_username = var.git_username
  git_password = var.git_token

  create_project = true
  project_name   = "ananta-platform"

  # Define sync windows
  sync_windows = [
    {
      kind         = "allow"
      schedule     = "0 9 * * MON-FRI"  # Weekdays 9 AM
      duration     = "8h"
      applications = ["*"]
      namespaces   = ["ananta-prod"]
    },
    {
      kind         = "deny"
      schedule     = "0 0 * * SAT,SUN"  # Weekends
      duration     = "48h"
      applications = ["*"]
      namespaces   = ["ananta-prod"]
    }
  ]
}

# Outputs for examples
# ====================

output "argocd_local_url" {
  description = "ArgoCD local URL"
  value       = "Run: kubectl port-forward svc/argocd-server -n argocd 8080:443"
}

output "argocd_production_url" {
  description = "ArgoCD production URL"
  value       = try(module.argocd_production.argocd_server_url, null)
}

output "argocd_admin_password" {
  description = "ArgoCD admin password (SENSITIVE)"
  value       = try(module.argocd_production.argocd_initial_admin_password, null)
  sensitive   = true
}

output "applicationset_environments" {
  description = "Configured environments"
  value       = try(module.argocd_production.applicationset_environments, null)
}
