# =============================================================================
# Observability Stack - Terraform Module
# =============================================================================

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.10"
    }
  }
}

locals {
  namespace = var.namespace
  labels = merge(var.labels, {
    "app.kubernetes.io/part-of" = "observability"
  })
}

resource "kubernetes_namespace" "monitoring" {
  count = var.create_namespace ? 1 : 0
  metadata {
    name   = local.namespace
    labels = local.labels
  }
}

resource "kubernetes_deployment" "jaeger" {
  count = var.enable_jaeger ? 1 : 0

  metadata {
    name      = "jaeger"
    namespace = local.namespace
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "jaeger" })
  }

  spec {
    replicas = 1
    selector {
      match_labels = { "app.kubernetes.io/name" = "jaeger" }
    }

    template {
      metadata {
        labels = merge(local.labels, { "app.kubernetes.io/name" = "jaeger" })
      }
      spec {
        container {
          name  = "jaeger"
          image = "jaegertracing/all-in-one:${var.jaeger_version}"
          port {
            container_port = 16686
            name           = "ui"
          }
          port {
            container_port = 14268
            name           = "collector"
          }
          port {
            container_port = 4317
            name           = "otlp-grpc"
          }
          env {
            name  = "COLLECTOR_OTLP_ENABLED"
            value = "true"
          }
          resources {
            requests = { cpu = var.jaeger_cpu_request, memory = var.jaeger_memory_request }
            limits   = { cpu = var.jaeger_cpu_limit, memory = var.jaeger_memory_limit }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_namespace.monitoring]
}

resource "kubernetes_service" "jaeger" {
  count = var.enable_jaeger ? 1 : 0

  metadata {
    name      = "jaeger"
    namespace = local.namespace
    labels    = merge(local.labels, { "app.kubernetes.io/component" = "jaeger" })
  }

  spec {
    selector = { "app.kubernetes.io/name" = "jaeger" }
    port {
      name        = "ui"
      port        = 16686
      target_port = 16686
      node_port   = var.jaeger_node_port
    }
    port {
      name        = "collector"
      port        = 14268
      target_port = 14268
    }
    port {
      name        = "otlp"
      port        = 4317
      target_port = 4317
    }
    type = "NodePort"
  }
}
