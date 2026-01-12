# ArgoCD Kubernetes Module - Helm Installation + GitOps Configuration
# Deploys ArgoCD with Projects and ApplicationSets for multi-environment management

terraform {
  required_version = ">= 1.0"
  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.10"
    }
  }
}

# ArgoCD namespace
resource "kubernetes_namespace" "argocd" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name = var.namespace

    labels = merge(
      {
        "app.kubernetes.io/name"      = "argocd"
        "app.kubernetes.io/component" = "gitops"
        "app.kubernetes.io/part-of"   = "ananta-platform"
      },
      var.labels
    )
  }
}

# Random password for ArgoCD admin if not provided
resource "random_password" "argocd_admin" {
  count = var.admin_password == "" ? 1 : 0

  length  = 32
  special = true
}

# ArgoCD Helm Release
resource "helm_release" "argocd" {
  name       = var.release_name
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.argocd_version
  namespace  = var.namespace

  create_namespace = false

  timeout = 600

  values = [
    yamlencode({
      global = {
        image = {
          tag = var.argocd_image_tag
        }
      }

      # Controller configuration
      controller = {
        replicas = var.ha_enabled ? 3 : 1
        resources = {
          requests = {
            cpu    = "250m"
            memory = "512Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "2Gi"
          }
        }
        metrics = {
          enabled = var.enable_metrics
          serviceMonitor = {
            enabled = var.enable_metrics
          }
        }
      }

      # Server configuration
      server = {
        replicas = var.ha_enabled ? 3 : 1
        service = {
          type = var.service_type
          annotations = var.service_annotations
        }
        ingress = {
          enabled = var.create_ingress
          hosts = var.create_ingress ? [
            var.ingress_host
          ] : []
          annotations = var.ingress_annotations
          tls = var.ingress_tls_enabled ? [
            {
              secretName = var.ingress_tls_secret_name
              hosts      = [var.ingress_host]
            }
          ] : []
        }
        resources = {
          requests = {
            cpu    = "100m"
            memory = "256Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "1Gi"
          }
        }
        metrics = {
          enabled = var.enable_metrics
          serviceMonitor = {
            enabled = var.enable_metrics
          }
        }
        extraArgs = concat(
          var.insecure_server ? ["--insecure"] : [],
          var.server_extra_args
        )
        config = merge(
          {
            "admin.enabled" = "true"
            "statusbadge.enabled" = "true"
            "users.anonymous.enabled" = "false"
            "timeout.reconciliation" = var.reconciliation_timeout
          },
          var.server_config
        )
      }

      # Repository server configuration
      repoServer = {
        replicas = var.ha_enabled ? 3 : 1
        resources = {
          requests = {
            cpu    = "250m"
            memory = "512Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "2Gi"
          }
        }
        metrics = {
          enabled = var.enable_metrics
          serviceMonitor = {
            enabled = var.enable_metrics
          }
        }
      }

      # Redis HA configuration
      redis-ha = {
        enabled = var.ha_enabled
      }

      # Redis (standalone) configuration
      redis = {
        enabled = !var.ha_enabled
      }

      # Application controller configuration
      applicationSet = {
        enabled = var.enable_applicationset
        replicas = var.ha_enabled ? 2 : 1
      }

      # Notifications controller
      notifications = {
        enabled = var.enable_notifications
      }

      # Dex for SSO (optional)
      dex = {
        enabled = var.enable_dex
      }

      # Config management plugins
      configs = {
        secret = {
          argocdServerAdminPassword = var.admin_password != "" ? bcrypt(var.admin_password) : bcrypt(random_password.argocd_admin[0].result)
        }
        cm = var.config_management_plugins != null ? {
          "configManagementPlugins" = var.config_management_plugins
        } : {}
      }
    })
  ]

  dynamic "set" {
    for_each = var.helm_set_values
    content {
      name  = set.key
      value = set.value
    }
  }

  dynamic "set_sensitive" {
    for_each = var.helm_set_sensitive_values
    content {
      name  = set_sensitive.key
      value = set_sensitive.value
    }
  }

  depends_on = [
    kubernetes_namespace.argocd
  ]
}

# Wait for ArgoCD CRDs to be ready
resource "time_sleep" "wait_for_crds" {
  depends_on = [helm_release.argocd]

  create_duration = "30s"
}

# ArgoCD Project for Ananta Platform
resource "kubernetes_manifest" "argocd_project" {
  count = var.create_project ? 1 : 0

  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "AppProject"
    metadata = {
      name      = var.project_name
      namespace = var.namespace
      labels = merge(
        {
          "app.kubernetes.io/name"      = var.project_name
          "app.kubernetes.io/component" = "argocd-project"
          "app.kubernetes.io/part-of"   = "ananta-platform"
        },
        var.labels
      )
    }
    spec = {
      description = var.project_description

      # Source repositories
      sourceRepos = concat(
        [var.git_repo_url],
        var.additional_source_repos
      )

      # Destination clusters and namespaces
      destinations = concat(
        [
          for env in var.environments : {
            namespace = env.namespace
            server    = "https://kubernetes.default.svc"
            name      = env.cluster_name != null ? env.cluster_name : null
          }
        ],
        var.additional_destinations
      )

      # Cluster resource whitelist
      clusterResourceWhitelist = var.cluster_resource_whitelist != null ? var.cluster_resource_whitelist : [
        {
          group = "*"
          kind  = "*"
        }
      ]

      # Namespace resource whitelist
      namespaceResourceWhitelist = var.namespace_resource_whitelist != null ? var.namespace_resource_whitelist : [
        {
          group = "*"
          kind  = "*"
        }
      ]

      # Orphaned resources monitoring
      orphanedResources = {
        warn = var.warn_orphaned_resources
      }

      # Sync windows
      syncWindows = var.sync_windows

      # Role definitions
      roles = var.project_roles
    }
  }

  depends_on = [
    time_sleep.wait_for_crds
  ]
}

# Repository credentials secret (Git HTTPS)
resource "kubernetes_secret" "git_repo_https" {
  count = var.git_username != "" && var.git_password != "" ? 1 : 0

  metadata {
    name      = "${var.project_name}-repo-creds-https"
    namespace = var.namespace
    labels = {
      "argocd.argoproj.io/secret-type" = "repository"
    }
  }

  data = {
    type     = "git"
    url      = var.git_repo_url
    username = var.git_username
    password = var.git_password
  }

  depends_on = [
    helm_release.argocd
  ]
}

# Repository credentials secret (Git SSH)
resource "kubernetes_secret" "git_repo_ssh" {
  count = var.git_ssh_private_key != "" ? 1 : 0

  metadata {
    name      = "${var.project_name}-repo-creds-ssh"
    namespace = var.namespace
    labels = {
      "argocd.argoproj.io/secret-type" = "repository"
    }
  }

  data = {
    type          = "git"
    url           = var.git_repo_url
    sshPrivateKey = var.git_ssh_private_key
  }

  depends_on = [
    helm_release.argocd
  ]
}

# ApplicationSet for multi-environment deployments
resource "kubernetes_manifest" "applicationset" {
  count = var.create_applicationset ? 1 : 0

  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "ApplicationSet"
    metadata = {
      name      = var.applicationset_name
      namespace = var.namespace
      labels = merge(
        {
          "app.kubernetes.io/name"      = var.applicationset_name
          "app.kubernetes.io/component" = "argocd-applicationset"
          "app.kubernetes.io/part-of"   = "ananta-platform"
        },
        var.labels
      )
    }
    spec = {
      # Generator: list of environments
      generators = [
        {
          list = {
            elements = [
              for env in var.environments : {
                environment  = env.name
                namespace    = env.namespace
                branch       = env.git_branch != null ? env.git_branch : var.git_branch
                clusterName  = env.cluster_name != null ? env.cluster_name : "in-cluster"
                repoPath     = env.repo_path != null ? env.repo_path : var.git_repo_path
                values       = env.values != null ? env.values : {}
              }
            ]
          }
        }
      ]

      # Template for Application resources
      template = {
        metadata = {
          name = "${var.applicationset_name}-{{environment}}"
          labels = merge(
            {
              "app.kubernetes.io/name"        = "${var.applicationset_name}-{{environment}}"
              "app.kubernetes.io/environment" = "{{environment}}"
              "app.kubernetes.io/managed-by"  = "argocd"
              "app.kubernetes.io/part-of"     = "ananta-platform"
            },
            var.labels
          )
        }
        spec = {
          project = var.create_project ? var.project_name : "default"

          source = {
            repoURL        = var.git_repo_url
            targetRevision = "{{branch}}"
            path           = "{{repoPath}}"

            # Helm values (if using Helm)
            helm = var.use_helm_source ? {
              releaseName = "${var.applicationset_name}-{{environment}}"
              valueFiles  = var.helm_value_files
              values      = "{{values}}"
            } : null
          }

          destination = {
            server    = "https://kubernetes.default.svc"
            namespace = "{{namespace}}"
          }

          # Sync policy
          syncPolicy = {
            automated = var.sync_policy_automated ? {
              prune    = var.sync_policy_prune
              selfHeal = var.sync_policy_self_heal
              allowEmpty = var.sync_policy_allow_empty
            } : null

            syncOptions = var.sync_options

            retry = var.sync_retry_enabled ? {
              limit = var.sync_retry_limit
              backoff = {
                duration    = var.sync_retry_backoff_duration
                factor      = var.sync_retry_backoff_factor
                maxDuration = var.sync_retry_backoff_max_duration
              }
            } : null
          }

          # Ignore differences
          ignoreDifferences = var.ignore_differences

          # Info
          info = [
            {
              name  = "Environment"
              value = "{{environment}}"
            }
          ]
        }
      }
    }
  }

  depends_on = [
    time_sleep.wait_for_crds,
    kubernetes_manifest.argocd_project
  ]
}

# Additional applications (optional)
resource "kubernetes_manifest" "additional_applications" {
  for_each = var.additional_applications

  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = each.key
      namespace = var.namespace
      labels = merge(
        {
          "app.kubernetes.io/name"       = each.key
          "app.kubernetes.io/managed-by" = "terraform"
          "app.kubernetes.io/part-of"    = "ananta-platform"
        },
        var.labels,
        lookup(each.value, "labels", {})
      )
      finalizers = lookup(each.value, "finalizers", ["resources-finalizer.argocd.argoproj.io"])
    }
    spec = merge(
      {
        project = var.create_project ? var.project_name : "default"

        source = {
          repoURL        = lookup(each.value.source, "repo_url", var.git_repo_url)
          targetRevision = lookup(each.value.source, "target_revision", var.git_branch)
          path           = each.value.source.path
        }

        destination = {
          server    = lookup(each.value.destination, "server", "https://kubernetes.default.svc")
          namespace = each.value.destination.namespace
        }

        syncPolicy = {
          automated = var.sync_policy_automated ? {
            prune    = var.sync_policy_prune
            selfHeal = var.sync_policy_self_heal
          } : null
          syncOptions = var.sync_options
        }
      },
      lookup(each.value, "spec_override", {})
    )
  }

  depends_on = [
    time_sleep.wait_for_crds,
    kubernetes_manifest.argocd_project
  ]
}
