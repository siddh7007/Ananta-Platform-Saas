# =============================================================================
# Traefik Ingress Configuration for Control Plane
# =============================================================================
# Uses Traefik (built into k3s/Rancher Desktop) for permanent service exposure.
#
# Access via:
#   - http://api.localhost       -> Tenant Management Service (14000)
#   - http://admin.localhost     -> Admin App (27555)
# =============================================================================

# -----------------------------------------------------------------------------
# Tenant Management Service Ingress (API)
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "tenant_management_service" {
  metadata {
    name      = "tenant-management-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "api.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "tenant-management-service"
              port {
                number = 14000
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Admin App Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "admin_app" {
  # Always create for now - admin-app is deployed by default

  metadata {
    name      = "admin-app-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "admin.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "admin-app"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
