# =============================================================================
# Kubernetes Storage Module - MinIO Implementation
# =============================================================================
# Kubernetes-native object storage using MinIO for S3-compatible storage.
# Supports both MinIO Operator and standalone StatefulSet deployments.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  bucket_name = "${var.name_prefix}-${var.bucket_suffix}"

  # Resource sizing based on normalized instance size
  resource_config = {
    micro = {
      cpu_request    = "100m"
      cpu_limit      = "500m"
      memory_request = "256Mi"
      memory_limit   = "512Mi"
      storage_size   = "10Gi"
      replicas       = 1
    }
    small = {
      cpu_request    = "250m"
      cpu_limit      = "1000m"
      memory_request = "512Mi"
      memory_limit   = "1Gi"
      storage_size   = "50Gi"
      replicas       = 1
    }
    medium = {
      cpu_request    = "500m"
      cpu_limit      = "2000m"
      memory_request = "1Gi"
      memory_limit   = "2Gi"
      storage_size   = "100Gi"
      replicas       = var.high_availability ? 4 : 1
    }
    large = {
      cpu_request    = "1000m"
      cpu_limit      = "4000m"
      memory_request = "2Gi"
      memory_limit   = "4Gi"
      storage_size   = "500Gi"
      replicas       = var.high_availability ? 4 : 1
    }
    xlarge = {
      cpu_request    = "2000m"
      cpu_limit      = "8000m"
      memory_request = "4Gi"
      memory_limit   = "8Gi"
      storage_size   = "1Ti"
      replicas       = var.high_availability ? 4 : 1
    }
  }

  config = local.resource_config[var.instance_size]

  common_labels = merge(var.labels, {
    "app.kubernetes.io/name"       = "minio"
    "app.kubernetes.io/instance"   = local.bucket_name
    "app.kubernetes.io/component"  = "object-storage"
    "app.kubernetes.io/managed-by" = "terraform"
    "environment"                  = var.environment
  })
}

# -----------------------------------------------------------------------------
# Namespace (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "minio" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# MinIO Credentials Secret
# -----------------------------------------------------------------------------

resource "random_password" "access_key" {
  count   = var.access_key == null ? 1 : 0
  length  = 20
  special = false
}

resource "random_password" "secret_key" {
  count   = var.secret_key == null ? 1 : 0
  length  = 40
  special = false
}

resource "kubernetes_secret" "minio_credentials" {
  metadata {
    name      = "${local.bucket_name}-credentials"
    namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  data = {
    root-user     = var.access_key != null ? var.access_key : random_password.access_key[0].result
    root-password = var.secret_key != null ? var.secret_key : random_password.secret_key[0].result
  }

  type = "Opaque"
}

# -----------------------------------------------------------------------------
# TLS Certificate Secret (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "minio_tls" {
  count = var.tls_enabled && var.tls_cert != null ? 1 : 0

  metadata {
    name      = "${local.bucket_name}-tls"
    namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  data = {
    "public.crt"  = var.tls_cert
    "private.key" = var.tls_key
  }

  type = "kubernetes.io/tls"
}

# -----------------------------------------------------------------------------
# MinIO StatefulSet (Standalone Mode)
# -----------------------------------------------------------------------------

resource "kubernetes_stateful_set" "minio" {
  count = var.use_operator ? 0 : 1

  metadata {
    name      = local.bucket_name
    namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  spec {
    service_name = "${local.bucket_name}-headless"
    replicas     = local.config.replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "minio"
        "app.kubernetes.io/instance" = local.bucket_name
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"     = "minio"
          "app.kubernetes.io/instance" = local.bucket_name
        })
        annotations = var.pod_annotations
      }

      spec {
        service_account_name = var.service_account_name

        dynamic "security_context" {
          for_each = var.pod_security_context != null ? [var.pod_security_context] : []
          content {
            run_as_user     = security_context.value.run_as_user
            run_as_group    = security_context.value.run_as_group
            fs_group        = security_context.value.fs_group
            run_as_non_root = security_context.value.run_as_non_root
          }
        }

        container {
          name  = "minio"
          image = "${var.minio_image}:${var.minio_version}"

          args = local.config.replicas > 1 ? [
            "server",
            "--console-address", ":9001",
            "http://${local.bucket_name}-{0...${local.config.replicas - 1}}.${local.bucket_name}-headless.${var.namespace}.svc.cluster.local/data"
          ] : [
            "server",
            "--console-address", ":9001",
            "/data"
          ]

          port {
            name           = "api"
            container_port = 9000
          }

          port {
            name           = "console"
            container_port = 9001
          }

          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio_credentials.metadata[0].name
                key  = "root-user"
              }
            }
          }

          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio_credentials.metadata[0].name
                key  = "root-password"
              }
            }
          }

          dynamic "env" {
            for_each = var.minio_extra_env
            content {
              name  = env.key
              value = env.value
            }
          }

          resources {
            requests = {
              cpu    = local.config.cpu_request
              memory = local.config.memory_request
            }
            limits = {
              cpu    = local.config.cpu_limit
              memory = local.config.memory_limit
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          dynamic "volume_mount" {
            for_each = var.tls_enabled && var.tls_cert != null ? [1] : []
            content {
              name       = "tls"
              mount_path = "/root/.minio/certs"
              read_only  = true
            }
          }

          liveness_probe {
            http_get {
              path   = "/minio/health/live"
              port   = 9000
              scheme = var.tls_enabled ? "HTTPS" : "HTTP"
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path   = "/minio/health/ready"
              port   = 9000
              scheme = var.tls_enabled ? "HTTPS" : "HTTP"
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }
        }

        dynamic "volume" {
          for_each = var.tls_enabled && var.tls_cert != null ? [1] : []
          content {
            name = "tls"
            secret {
              secret_name = kubernetes_secret.minio_tls[0].metadata[0].name
            }
          }
        }

        dynamic "affinity" {
          for_each = var.pod_affinity != null ? [var.pod_affinity] : []
          content {
            dynamic "pod_anti_affinity" {
              for_each = affinity.value.pod_anti_affinity != null ? [affinity.value.pod_anti_affinity] : []
              content {
                required_during_scheduling_ignored_during_execution {
                  label_selector {
                    match_labels = {
                      "app.kubernetes.io/name"     = "minio"
                      "app.kubernetes.io/instance" = local.bucket_name
                    }
                  }
                  topology_key = "kubernetes.io/hostname"
                }
              }
            }
          }
        }

        dynamic "toleration" {
          for_each = var.tolerations
          content {
            key      = toleration.value.key
            operator = toleration.value.operator
            value    = toleration.value.value
            effect   = toleration.value.effect
          }
        }

        node_selector = var.node_selector
      }
    }

    volume_claim_template {
      metadata {
        name   = "data"
        labels = local.common_labels
      }
      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.storage_class_name

        resources {
          requests = {
            storage = var.storage_size != null ? var.storage_size : local.config.storage_size
          }
        }
      }
    }

    update_strategy {
      type = "RollingUpdate"
    }
  }

  depends_on = [kubernetes_secret.minio_credentials]
}

# -----------------------------------------------------------------------------
# Headless Service (for StatefulSet)
# -----------------------------------------------------------------------------

resource "kubernetes_service" "minio_headless" {
  count = var.use_operator ? 0 : 1

  metadata {
    name      = "${local.bucket_name}-headless"
    namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  spec {
    type                        = "ClusterIP"
    cluster_ip                  = "None"
    publish_not_ready_addresses = true

    selector = {
      "app.kubernetes.io/name"     = "minio"
      "app.kubernetes.io/instance" = local.bucket_name
    }

    port {
      name        = "api"
      port        = 9000
      target_port = 9000
    }

    port {
      name        = "console"
      port        = 9001
      target_port = 9001
    }
  }
}

# -----------------------------------------------------------------------------
# API Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "minio" {
  count = var.use_operator ? 0 : 1

  metadata {
    name      = local.bucket_name
    namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels    = local.common_labels
    annotations = var.service_annotations
  }

  spec {
    type = var.service_type

    selector = {
      "app.kubernetes.io/name"     = "minio"
      "app.kubernetes.io/instance" = local.bucket_name
    }

    port {
      name        = "api"
      port        = 9000
      target_port = 9000
    }

    port {
      name        = "console"
      port        = 9001
      target_port = 9001
    }
  }
}

# -----------------------------------------------------------------------------
# Ingress (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "minio" {
  count = var.ingress_enabled && !var.use_operator ? 1 : 0

  metadata {
    name        = local.bucket_name
    namespace   = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels      = local.common_labels
    annotations = var.ingress_annotations
  }

  spec {
    ingress_class_name = var.ingress_class_name

    dynamic "tls" {
      for_each = var.ingress_tls_secret != null ? [1] : []
      content {
        hosts       = [var.ingress_host]
        secret_name = var.ingress_tls_secret
      }
    }

    rule {
      host = var.ingress_host

      http {
        path {
          path      = var.ingress_path
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.minio[0].metadata[0].name
              port {
                number = 9000
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Console Ingress (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "minio_console" {
  count = var.console_ingress_enabled && !var.use_operator ? 1 : 0

  metadata {
    name        = "${local.bucket_name}-console"
    namespace   = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels      = local.common_labels
    annotations = var.ingress_annotations
  }

  spec {
    ingress_class_name = var.ingress_class_name

    dynamic "tls" {
      for_each = var.console_ingress_tls_secret != null ? [1] : []
      content {
        hosts       = [var.console_ingress_host]
        secret_name = var.console_ingress_tls_secret
      }
    }

    rule {
      host = var.console_ingress_host

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.minio[0].metadata[0].name
              port {
                number = 9001
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# MinIO Tenant (Operator Mode)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "minio_tenant" {
  count = var.use_operator ? 1 : 0

  manifest = {
    apiVersion = "minio.min.io/v2"
    kind       = "Tenant"
    metadata = {
      name      = local.bucket_name
      namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
      labels    = local.common_labels
    }
    spec = {
      image = "${var.minio_image}:${var.minio_version}"
      pools = [
        {
          name               = "pool-0"
          servers            = local.config.replicas
          volumesPerServer   = 1
          volumeClaimTemplate = {
            metadata = {
              name = "data"
            }
            spec = {
              accessModes = ["ReadWriteOnce"]
              storageClassName = var.storage_class_name
              resources = {
                requests = {
                  storage = var.storage_size != null ? var.storage_size : local.config.storage_size
                }
              }
            }
          }
          resources = {
            requests = {
              cpu    = local.config.cpu_request
              memory = local.config.memory_request
            }
            limits = {
              cpu    = local.config.cpu_limit
              memory = local.config.memory_limit
            }
          }
        }
      ]
      credsSecret = {
        name = kubernetes_secret.minio_credentials.metadata[0].name
      }
      requestAutoCert = var.tls_enabled && var.tls_cert == null
      exposeServices = {
        console = true
        minio   = true
      }
    }
  }

  depends_on = [kubernetes_secret.minio_credentials]
}

# -----------------------------------------------------------------------------
# ServiceMonitor for Prometheus (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "service_monitor" {
  count = var.metrics_enabled && !var.use_operator ? 1 : 0

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = local.bucket_name
      namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
      labels    = merge(local.common_labels, var.prometheus_labels)
    }
    spec = {
      selector = {
        matchLabels = {
          "app.kubernetes.io/name"     = "minio"
          "app.kubernetes.io/instance" = local.bucket_name
        }
      }
      endpoints = [
        {
          port     = "api"
          path     = "/minio/v2/metrics/cluster"
          interval = "30s"
        }
      ]
    }
  }
}

# -----------------------------------------------------------------------------
# Default Bucket Creation Job
# -----------------------------------------------------------------------------

resource "kubernetes_job" "create_bucket" {
  count = var.create_default_bucket && !var.use_operator ? 1 : 0

  metadata {
    name      = "${local.bucket_name}-create-bucket"
    namespace = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  spec {
    backoff_limit              = 3
    ttl_seconds_after_finished = 300

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "mc"
          image = "minio/mc:latest"

          command = [
            "/bin/sh",
            "-c",
            <<-EOT
              mc alias set minio http://${local.bucket_name}:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
              mc mb --ignore-existing minio/${var.default_bucket_name}
              %{if var.versioning_enabled}
              mc version enable minio/${var.default_bucket_name}
              %{endif}
            EOT
          ]

          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio_credentials.metadata[0].name
                key  = "root-user"
              }
            }
          }

          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.minio_credentials.metadata[0].name
                key  = "root-password"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_stateful_set.minio,
    kubernetes_service.minio
  ]
}
