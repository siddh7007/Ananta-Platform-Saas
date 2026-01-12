# =============================================================================
# Traefik Ingress Configuration for Local Development
# =============================================================================
# Uses Traefik (built into k3s/Rancher Desktop) for permanent service exposure.
# This eliminates the need for kubectl port-forward commands.
#
# Access via:
#   - http://cbp.localhost       -> Customer Portal (27100)
#   - http://cns.localhost       -> CNS Service (27200)
#   - http://studio.localhost    -> Supabase Studio (27800)
#   - http://minio.localhost     -> MinIO Console (27041)
#   - http://rabbitmq.localhost  -> RabbitMQ Management (15672)
# =============================================================================

# -----------------------------------------------------------------------------
# Customer Portal Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "customer_portal" {
  count = var.deploy_customer_portal ? 1 : 0

  metadata {
    name      = "customer-portal-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "cbp.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "customer-portal"
              port {
                number = 27100
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# CNS Service Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "cns_service" {
  count = var.deploy_cns_service ? 1 : 0

  metadata {
    name      = "cns-service-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "cns.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "cns-service"
              port {
                number = 27200
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Supabase Studio Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "supabase_studio" {
  count = var.deploy_supabase_studio ? 1 : 0

  metadata {
    name      = "supabase-studio-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "studio.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "supabase-studio"
              port {
                number = 3000
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# MinIO Console Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "minio_console" {
  metadata {
    name      = "minio-console-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "minio.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "minio-console"
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
# RabbitMQ Management Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "rabbitmq_management" {
  metadata {
    name      = "rabbitmq-management-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "rabbitmq.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "rabbitmq"
              port {
                number = 15672
              }
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_stateful_set.rabbitmq]
}

# -----------------------------------------------------------------------------
# CNS Dashboard Ingress (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "cns_dashboard" {
  count = var.deploy_cns_dashboard ? 1 : 0

  metadata {
    name      = "cns-dashboard-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "dashboard.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "cns-dashboard"
              port {
                number = 27250
              }
            }
          }
        }
      }
    }
  }
}
