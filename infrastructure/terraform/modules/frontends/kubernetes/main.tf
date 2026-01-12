# =============================================================================
# Kubernetes Frontend Applications Module
# =============================================================================
# This module deploys all 5 frontend applications on Kubernetes:
# 1. admin-app - React app (Control Plane admin portal)
# 2. customer-portal - React app (Customer facing)
# 3. cns-dashboard - React Admin (CNS Admin UI)
# 4. backstage-portal - Backstage (Admin portal)
# 5. dashboard - Next.js (Unified dashboard)
# =============================================================================

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  # Common labels for all frontends
  common_labels = merge(
    {
      "app.kubernetes.io/managed-by" = "terraform"
      "app.kubernetes.io/part-of"    = "ananta-platform"
      "environment"                  = var.environment
    },
    var.labels
  )

  # Application-specific labels
  admin_app_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "admin-app"
      "app.kubernetes.io/instance"  = "${var.name_prefix}-admin-app"
      "app.kubernetes.io/component" = "control-plane-ui"
    }
  )

  customer_portal_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "admin-app"
      "app.kubernetes.io/instance"  = "${var.name_prefix}-customer-portal"
      "app.kubernetes.io/component" = "customer-ui"
    }
  )

  cns_dashboard_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "cns-dashboard"
      "app.kubernetes.io/instance"  = "${var.name_prefix}-cns-dashboard"
      "app.kubernetes.io/component" = "cns-ui"
    }
  )

  backstage_portal_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "backstage-portal"
      "app.kubernetes.io/instance"  = "${var.name_prefix}-backstage-portal"
      "app.kubernetes.io/component" = "admin-portal"
    }
  )

  dashboard_labels = merge(
    local.common_labels,
    {
      "app.kubernetes.io/name"      = "dashboard"
      "app.kubernetes.io/instance"  = "${var.name_prefix}-dashboard"
      "app.kubernetes.io/component" = "unified-dashboard"
    }
  )
}

# -----------------------------------------------------------------------------
# Namespace (optional)
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "frontends" {
  count = var.create_namespace ? 1 : 0

  metadata {
    name   = var.namespace
    labels = local.common_labels
  }
}

# -----------------------------------------------------------------------------
# Shared ConfigMap for Frontend Configuration
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "frontend_config" {
  metadata {
    name      = "${var.name_prefix}-frontend-config"
    namespace = var.namespace
    labels    = local.common_labels
  }

  data = {
    # API URLs
    API_URL               = var.api_url
    CONTROL_PLANE_API_URL = var.control_plane_api_url
    CNS_API_URL           = var.cns_api_url
    SUPABASE_URL          = var.supabase_url
    SUPABASE_ANON_KEY     = var.supabase_anon_key

    # Keycloak Configuration
    KEYCLOAK_URL       = var.keycloak_url
    KEYCLOAK_REALM     = var.keycloak_realm
    KEYCLOAK_CLIENT_ID = var.keycloak_client_id

    # Feature Flags
    ENABLE_BILLING    = var.enable_billing ? "true" : "false"
    ENABLE_WORKFLOWS  = var.enable_workflows ? "true" : "false"
    ENABLE_MONITORING = var.enable_monitoring ? "true" : "false"
    ENABLE_AUDIT_LOGS = var.enable_audit_logs ? "true" : "false"

    # Environment
    NODE_ENV    = var.environment == "prod" ? "production" : "development"
    ENVIRONMENT = var.environment
  }

  depends_on = [kubernetes_namespace.frontends]
}

# -----------------------------------------------------------------------------
# 1. Admin App (Control Plane Admin Portal)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "admin_app" {
  count = var.deploy_admin_app ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-admin-app"
    namespace = var.namespace
    labels    = local.admin_app_labels
  }

  spec {
    replicas = var.admin_app_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "admin-app"
        "app.kubernetes.io/instance" = "${var.name_prefix}-admin-app"
      }
    }

    template {
      metadata {
        labels = local.admin_app_labels
      }

      spec {
        container {
          name  = "admin-app"
          image = var.admin_app_image

          port {
            name           = "http"
            container_port = 80
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.frontend_config.metadata[0].name
            }
          }

          env {
            name  = "VITE_API_URL"
            value = var.control_plane_api_url
          }

          env {
            name  = "VITE_KEYCLOAK_URL"
            value = var.keycloak_url
          }

          env {
            name  = "VITE_KEYCLOAK_REALM"
            value = var.keycloak_realm
          }

          env {
            name  = "VITE_KEYCLOAK_CLIENT_ID"
            value = var.keycloak_client_id
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          resources {
            requests = {
              cpu    = var.admin_app_cpu_request
              memory = var.admin_app_memory_request
            }
            limits = {
              cpu    = var.admin_app_cpu_limit
              memory = var.admin_app_memory_limit
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_config_map.frontend_config]
}

resource "kubernetes_service" "admin_app" {
  count = var.deploy_admin_app ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-admin-app"
    namespace = var.namespace
    labels    = local.admin_app_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = "admin-app"
      "app.kubernetes.io/instance" = "${var.name_prefix}-admin-app"
    }

    port {
      name        = "http"
      port        = var.admin_app_port
      target_port = 80
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.admin_app]
}

# -----------------------------------------------------------------------------
# 2. Customer Portal (Customer Facing UI)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "customer_portal" {
  count = var.deploy_customer_portal ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-customer-portal"
    namespace = var.namespace
    labels    = local.customer_portal_labels
  }

  spec {
    replicas = var.customer_portal_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "customer-portal"
        "app.kubernetes.io/instance" = "${var.name_prefix}-customer-portal"
      }
    }

    template {
      metadata {
        labels = local.customer_portal_labels
      }

      spec {
        container {
          name  = "customer-portal"
          image = var.customer_portal_image

          port {
            name           = "http"
            container_port = 80
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.frontend_config.metadata[0].name
            }
          }

          env {
            name  = "VITE_API_URL"
            value = var.control_plane_api_url
          }

          env {
            name  = "VITE_CNS_API_URL"
            value = var.cns_api_url
          }

          env {
            name  = "VITE_SUPABASE_URL"
            value = var.supabase_url
          }

          env {
            name  = "VITE_SUPABASE_ANON_KEY"
            value = var.supabase_anon_key
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          resources {
            requests = {
              cpu    = var.customer_portal_cpu_request
              memory = var.customer_portal_memory_request
            }
            limits = {
              cpu    = var.customer_portal_cpu_limit
              memory = var.customer_portal_memory_limit
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_config_map.frontend_config]
}

resource "kubernetes_service" "customer_portal" {
  count = var.deploy_customer_portal ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-customer-portal"
    namespace = var.namespace
    labels    = local.customer_portal_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = "customer-portal"
      "app.kubernetes.io/instance" = "${var.name_prefix}-customer-portal"
    }

    port {
      name        = "http"
      port        = var.customer_portal_port
      target_port = 80
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.customer_portal]
}

# -----------------------------------------------------------------------------
# 3. CNS Dashboard (CNS Admin UI)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "cns_dashboard" {
  count = var.deploy_cns_dashboard ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-cns-dashboard"
    namespace = var.namespace
    labels    = local.cns_dashboard_labels
  }

  spec {
    replicas = var.cns_dashboard_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "cns-dashboard"
        "app.kubernetes.io/instance" = "${var.name_prefix}-cns-dashboard"
      }
    }

    template {
      metadata {
        labels = local.cns_dashboard_labels
      }

      spec {
        container {
          name  = "cns-dashboard"
          image = var.cns_dashboard_image

          port {
            name           = "http"
            container_port = 80
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.frontend_config.metadata[0].name
            }
          }

          env {
            name  = "REACT_APP_API_URL"
            value = var.cns_api_url
          }

          env {
            name  = "REACT_APP_SUPABASE_URL"
            value = var.supabase_url
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          resources {
            requests = {
              cpu    = var.cns_dashboard_cpu_request
              memory = var.cns_dashboard_memory_request
            }
            limits = {
              cpu    = var.cns_dashboard_cpu_limit
              memory = var.cns_dashboard_memory_limit
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_config_map.frontend_config]
}

resource "kubernetes_service" "cns_dashboard" {
  count = var.deploy_cns_dashboard ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-cns-dashboard"
    namespace = var.namespace
    labels    = local.cns_dashboard_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = "cns-dashboard"
      "app.kubernetes.io/instance" = "${var.name_prefix}-cns-dashboard"
    }

    port {
      name        = "http"
      port        = var.cns_dashboard_port
      target_port = 80
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.cns_dashboard]
}

# -----------------------------------------------------------------------------
# 4. Backstage Portal (Admin Portal)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "backstage_portal" {
  count = var.deploy_backstage_portal ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-backstage-portal"
    namespace = var.namespace
    labels    = local.backstage_portal_labels
  }

  spec {
    replicas = var.backstage_portal_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "backstage-portal"
        "app.kubernetes.io/instance" = "${var.name_prefix}-backstage-portal"
      }
    }

    template {
      metadata {
        labels = local.backstage_portal_labels
      }

      spec {
        container {
          name  = "backstage-portal"
          image = var.backstage_portal_image

          port {
            name           = "http"
            container_port = 7007
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.frontend_config.metadata[0].name
            }
          }

          env {
            name  = "APP_CONFIG_app_baseUrl"
            value = "http://localhost:${var.backstage_portal_port}"
          }

          env {
            name  = "APP_CONFIG_backend_baseUrl"
            value = var.api_url
          }

          env {
            name  = "APP_CONFIG_backend_listen_port"
            value = "7007"
          }

          liveness_probe {
            http_get {
              path = "/healthcheck"
              port = 7007
            }
            initial_delay_seconds = 60
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/healthcheck"
              port = 7007
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          resources {
            requests = {
              cpu    = var.backstage_portal_cpu_request
              memory = var.backstage_portal_memory_request
            }
            limits = {
              cpu    = var.backstage_portal_cpu_limit
              memory = var.backstage_portal_memory_limit
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_config_map.frontend_config]
}

resource "kubernetes_service" "backstage_portal" {
  count = var.deploy_backstage_portal ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-backstage-portal"
    namespace = var.namespace
    labels    = local.backstage_portal_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = "backstage-portal"
      "app.kubernetes.io/instance" = "${var.name_prefix}-backstage-portal"
    }

    port {
      name        = "http"
      port        = var.backstage_portal_port
      target_port = 7007
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.backstage_portal]
}

# -----------------------------------------------------------------------------
# 5. Dashboard (Unified Dashboard - Next.js)
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "dashboard" {
  count = var.deploy_dashboard ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-dashboard"
    namespace = var.namespace
    labels    = local.dashboard_labels
  }

  spec {
    replicas = var.dashboard_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "dashboard"
        "app.kubernetes.io/instance" = "${var.name_prefix}-dashboard"
      }
    }

    template {
      metadata {
        labels = local.dashboard_labels
      }

      spec {
        container {
          name  = "dashboard"
          image = var.dashboard_image

          port {
            name           = "http"
            container_port = 3000
            protocol       = "TCP"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.frontend_config.metadata[0].name
            }
          }

          env {
            name  = "NEXT_PUBLIC_API_URL"
            value = var.api_url
          }

          env {
            name  = "NEXT_PUBLIC_CONTROL_PLANE_API_URL"
            value = var.control_plane_api_url
          }

          env {
            name  = "NEXT_PUBLIC_CNS_API_URL"
            value = var.cns_api_url
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          resources {
            requests = {
              cpu    = var.dashboard_cpu_request
              memory = var.dashboard_memory_request
            }
            limits = {
              cpu    = var.dashboard_cpu_limit
              memory = var.dashboard_memory_limit
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_config_map.frontend_config]
}

resource "kubernetes_service" "dashboard" {
  count = var.deploy_dashboard ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-dashboard"
    namespace = var.namespace
    labels    = local.dashboard_labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = "dashboard"
      "app.kubernetes.io/instance" = "${var.name_prefix}-dashboard"
    }

    port {
      name        = "http"
      port        = var.dashboard_port
      target_port = 3000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [kubernetes_deployment.dashboard]
}

# -----------------------------------------------------------------------------
# Ingress (Optional)
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "frontends" {
  count = var.create_ingress ? 1 : 0

  metadata {
    name      = "${var.name_prefix}-frontends"
    namespace = var.namespace
    labels    = local.common_labels
    annotations = merge(
      {
        "kubernetes.io/ingress.class" = var.ingress_class
      },
      var.ingress_annotations
    )
  }

  spec {
    dynamic "tls" {
      for_each = var.ingress_tls_enabled ? [1] : []
      content {
        hosts       = var.ingress_hosts
        secret_name = var.ingress_tls_secret
      }
    }

    dynamic "rule" {
      for_each = var.deploy_admin_app ? [1] : []
      content {
        host = var.admin_app_hostname

        http {
          path {
            path      = "/"
            path_type = "Prefix"

            backend {
              service {
                name = kubernetes_service.admin_app[0].metadata[0].name
                port {
                  number = var.admin_app_port
                }
              }
            }
          }
        }
      }
    }

    dynamic "rule" {
      for_each = var.deploy_customer_portal ? [1] : []
      content {
        host = var.customer_portal_hostname

        http {
          path {
            path      = "/"
            path_type = "Prefix"

            backend {
              service {
                name = kubernetes_service.customer_portal[0].metadata[0].name
                port {
                  number = var.customer_portal_port
                }
              }
            }
          }
        }
      }
    }

    dynamic "rule" {
      for_each = var.deploy_cns_dashboard ? [1] : []
      content {
        host = var.cns_dashboard_hostname

        http {
          path {
            path      = "/"
            path_type = "Prefix"

            backend {
              service {
                name = kubernetes_service.cns_dashboard[0].metadata[0].name
                port {
                  number = var.cns_dashboard_port
                }
              }
            }
          }
        }
      }
    }

    dynamic "rule" {
      for_each = var.deploy_backstage_portal ? [1] : []
      content {
        host = var.backstage_portal_hostname

        http {
          path {
            path      = "/"
            path_type = "Prefix"

            backend {
              service {
                name = kubernetes_service.backstage_portal[0].metadata[0].name
                port {
                  number = var.backstage_portal_port
                }
              }
            }
          }
        }
      }
    }

    dynamic "rule" {
      for_each = var.deploy_dashboard ? [1] : []
      content {
        host = var.dashboard_hostname

        http {
          path {
            path      = "/"
            path_type = "Prefix"

            backend {
              service {
                name = kubernetes_service.dashboard[0].metadata[0].name
                port {
                  number = var.dashboard_port
                }
              }
            }
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_service.admin_app,
    kubernetes_service.customer_portal,
    kubernetes_service.cns_dashboard,
    kubernetes_service.backstage_portal,
    kubernetes_service.dashboard
  ]
}
