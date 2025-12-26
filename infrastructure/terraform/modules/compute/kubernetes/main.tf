# =============================================================================
# Kubernetes Compute Module - Deployments, Services, and Ingress
# =============================================================================
# Cloud-agnostic compute layer using Kubernetes resources that work on:
# - Amazon EKS
# - Azure AKS
# - Google GKE
# - Self-managed Kubernetes
# =============================================================================

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Size-based configurations
  size_configs = {
    small = {
      cpu_request    = "100m"
      cpu_limit      = "500m"
      memory_request = "128Mi"
      memory_limit   = "512Mi"
      replicas       = 1
    }
    medium = {
      cpu_request    = "250m"
      cpu_limit      = "1000m"
      memory_request = "256Mi"
      memory_limit   = "1Gi"
      replicas       = 2
    }
    large = {
      cpu_request    = "500m"
      cpu_limit      = "2000m"
      memory_request = "512Mi"
      memory_limit   = "2Gi"
      replicas       = 3
    }
    xlarge = {
      cpu_request    = "1000m"
      cpu_limit      = "4000m"
      memory_request = "1Gi"
      memory_limit   = "4Gi"
      replicas       = 4
    }
  }

  config = local.size_configs[var.instance_size]

  common_labels = merge(var.labels, {
    "app.kubernetes.io/managed-by" = "terraform"
    "app.kubernetes.io/part-of"    = var.name_prefix
    "environment"                  = var.environment
  })

  common_annotations = merge(var.annotations, {
    "terraform.io/managed" = "true"
  })
}

# -----------------------------------------------------------------------------
# Namespace (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "app" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Service Account
# -----------------------------------------------------------------------------

resource "kubernetes_service_account" "app" {
  count = var.create_service_account ? 1 : 0

  metadata {
    name        = "${var.name_prefix}-sa"
    namespace   = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels      = local.common_labels
    annotations = var.service_account_annotations
  }

  automount_service_account_token = true
}

# -----------------------------------------------------------------------------
# ConfigMap
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "app" {
  count = length(var.config_data) > 0 ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-config"
    namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  data = var.config_data
}

# -----------------------------------------------------------------------------
# Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "app" {
  for_each = var.services

  metadata {
    name      = "${var.name_prefix}-${each.key}"
    namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name"      = each.key
      "app.kubernetes.io/component" = each.value.component
    })
    annotations = local.common_annotations
  }

  spec {
    replicas = coalesce(each.value.replicas, local.config.replicas)

    strategy {
      type = each.value.strategy_type

      dynamic "rolling_update" {
        for_each = each.value.strategy_type == "RollingUpdate" ? [1] : []
        content {
          max_surge       = each.value.max_surge
          max_unavailable = each.value.max_unavailable
        }
      }
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = each.key
        "app.kubernetes.io/instance" = var.name_prefix
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/name"      = each.key
          "app.kubernetes.io/component" = each.value.component
          "app.kubernetes.io/instance"  = var.name_prefix
        })
        annotations = merge(local.common_annotations, each.value.pod_annotations)
      }

      spec {
        service_account_name = var.create_service_account ? kubernetes_service_account.app[0].metadata[0].name : var.service_account_name

        dynamic "security_context" {
          for_each = var.pod_security_context != null ? [var.pod_security_context] : []
          content {
            run_as_user     = security_context.value.run_as_user
            run_as_group    = security_context.value.run_as_group
            run_as_non_root = security_context.value.run_as_non_root
            fs_group        = security_context.value.fs_group
          }
        }

        container {
          name  = each.key
          image = each.value.image

          dynamic "port" {
            for_each = each.value.ports
            content {
              name           = port.value.name
              container_port = port.value.port
              protocol       = port.value.protocol
            }
          }

          resources {
            requests = {
              cpu    = coalesce(each.value.cpu_request, local.config.cpu_request)
              memory = coalesce(each.value.memory_request, local.config.memory_request)
            }
            limits = {
              cpu    = coalesce(each.value.cpu_limit, local.config.cpu_limit)
              memory = coalesce(each.value.memory_limit, local.config.memory_limit)
            }
          }

          dynamic "env" {
            for_each = each.value.env_vars
            content {
              name  = env.key
              value = env.value
            }
          }

          dynamic "env" {
            for_each = each.value.env_from_secrets
            content {
              name = env.key
              value_from {
                secret_key_ref {
                  name = env.value.secret_name
                  key  = env.value.key
                }
              }
            }
          }

          dynamic "env" {
            for_each = each.value.env_from_configmap
            content {
              name = env.key
              value_from {
                config_map_key_ref {
                  name = env.value.configmap_name
                  key  = env.value.key
                }
              }
            }
          }

          dynamic "volume_mount" {
            for_each = each.value.volume_mounts
            content {
              name       = volume_mount.value.name
              mount_path = volume_mount.value.mount_path
              read_only  = volume_mount.value.read_only
              sub_path   = volume_mount.value.sub_path
            }
          }

          dynamic "liveness_probe" {
            for_each = each.value.liveness_probe != null ? [each.value.liveness_probe] : []
            content {
              dynamic "http_get" {
                for_each = liveness_probe.value.type == "http" ? [1] : []
                content {
                  path   = liveness_probe.value.path
                  port   = liveness_probe.value.port
                  scheme = liveness_probe.value.scheme
                }
              }
              dynamic "tcp_socket" {
                for_each = liveness_probe.value.type == "tcp" ? [1] : []
                content {
                  port = liveness_probe.value.port
                }
              }
              dynamic "exec" {
                for_each = liveness_probe.value.type == "exec" ? [1] : []
                content {
                  command = liveness_probe.value.command
                }
              }
              initial_delay_seconds = liveness_probe.value.initial_delay_seconds
              period_seconds        = liveness_probe.value.period_seconds
              timeout_seconds       = liveness_probe.value.timeout_seconds
              failure_threshold     = liveness_probe.value.failure_threshold
              success_threshold     = liveness_probe.value.success_threshold
            }
          }

          dynamic "readiness_probe" {
            for_each = each.value.readiness_probe != null ? [each.value.readiness_probe] : []
            content {
              dynamic "http_get" {
                for_each = readiness_probe.value.type == "http" ? [1] : []
                content {
                  path   = readiness_probe.value.path
                  port   = readiness_probe.value.port
                  scheme = readiness_probe.value.scheme
                }
              }
              dynamic "tcp_socket" {
                for_each = readiness_probe.value.type == "tcp" ? [1] : []
                content {
                  port = readiness_probe.value.port
                }
              }
              dynamic "exec" {
                for_each = readiness_probe.value.type == "exec" ? [1] : []
                content {
                  command = readiness_probe.value.command
                }
              }
              initial_delay_seconds = readiness_probe.value.initial_delay_seconds
              period_seconds        = readiness_probe.value.period_seconds
              timeout_seconds       = readiness_probe.value.timeout_seconds
              failure_threshold     = readiness_probe.value.failure_threshold
              success_threshold     = readiness_probe.value.success_threshold
            }
          }

          dynamic "security_context" {
            for_each = each.value.container_security_context != null ? [each.value.container_security_context] : []
            content {
              run_as_user                = security_context.value.run_as_user
              run_as_non_root            = security_context.value.run_as_non_root
              read_only_root_filesystem  = security_context.value.read_only_root_filesystem
              allow_privilege_escalation = security_context.value.allow_privilege_escalation
            }
          }
        }

        dynamic "volume" {
          for_each = each.value.volumes
          content {
            name = volume.value.name

            dynamic "config_map" {
              for_each = volume.value.type == "configmap" ? [1] : []
              content {
                name = volume.value.source
              }
            }

            dynamic "secret" {
              for_each = volume.value.type == "secret" ? [1] : []
              content {
                secret_name = volume.value.source
              }
            }

            dynamic "persistent_volume_claim" {
              for_each = volume.value.type == "pvc" ? [1] : []
              content {
                claim_name = volume.value.source
              }
            }

            dynamic "empty_dir" {
              for_each = volume.value.type == "emptydir" ? [1] : []
              content {
                medium     = volume.value.medium
                size_limit = volume.value.size_limit
              }
            }
          }
        }

        dynamic "image_pull_secrets" {
          for_each = var.image_pull_secrets
          content {
            name = image_pull_secrets.value
          }
        }

        dynamic "affinity" {
          for_each = var.pod_affinity != null ? [var.pod_affinity] : []
          content {
            dynamic "node_affinity" {
              for_each = affinity.value.node_affinity != null ? [affinity.value.node_affinity] : []
              content {
                dynamic "required_during_scheduling_ignored_during_execution" {
                  for_each = node_affinity.value.required != null ? [node_affinity.value.required] : []
                  content {
                    node_selector_term {
                      dynamic "match_expressions" {
                        for_each = required_during_scheduling_ignored_during_execution.value.match_expressions
                        content {
                          key      = match_expressions.value.key
                          operator = match_expressions.value.operator
                          values   = match_expressions.value.values
                        }
                      }
                    }
                  }
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
  }

  timeouts {
    create = "10m"
    update = "10m"
    delete = "5m"
  }
}

# -----------------------------------------------------------------------------
# Services
# -----------------------------------------------------------------------------

resource "kubernetes_service" "app" {
  for_each = { for k, v in var.services : k => v if v.create_service }

  metadata {
    name      = "${var.name_prefix}-${each.key}"
    namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = each.key
    })
    annotations = merge(local.common_annotations, each.value.service_annotations)
  }

  spec {
    type = each.value.service_type

    selector = {
      "app.kubernetes.io/name"     = each.key
      "app.kubernetes.io/instance" = var.name_prefix
    }

    dynamic "port" {
      for_each = each.value.ports
      content {
        name        = port.value.name
        port        = port.value.service_port != null ? port.value.service_port : port.value.port
        target_port = port.value.port
        protocol    = port.value.protocol
        node_port   = each.value.service_type == "NodePort" ? port.value.node_port : null
      }
    }

    session_affinity = each.value.session_affinity
  }
}

# -----------------------------------------------------------------------------
# Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "app" {
  for_each = { for k, v in var.services : k => v if v.ingress_enabled }

  metadata {
    name      = "${var.name_prefix}-${each.key}"
    namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels    = merge(local.common_labels, {
      "app.kubernetes.io/name" = each.key
    })
    annotations = merge(local.common_annotations, var.ingress_annotations, each.value.ingress_annotations)
  }

  spec {
    ingress_class_name = var.ingress_class_name

    dynamic "tls" {
      for_each = each.value.ingress_tls_secret != null ? [1] : []
      content {
        hosts       = [each.value.ingress_host]
        secret_name = each.value.ingress_tls_secret
      }
    }

    rule {
      host = each.value.ingress_host

      http {
        path {
          path      = each.value.ingress_path
          path_type = each.value.ingress_path_type

          backend {
            service {
              name = kubernetes_service.app[each.key].metadata[0].name
              port {
                number = each.value.ports[0].port
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Horizontal Pod Autoscaler
# -----------------------------------------------------------------------------

resource "kubernetes_horizontal_pod_autoscaler_v2" "app" {
  for_each = { for k, v in var.services : k => v if v.autoscaling_enabled }

  metadata {
    name      = "${var.name_prefix}-${each.key}"
    namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.app[each.key].metadata[0].name
    }

    min_replicas = each.value.autoscaling_min_replicas
    max_replicas = each.value.autoscaling_max_replicas

    dynamic "metric" {
      for_each = each.value.autoscaling_cpu_threshold != null ? [1] : []
      content {
        type = "Resource"
        resource {
          name = "cpu"
          target {
            type                = "Utilization"
            average_utilization = each.value.autoscaling_cpu_threshold
          }
        }
      }
    }

    dynamic "metric" {
      for_each = each.value.autoscaling_memory_threshold != null ? [1] : []
      content {
        type = "Resource"
        resource {
          name = "memory"
          target {
            type                = "Utilization"
            average_utilization = each.value.autoscaling_memory_threshold
          }
        }
      }
    }

    behavior {
      scale_down {
        stabilization_window_seconds = 300
        select_policy                = "Max"
        policy {
          type           = "Percent"
          value          = 10
          period_seconds = 60
        }
      }
      scale_up {
        stabilization_window_seconds = 0
        select_policy                = "Max"
        policy {
          type           = "Percent"
          value          = 100
          period_seconds = 15
        }
        policy {
          type           = "Pods"
          value          = 4
          period_seconds = 15
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Pod Disruption Budget
# -----------------------------------------------------------------------------

resource "kubernetes_pod_disruption_budget_v1" "app" {
  for_each = { for k, v in var.services : k => v if v.pdb_enabled }

  metadata {
    name      = "${var.name_prefix}-${each.key}"
    namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  spec {
    min_available = each.value.pdb_min_available

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = each.key
        "app.kubernetes.io/instance" = var.name_prefix
      }
    }
  }
}

# -----------------------------------------------------------------------------
# NetworkPolicy
# -----------------------------------------------------------------------------

resource "kubernetes_network_policy" "app" {
  for_each = { for k, v in var.services : k => v if v.network_policy_enabled }

  metadata {
    name      = "${var.name_prefix}-${each.key}"
    namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
    labels    = local.common_labels
  }

  spec {
    pod_selector {
      match_labels = {
        "app.kubernetes.io/name"     = each.key
        "app.kubernetes.io/instance" = var.name_prefix
      }
    }

    policy_types = ["Ingress", "Egress"]

    # Allow ingress from specified sources
    dynamic "ingress" {
      for_each = each.value.network_policy_ingress
      content {
        dynamic "from" {
          for_each = ingress.value.from
          content {
            dynamic "namespace_selector" {
              for_each = from.value.namespace_selector != null ? [from.value.namespace_selector] : []
              content {
                match_labels = namespace_selector.value
              }
            }
            dynamic "pod_selector" {
              for_each = from.value.pod_selector != null ? [from.value.pod_selector] : []
              content {
                match_labels = pod_selector.value
              }
            }
          }
        }
        dynamic "ports" {
          for_each = ingress.value.ports
          content {
            port     = ports.value.port
            protocol = ports.value.protocol
          }
        }
      }
    }

    # Allow egress to specified destinations
    dynamic "egress" {
      for_each = each.value.network_policy_egress
      content {
        dynamic "to" {
          for_each = egress.value.to
          content {
            dynamic "namespace_selector" {
              for_each = to.value.namespace_selector != null ? [to.value.namespace_selector] : []
              content {
                match_labels = namespace_selector.value
              }
            }
            dynamic "pod_selector" {
              for_each = to.value.pod_selector != null ? [to.value.pod_selector] : []
              content {
                match_labels = pod_selector.value
              }
            }
            dynamic "ip_block" {
              for_each = to.value.cidr != null ? [to.value.cidr] : []
              content {
                cidr = ip_block.value
              }
            }
          }
        }
        dynamic "ports" {
          for_each = egress.value.ports
          content {
            port     = ports.value.port
            protocol = ports.value.protocol
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# ServiceMonitor (for Prometheus Operator)
# -----------------------------------------------------------------------------

resource "kubernetes_manifest" "service_monitor" {
  for_each = { for k, v in var.services : k => v if v.metrics_enabled && var.prometheus_operator_enabled }

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "${var.name_prefix}-${each.key}"
      namespace = var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace
      labels    = merge(local.common_labels, var.prometheus_labels, {
        "app.kubernetes.io/name" = each.key
      })
    }
    spec = {
      selector = {
        matchLabels = {
          "app.kubernetes.io/name"     = each.key
          "app.kubernetes.io/instance" = var.name_prefix
        }
      }
      endpoints = [{
        port     = each.value.metrics_port_name
        path     = each.value.metrics_path
        interval = each.value.metrics_interval
      }]
      namespaceSelector = {
        matchNames = [var.create_namespace ? kubernetes_namespace.app[0].metadata[0].name : var.namespace]
      }
    }
  }
}
