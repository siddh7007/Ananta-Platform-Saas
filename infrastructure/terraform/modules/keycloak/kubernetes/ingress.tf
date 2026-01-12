# =============================================================================
# Traefik Ingress Configuration for Keycloak
# =============================================================================
# Uses Traefik (built into k3s/Rancher Desktop) for permanent service exposure.
#
# Access via:
#   - http://keycloak.localhost  -> Keycloak (8080)
# =============================================================================

# -----------------------------------------------------------------------------
# Keycloak Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "keycloak" {
  metadata {
    name      = "keycloak-ingress"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "keycloak.localhost"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "keycloak"
              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_service.keycloak]
}
