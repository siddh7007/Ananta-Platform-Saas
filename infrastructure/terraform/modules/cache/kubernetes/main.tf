# =============================================================================
# Kubernetes Cache Module - Redis Operator Implementation
# =============================================================================
# Kubernetes-specific implementation of the cloud-agnostic cache interface.
# Uses Spotahome Redis Operator for managed Redis clusters on Kubernetes.
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  cluster_name = "${var.name_prefix}-redis"

  # Map normalized sizes to resource requests
  resource_map = {
    micro  = { memory = "128Mi", cpu = "100m" }
    small  = { memory = "256Mi", cpu = "200m" }
    medium = { memory = "512Mi", cpu = "500m" }
    large  = { memory = "1Gi", cpu = "1000m" }
    xlarge = { memory = "2Gi", cpu = "2000m" }
  }

  resources = lookup(local.resource_map, var.instance_size, local.resource_map["small"])

  # Labels for all resources
  common_labels = merge(var.labels, {
    "app.kubernetes.io/name"       = "redis"
    "app.kubernetes.io/instance"   = local.cluster_name
    "app.kubernetes.io/component"  = "cache"
    "app.kubernetes.io/managed-by" = "terraform"
    environment                    = var.environment
  })
}

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "redis" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Redis Operator (Optional - via Helm)
# -----------------------------------------------------------------------------

resource "helm_release" "redis_operator" {
  count = var.install_operator ? 1 : 0

  name             = "redis-operator"
  repository       = "https://spotahome.github.io/redis-operator"
  chart            = "redis-operator"
  version          = var.operator_version
  namespace        = var.operator_namespace
  create_namespace = true

  values = [
    yamlencode({
      resources = {
        limits = {
          cpu    = "100m"
          memory = "128Mi"
        }
        requests = {
          cpu    = "50m"
          memory = "64Mi"
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.redis]
}

# -----------------------------------------------------------------------------
# Redis Auth Secret
# -----------------------------------------------------------------------------

resource "random_password" "redis_password" {
  length  = 32
  special = false
}

resource "kubernetes_secret" "redis_auth" {
  metadata {
    name      = "${local.cluster_name}-auth"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    password = random_password.redis_password.result
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.redis]
}

# -----------------------------------------------------------------------------
# Redis Failover (HA) or Redis (Standalone) via Operator CRD
# -----------------------------------------------------------------------------

# For HA deployments - Redis Failover with Sentinel
resource "kubernetes_manifest" "redis_failover" {
  count = var.high_availability ? 1 : 0

  manifest = {
    apiVersion = "databases.spotahome.com/v1"
    kind       = "RedisFailover"
    metadata = {
      name      = local.cluster_name
      namespace = var.namespace
      labels    = local.common_labels
    }
    spec = {
      sentinel = {
        replicas = 3
        resources = {
          requests = {
            cpu    = "100m"
            memory = "64Mi"
          }
          limits = {
            cpu    = "200m"
            memory = "128Mi"
          }
        }
        customConfig = var.sentinel_config
      }
      redis = {
        replicas = var.replica_count + 1  # Primary + replicas
        image    = var.redis_image
        resources = {
          requests = local.resources
          limits = {
            cpu    = local.resources.cpu
            memory = local.resources.memory
          }
        }
        customConfig = concat([
          "maxmemory-policy ${var.maxmemory_policy}",
          "notify-keyspace-events ${var.notify_keyspace_events}",
          "tcp-keepalive 300",
          "timeout ${var.timeout_seconds}",
        ], var.redis_custom_config)
        storage = var.persistence_enabled ? {
          persistentVolumeClaim = {
            metadata = {
              name = "${local.cluster_name}-data"
            }
            spec = {
              accessModes = ["ReadWriteOnce"]
              resources = {
                requests = {
                  storage = "${var.storage_gb}Gi"
                }
              }
              storageClassName = var.storage_class
            }
          }
        } : null
        exporter = var.enable_monitoring ? {
          enabled = true
          image   = var.exporter_image
          resources = {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
          }
        } : null
      }
      auth = {
        secretPath = "${local.cluster_name}-auth"
      }
    }
  }

  depends_on = [
    kubernetes_secret.redis_auth,
    helm_release.redis_operator
  ]
}

# For standalone deployments - Simple Redis StatefulSet
resource "kubernetes_stateful_set" "redis_standalone" {
  count = var.high_availability ? 0 : 1

  metadata {
    name      = local.cluster_name
    namespace = var.namespace
    labels    = local.common_labels
  }

  spec {
    service_name = local.cluster_name
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "redis"
        "app.kubernetes.io/instance" = local.cluster_name
      }
    }

    template {
      metadata {
        labels = local.common_labels
        annotations = var.enable_monitoring ? {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "9121"
        } : {}
      }

      spec {
        container {
          name  = "redis"
          image = var.redis_image

          port {
            container_port = 6379
            name           = "redis"
          }

          env {
            name = "REDIS_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.redis_auth.metadata[0].name
                key  = "password"
              }
            }
          }

          command = [
            "redis-server",
            "--requirepass", "$(REDIS_PASSWORD)",
            "--maxmemory-policy", var.maxmemory_policy,
            "--tcp-keepalive", "300",
          ]

          resources {
            requests = local.resources
            limits   = local.resources
          }

          dynamic "volume_mount" {
            for_each = var.persistence_enabled ? [1] : []
            content {
              name       = "data"
              mount_path = "/data"
            }
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "-a", "$(REDIS_PASSWORD)", "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "-a", "$(REDIS_PASSWORD)", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }

        dynamic "container" {
          for_each = var.enable_monitoring ? [1] : []
          content {
            name  = "exporter"
            image = var.exporter_image

            port {
              container_port = 9121
              name           = "metrics"
            }

            env {
              name = "REDIS_PASSWORD"
              value_from {
                secret_key_ref {
                  name = kubernetes_secret.redis_auth.metadata[0].name
                  key  = "password"
                }
              }
            }

            env {
              name  = "REDIS_ADDR"
              value = "redis://localhost:6379"
            }

            resources {
              requests = {
                cpu    = "50m"
                memory = "64Mi"
              }
            }
          }
        }
      }
    }

    dynamic "volume_claim_template" {
      for_each = var.persistence_enabled ? [1] : []
      content {
        metadata {
          name = "data"
        }
        spec {
          access_modes       = ["ReadWriteOnce"]
          storage_class_name = var.storage_class
          resources {
            requests = {
              storage = "${var.storage_gb}Gi"
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_namespace.redis]
}

# -----------------------------------------------------------------------------
# Services
# -----------------------------------------------------------------------------

resource "kubernetes_service" "redis" {
  count = var.high_availability ? 0 : 1

  metadata {
    name      = local.cluster_name
    namespace = var.namespace
    labels    = local.common_labels
    annotations = var.service_annotations
  }

  spec {
    type = var.service_type

    selector = {
      "app.kubernetes.io/name"     = "redis"
      "app.kubernetes.io/instance" = local.cluster_name
    }

    port {
      name        = "redis"
      port        = 6379
      target_port = 6379
    }

    dynamic "port" {
      for_each = var.enable_monitoring ? [1] : []
      content {
        name        = "metrics"
        port        = 9121
        target_port = 9121
      }
    }
  }

  depends_on = [kubernetes_stateful_set.redis_standalone]
}

# -----------------------------------------------------------------------------
# ServiceMonitor for Prometheus (Optional)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "service_monitor" {
  count = var.enable_monitoring && var.create_service_monitor ? 1 : 0

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "${local.cluster_name}-monitor"
      namespace = var.namespace
      labels    = local.common_labels
    }
    spec = {
      selector = {
        matchLabels = {
          "app.kubernetes.io/name"     = "redis"
          "app.kubernetes.io/instance" = local.cluster_name
        }
      }
      endpoints = [
        {
          port     = "metrics"
          interval = "30s"
          path     = "/metrics"
        }
      ]
    }
  }

  depends_on = [kubernetes_service.redis]
}

# -----------------------------------------------------------------------------
# PrometheusRule for Alerts (Optional)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "prometheus_rules" {
  count = var.enable_monitoring && var.create_prometheus_rules ? 1 : 0

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"
    metadata = {
      name      = "${local.cluster_name}-alerts"
      namespace = var.namespace
      labels    = local.common_labels
    }
    spec = {
      groups = [
        {
          name = "redis.rules"
          rules = [
            {
              alert = "RedisDown"
              expr  = "redis_up{instance=\"${local.cluster_name}\"} == 0"
              for   = "5m"
              labels = {
                severity = "critical"
              }
              annotations = {
                summary     = "Redis instance {{ $labels.instance }} is down"
                description = "Redis instance {{ $labels.instance }} has been down for more than 5 minutes."
              }
            },
            {
              alert = "RedisMemoryHigh"
              expr  = "redis_memory_used_bytes{instance=\"${local.cluster_name}\"} / redis_memory_max_bytes{instance=\"${local.cluster_name}\"} > 0.8"
              for   = "5m"
              labels = {
                severity = "warning"
              }
              annotations = {
                summary     = "Redis memory usage high"
                description = "Redis instance {{ $labels.instance }} memory usage is above 80%."
              }
            },
            {
              alert = "RedisEvictions"
              expr  = "rate(redis_evicted_keys_total{instance=\"${local.cluster_name}\"}[5m]) > ${var.evictions_threshold}"
              for   = "5m"
              labels = {
                severity = "warning"
              }
              annotations = {
                summary     = "Redis evictions high"
                description = "Redis instance {{ $labels.instance }} is evicting keys at a high rate."
              }
            }
          ]
        }
      ]
    }
  }

  depends_on = [kubernetes_service.redis]
}
