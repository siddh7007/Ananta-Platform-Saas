#
# Ananta Platform SaaS - Complete Unified Deployment
# This orchestrates all 47 services across 9 namespaces
#

terraform {
  required_version = ">= 1.5.0"

  backend "local" {
    path = "terraform.tfstate"
  }

  # For production, use remote backend:
  # backend "s3" {
  #   bucket         = "ananta-terraform-state"
  #   key            = "full-platform/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

#==============================================================================
# KUBERNETES NAMESPACES
#==============================================================================

resource "kubernetes_namespace" "control_plane" {
  metadata {
    name = "control-plane"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "control-plane"
    }
  }
}

resource "kubernetes_namespace" "app_plane" {
  metadata {
    name = "app-plane"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "app-plane"
    }
  }
}

resource "kubernetes_namespace" "auth_system" {
  metadata {
    name = "auth-system"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "infrastructure"
    }
  }
}

resource "kubernetes_namespace" "temporal_system" {
  metadata {
    name = "temporal-system"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "infrastructure"
    }
  }
}

resource "kubernetes_namespace" "notifications" {
  metadata {
    name = "notifications"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "infrastructure"
    }
  }
}

resource "kubernetes_namespace" "monitoring_system" {
  metadata {
    name = "monitoring-system"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "infrastructure"
    }
  }
}

resource "kubernetes_namespace" "database_system" {
  metadata {
    name = "database-system"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "infrastructure"
    }
  }
}

resource "kubernetes_namespace" "cache_system" {
  metadata {
    name = "cache-system"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "infrastructure"
    }
  }
}

resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
      "tier"                        = "gitops"
    }
  }
}

#==============================================================================
# PHASE 1: INFRASTRUCTURE LAYER (No Dependencies)
#==============================================================================

#------------------------------------------------------------------------------
# Network Configuration
#------------------------------------------------------------------------------
module "network" {
  source = "../../modules/network"

  environment         = var.environment
  enable_network_policies = var.enable_network_policies
  enable_ingress      = var.enable_ingress
  ingress_class       = var.ingress_class
  domain_name         = var.domain_name
  enable_tls          = var.enable_tls
  tls_secret_name     = var.tls_secret_name

  depends_on = [
    kubernetes_namespace.control_plane,
    kubernetes_namespace.app_plane,
  ]
}

#------------------------------------------------------------------------------
# Database (PostgreSQL via Bitnami Helm)
#------------------------------------------------------------------------------
module "database" {
  source = "../../modules/database/kubernetes"

  environment         = var.environment
  namespace           = kubernetes_namespace.database_system.metadata[0].name
  postgres_version    = var.postgres_version
  postgres_password   = var.postgres_password
  storage_class       = var.storage_class
  storage_size        = var.postgres_storage_size
  enable_replication  = var.postgres_enable_replication
  replica_count       = var.postgres_replica_count
  enable_backup       = var.postgres_enable_backup
  backup_schedule     = var.postgres_backup_schedule
  resource_requests = {
    cpu    = var.postgres_cpu_request
    memory = var.postgres_memory_request
  }
  resource_limits = {
    cpu    = var.postgres_cpu_limit
    memory = var.postgres_memory_limit
  }

  depends_on = [kubernetes_namespace.database_system]
}

#------------------------------------------------------------------------------
# Cache (Redis via Bitnami Helm)
#------------------------------------------------------------------------------
module "cache" {
  source = "../../modules/cache/kubernetes"

  environment       = var.environment
  namespace         = kubernetes_namespace.cache_system.metadata[0].name
  redis_version     = var.redis_version
  redis_password    = var.redis_password
  storage_class     = var.storage_class
  storage_size      = var.redis_storage_size
  enable_sentinel   = var.redis_enable_sentinel
  replica_count     = var.redis_replica_count
  max_memory        = var.redis_max_memory
  max_memory_policy = var.redis_max_memory_policy
  resource_requests = {
    cpu    = var.redis_cpu_request
    memory = var.redis_memory_request
  }
  resource_limits = {
    cpu    = var.redis_cpu_limit
    memory = var.redis_memory_limit
  }

  depends_on = [kubernetes_namespace.cache_system]
}

#------------------------------------------------------------------------------
# RabbitMQ (Bitnami Helm)
#------------------------------------------------------------------------------
module "rabbitmq" {
  source = "../../modules/rabbitmq/kubernetes"

  environment      = var.environment
  namespace        = kubernetes_namespace.app_plane.metadata[0].name
  rabbitmq_version = var.rabbitmq_version
  rabbitmq_user    = var.rabbitmq_user
  rabbitmq_password = var.rabbitmq_password
  storage_class    = var.storage_class
  storage_size     = var.rabbitmq_storage_size
  replica_count    = var.rabbitmq_replica_count
  enable_metrics   = var.rabbitmq_enable_metrics
  resource_requests = {
    cpu    = var.rabbitmq_cpu_request
    memory = var.rabbitmq_memory_request
  }
  resource_limits = {
    cpu    = var.rabbitmq_cpu_limit
    memory = var.rabbitmq_memory_limit
  }

  depends_on = [kubernetes_namespace.app_plane]
}

#------------------------------------------------------------------------------
# MinIO (Official Helm)
#------------------------------------------------------------------------------
module "minio" {
  source = "../../modules/minio/kubernetes"

  environment       = var.environment
  namespace         = kubernetes_namespace.app_plane.metadata[0].name
  minio_version     = var.minio_version
  minio_access_key  = var.minio_access_key
  minio_secret_key  = var.minio_secret_key
  storage_class     = var.storage_class
  storage_size      = var.minio_storage_size
  replica_count     = var.minio_replica_count
  enable_console    = var.minio_enable_console
  default_buckets   = var.minio_default_buckets
  resource_requests = {
    cpu    = var.minio_cpu_request
    memory = var.minio_memory_request
  }
  resource_limits = {
    cpu    = var.minio_cpu_limit
    memory = var.minio_memory_limit
  }

  depends_on = [kubernetes_namespace.app_plane]
}

#------------------------------------------------------------------------------
# Vault (HashiCorp Official Helm)
#------------------------------------------------------------------------------
module "vault" {
  source = "../../modules/vault/kubernetes"

  environment     = var.environment
  namespace       = kubernetes_namespace.auth_system.metadata[0].name
  vault_version   = var.vault_version
  storage_class   = var.storage_class
  storage_size    = var.vault_storage_size
  replica_count   = var.vault_replica_count
  enable_ui       = var.vault_enable_ui
  enable_raft     = var.vault_enable_raft
  unseal_keys     = var.vault_unseal_keys
  root_token      = var.vault_root_token
  resource_requests = {
    cpu    = var.vault_cpu_request
    memory = var.vault_memory_request
  }
  resource_limits = {
    cpu    = var.vault_cpu_limit
    memory = var.vault_memory_limit
  }

  depends_on = [kubernetes_namespace.auth_system]
}

#------------------------------------------------------------------------------
# Keycloak (Bitnami Helm)
#------------------------------------------------------------------------------
module "keycloak" {
  source = "../../modules/keycloak/kubernetes"

  environment          = var.environment
  namespace            = kubernetes_namespace.auth_system.metadata[0].name
  keycloak_version     = var.keycloak_version
  keycloak_admin_user  = var.keycloak_admin_user
  keycloak_admin_password = var.keycloak_admin_password
  postgres_host        = module.database.postgres_host
  postgres_port        = module.database.postgres_port
  postgres_database    = var.keycloak_database
  postgres_user        = var.keycloak_db_user
  postgres_password    = var.keycloak_db_password
  replica_count        = var.keycloak_replica_count
  enable_metrics       = var.keycloak_enable_metrics
  themes               = var.keycloak_themes
  resource_requests = {
    cpu    = var.keycloak_cpu_request
    memory = var.keycloak_memory_request
  }
  resource_limits = {
    cpu    = var.keycloak_cpu_limit
    memory = var.keycloak_memory_limit
  }

  depends_on = [
    kubernetes_namespace.auth_system,
    module.database,
  ]
}

#------------------------------------------------------------------------------
# Temporal (Official Helm)
#------------------------------------------------------------------------------
module "temporal" {
  source = "../../modules/temporal/kubernetes"

  environment       = var.environment
  namespace         = kubernetes_namespace.temporal_system.metadata[0].name
  temporal_version  = var.temporal_version
  postgres_host     = module.database.postgres_host
  postgres_port     = module.database.postgres_port
  postgres_database = var.temporal_database
  postgres_user     = var.temporal_db_user
  postgres_password = var.temporal_db_password
  default_namespace = var.temporal_default_namespace
  additional_namespaces = var.temporal_additional_namespaces
  enable_ui         = var.temporal_enable_ui
  enable_web        = var.temporal_enable_web
  replica_count = {
    frontend  = var.temporal_frontend_replicas
    history   = var.temporal_history_replicas
    matching  = var.temporal_matching_replicas
    worker    = var.temporal_worker_replicas
  }
  resource_requests = {
    cpu    = var.temporal_cpu_request
    memory = var.temporal_memory_request
  }
  resource_limits = {
    cpu    = var.temporal_cpu_limit
    memory = var.temporal_memory_limit
  }

  depends_on = [
    kubernetes_namespace.temporal_system,
    module.database,
  ]
}

#==============================================================================
# PHASE 2: DATA LAYER (Depends on Phase 1)
#==============================================================================

#------------------------------------------------------------------------------
# Supabase (App Plane Database)
#------------------------------------------------------------------------------
module "supabase" {
  source = "../../modules/supabase/kubernetes"

  environment        = var.environment
  namespace          = kubernetes_namespace.app_plane.metadata[0].name
  supabase_version   = var.supabase_version
  postgres_host      = module.database.postgres_host
  postgres_port      = module.database.postgres_port
  postgres_database  = var.supabase_database
  postgres_user      = var.supabase_db_user
  postgres_password  = var.supabase_db_password
  jwt_secret         = var.supabase_jwt_secret
  anon_key           = var.supabase_anon_key
  service_key        = var.supabase_service_key
  enable_studio      = var.supabase_enable_studio
  enable_storage     = var.supabase_enable_storage
  storage_backend    = "minio"
  minio_endpoint     = module.minio.minio_endpoint
  minio_access_key   = var.minio_access_key
  minio_secret_key   = var.minio_secret_key
  resource_requests = {
    cpu    = var.supabase_cpu_request
    memory = var.supabase_memory_request
  }
  resource_limits = {
    cpu    = var.supabase_cpu_limit
    memory = var.supabase_memory_limit
  }

  depends_on = [
    kubernetes_namespace.app_plane,
    module.database,
    module.minio,
  ]
}

#------------------------------------------------------------------------------
# Directus (Admin CMS)
#------------------------------------------------------------------------------
module "directus" {
  source = "../../modules/directus/kubernetes"

  environment       = var.environment
  namespace         = kubernetes_namespace.app_plane.metadata[0].name
  directus_version  = var.directus_version
  postgres_host     = module.database.postgres_host
  postgres_port     = module.database.postgres_port
  postgres_database = var.directus_database
  postgres_user     = var.directus_db_user
  postgres_password = var.directus_db_password
  admin_email       = var.directus_admin_email
  admin_password    = var.directus_admin_password
  secret_key        = var.directus_secret_key
  storage_backend   = "minio"
  minio_endpoint    = module.minio.minio_endpoint
  minio_access_key  = var.minio_access_key
  minio_secret_key  = var.minio_secret_key
  minio_bucket      = "directus"
  replica_count     = var.directus_replica_count
  resource_requests = {
    cpu    = var.directus_cpu_request
    memory = var.directus_memory_request
  }
  resource_limits = {
    cpu    = var.directus_cpu_limit
    memory = var.directus_memory_limit
  }

  depends_on = [
    kubernetes_namespace.app_plane,
    module.database,
    module.minio,
  ]
}

#------------------------------------------------------------------------------
# Novu (Notification Service)
#------------------------------------------------------------------------------
module "novu" {
  source = "../../modules/novu/kubernetes"

  environment       = var.environment
  namespace         = kubernetes_namespace.notifications.metadata[0].name
  novu_version      = var.novu_version
  postgres_host     = module.database.postgres_host
  postgres_port     = module.database.postgres_port
  postgres_database = var.novu_database
  postgres_user     = var.novu_db_user
  postgres_password = var.novu_db_password
  redis_host        = module.cache.redis_host
  redis_port        = module.cache.redis_port
  redis_password    = var.redis_password
  jwt_secret        = var.novu_jwt_secret
  enable_api        = var.novu_enable_api
  enable_worker     = var.novu_enable_worker
  enable_ws         = var.novu_enable_ws
  enable_web        = var.novu_enable_web
  replica_count = {
    api    = var.novu_api_replicas
    worker = var.novu_worker_replicas
    ws     = var.novu_ws_replicas
  }
  resource_requests = {
    cpu    = var.novu_cpu_request
    memory = var.novu_memory_request
  }
  resource_limits = {
    cpu    = var.novu_cpu_limit
    memory = var.novu_memory_limit
  }

  depends_on = [
    kubernetes_namespace.notifications,
    module.database,
    module.cache,
  ]
}

#------------------------------------------------------------------------------
# Observability Stack (Prometheus, Grafana, Loki)
#------------------------------------------------------------------------------
module "observability" {
  source = "../../modules/observability/kubernetes"

  environment           = var.environment
  namespace             = kubernetes_namespace.monitoring_system.metadata[0].name
  enable_prometheus     = var.enable_prometheus
  enable_grafana        = var.enable_grafana
  enable_loki           = var.enable_loki
  enable_tempo          = var.enable_tempo
  grafana_admin_user    = var.grafana_admin_user
  grafana_admin_password = var.grafana_admin_password
  storage_class         = var.storage_class
  prometheus_storage_size = var.prometheus_storage_size
  loki_storage_size     = var.loki_storage_size
  tempo_storage_size    = var.tempo_storage_size
  retention_days        = var.metrics_retention_days
  resource_requests = {
    cpu    = var.monitoring_cpu_request
    memory = var.monitoring_memory_request
  }
  resource_limits = {
    cpu    = var.monitoring_cpu_limit
    memory = var.monitoring_memory_limit
  }

  depends_on = [kubernetes_namespace.monitoring_system]
}

#==============================================================================
# PHASE 3: MIGRATIONS (Depends on Phase 2)
#==============================================================================

#------------------------------------------------------------------------------
# Database Migrations (Control Plane & App Plane)
#------------------------------------------------------------------------------
module "migrations" {
  source = "../../modules/migrations/kubernetes"

  environment       = var.environment
  namespace         = kubernetes_namespace.database_system.metadata[0].name

  # Control Plane DB
  control_plane_db_host     = module.database.postgres_host
  control_plane_db_port     = module.database.postgres_port
  control_plane_db_name     = var.control_plane_database
  control_plane_db_user     = var.control_plane_db_user
  control_plane_db_password = var.control_plane_db_password

  # App Plane DB (Supabase)
  app_plane_db_host     = module.database.postgres_host
  app_plane_db_port     = module.database.postgres_port
  app_plane_db_name     = var.supabase_database
  app_plane_db_user     = var.supabase_db_user
  app_plane_db_password = var.supabase_db_password

  # Components-V2 DB
  components_db_host     = module.database.postgres_host
  components_db_port     = module.database.postgres_port
  components_db_name     = var.components_database
  components_db_user     = var.components_db_user
  components_db_password = var.components_db_password

  migration_image_tag = var.migration_image_tag

  depends_on = [
    module.database,
    module.supabase,
  ]
}

#==============================================================================
# PHASE 4: SERVICES (Depends on Phase 3)
#==============================================================================

#------------------------------------------------------------------------------
# Control Plane Services (LoopBack 4)
#------------------------------------------------------------------------------
module "control_plane" {
  source = "../../modules/control-plane/kubernetes"

  environment = var.environment
  namespace   = kubernetes_namespace.control_plane.metadata[0].name

  # Database Configuration
  postgres_host     = module.database.postgres_host
  postgres_port     = module.database.postgres_port
  postgres_database = var.control_plane_database
  postgres_user     = var.control_plane_db_user
  postgres_password = var.control_plane_db_password

  # Redis Configuration
  redis_host     = module.cache.redis_host
  redis_port     = module.cache.redis_port
  redis_password = var.redis_password

  # Keycloak Configuration
  keycloak_url          = module.keycloak.keycloak_url
  keycloak_realm        = var.keycloak_realm
  keycloak_client_id    = var.keycloak_client_id
  keycloak_client_secret = var.keycloak_client_secret

  # Temporal Configuration
  temporal_address   = module.temporal.temporal_address
  temporal_namespace = var.temporal_default_namespace
  temporal_task_queue = var.temporal_task_queue

  # Novu Configuration
  novu_api_url = module.novu.novu_api_url
  novu_api_key = var.novu_api_key

  # JWT Configuration
  jwt_secret      = var.jwt_secret
  jwt_issuer      = var.jwt_issuer
  jwt_expires_in  = var.jwt_expires_in

  # Service Images
  tenant_management_image = var.tenant_management_image
  orchestrator_image      = var.orchestrator_image
  subscription_image      = var.subscription_image
  temporal_worker_image   = var.temporal_worker_image

  # Replica Configuration
  tenant_management_replicas = var.tenant_management_replicas
  orchestrator_replicas      = var.orchestrator_replicas
  subscription_replicas      = var.subscription_replicas
  temporal_worker_replicas   = var.temporal_worker_replicas_cp

  # Resource Configuration
  resource_requests = {
    cpu    = var.control_plane_cpu_request
    memory = var.control_plane_memory_request
  }
  resource_limits = {
    cpu    = var.control_plane_cpu_limit
    memory = var.control_plane_memory_limit
  }

  depends_on = [
    kubernetes_namespace.control_plane,
    module.database,
    module.cache,
    module.keycloak,
    module.temporal,
    module.novu,
    module.migrations,
  ]
}

#------------------------------------------------------------------------------
# App Plane Services (FastAPI, CNS, etc.)
#------------------------------------------------------------------------------
module "app_plane_services" {
  source = "../../modules/app-plane/kubernetes"

  environment = var.environment
  namespace   = kubernetes_namespace.app_plane.metadata[0].name

  # Supabase DB Configuration
  supabase_db_host     = module.database.postgres_host
  supabase_db_port     = module.database.postgres_port
  supabase_db_name     = var.supabase_database
  supabase_db_user     = var.supabase_db_user
  supabase_db_password = var.supabase_db_password
  supabase_url         = module.supabase.supabase_url
  supabase_anon_key    = var.supabase_anon_key
  supabase_service_key = var.supabase_service_key

  # Components-V2 DB Configuration
  components_db_host     = module.database.postgres_host
  components_db_port     = module.database.postgres_port
  components_db_name     = var.components_database
  components_db_user     = var.components_db_user
  components_db_password = var.components_db_password

  # Redis Configuration
  redis_host     = module.cache.redis_host
  redis_port     = module.cache.redis_port
  redis_password = var.redis_password

  # RabbitMQ Configuration
  rabbitmq_host     = module.rabbitmq.rabbitmq_host
  rabbitmq_port     = module.rabbitmq.rabbitmq_port
  rabbitmq_user     = var.rabbitmq_user
  rabbitmq_password = var.rabbitmq_password

  # MinIO Configuration
  minio_endpoint   = module.minio.minio_endpoint
  minio_access_key = var.minio_access_key
  minio_secret_key = var.minio_secret_key

  # Keycloak Configuration
  keycloak_url          = module.keycloak.keycloak_url
  keycloak_realm        = var.keycloak_realm
  keycloak_client_id    = var.keycloak_client_id_app
  keycloak_client_secret = var.keycloak_client_secret_app

  # Service Images
  cns_service_image         = var.cns_service_image
  enrichment_service_image  = var.enrichment_service_image
  bom_service_image         = var.bom_service_image
  analytics_service_image   = var.analytics_service_image

  # Replica Configuration
  cns_service_replicas        = var.cns_service_replicas
  enrichment_service_replicas = var.enrichment_service_replicas
  bom_service_replicas        = var.bom_service_replicas
  analytics_service_replicas  = var.analytics_service_replicas

  # Resource Configuration
  resource_requests = {
    cpu    = var.app_plane_cpu_request
    memory = var.app_plane_memory_request
  }
  resource_limits = {
    cpu    = var.app_plane_cpu_limit
    memory = var.app_plane_memory_limit
  }

  depends_on = [
    kubernetes_namespace.app_plane,
    module.database,
    module.cache,
    module.rabbitmq,
    module.minio,
    module.supabase,
    module.keycloak,
    module.migrations,
  ]
}

#==============================================================================
# PHASE 5: FRONTENDS (Depends on Phase 4)
#==============================================================================

#------------------------------------------------------------------------------
# Frontend Applications (Admin, Customer Portal, etc.)
#------------------------------------------------------------------------------
module "frontends" {
  source = "../../modules/frontends/kubernetes"

  environment = var.environment

  # Admin App
  admin_app_namespace  = kubernetes_namespace.control_plane.metadata[0].name
  admin_app_image      = var.admin_app_image
  admin_app_replicas   = var.admin_app_replicas
  admin_app_api_url    = "http://${module.control_plane.tenant_management_service_host}:${module.control_plane.tenant_management_service_port}"

  # Customer Portal
  customer_portal_namespace  = kubernetes_namespace.app_plane.metadata[0].name
  customer_portal_image      = var.customer_portal_image
  customer_portal_replicas   = var.customer_portal_replicas
  customer_portal_api_url    = module.app_plane_services.cns_service_url
  customer_portal_supabase_url = module.supabase.supabase_url
  customer_portal_supabase_key = var.supabase_anon_key

  # Backstage Portal
  backstage_portal_namespace = kubernetes_namespace.app_plane.metadata[0].name
  backstage_portal_image     = var.backstage_portal_image
  backstage_portal_replicas  = var.backstage_portal_replicas

  # CNS Dashboard
  cns_dashboard_namespace = kubernetes_namespace.app_plane.metadata[0].name
  cns_dashboard_image     = var.cns_dashboard_image
  cns_dashboard_replicas  = var.cns_dashboard_replicas
  cns_dashboard_api_url   = module.app_plane_services.cns_service_url

  # Unified Dashboard
  dashboard_namespace = kubernetes_namespace.app_plane.metadata[0].name
  dashboard_image     = var.dashboard_image
  dashboard_replicas  = var.dashboard_replicas

  # Keycloak Configuration
  keycloak_url           = module.keycloak.keycloak_url
  keycloak_realm         = var.keycloak_realm
  keycloak_client_id     = var.keycloak_client_id_frontend

  # Resource Configuration
  resource_requests = {
    cpu    = var.frontend_cpu_request
    memory = var.frontend_memory_request
  }
  resource_limits = {
    cpu    = var.frontend_cpu_limit
    memory = var.frontend_memory_limit
  }

  depends_on = [
    kubernetes_namespace.control_plane,
    kubernetes_namespace.app_plane,
    module.control_plane,
    module.app_plane_services,
  ]
}

#==============================================================================
# PHASE 6: GITOPS (Depends on Phase 5)
#==============================================================================

#------------------------------------------------------------------------------
# ArgoCD (GitOps Continuous Delivery)
#------------------------------------------------------------------------------
module "argocd" {
  source = "../../modules/argocd/kubernetes"

  environment     = var.environment
  namespace       = kubernetes_namespace.argocd.metadata[0].name
  argocd_version  = var.argocd_version
  admin_password  = var.argocd_admin_password

  # Git Repository Configuration
  git_repo_url        = var.argocd_git_repo_url
  git_repo_path       = var.argocd_git_repo_path
  git_repo_branch     = var.argocd_git_repo_branch
  git_credentials_secret = var.argocd_git_credentials_secret

  # Application Configuration
  applications = {
    control-plane = {
      namespace = kubernetes_namespace.control_plane.metadata[0].name
      path      = "infrastructure/gitops/control-plane"
      auto_sync = var.argocd_auto_sync
    }
    app-plane = {
      namespace = kubernetes_namespace.app_plane.metadata[0].name
      path      = "infrastructure/gitops/app-plane"
      auto_sync = var.argocd_auto_sync
    }
    infrastructure = {
      namespace = kubernetes_namespace.database_system.metadata[0].name
      path      = "infrastructure/gitops/infrastructure"
      auto_sync = var.argocd_auto_sync
    }
  }

  # Notification Configuration
  enable_notifications    = var.argocd_enable_notifications
  notification_slack_webhook = var.argocd_slack_webhook

  # Resource Configuration
  resource_requests = {
    cpu    = var.argocd_cpu_request
    memory = var.argocd_memory_request
  }
  resource_limits = {
    cpu    = var.argocd_cpu_limit
    memory = var.argocd_memory_limit
  }

  depends_on = [
    kubernetes_namespace.argocd,
    module.control_plane,
    module.app_plane_services,
    module.frontends,
  ]
}

#==============================================================================
# OUTPUTS
#==============================================================================

output "platform_status" {
  description = "Complete platform deployment status"
  value = {
    environment = var.environment
    namespaces = {
      control_plane    = kubernetes_namespace.control_plane.metadata[0].name
      app_plane        = kubernetes_namespace.app_plane.metadata[0].name
      auth_system      = kubernetes_namespace.auth_system.metadata[0].name
      temporal_system  = kubernetes_namespace.temporal_system.metadata[0].name
      notifications    = kubernetes_namespace.notifications.metadata[0].name
      monitoring       = kubernetes_namespace.monitoring_system.metadata[0].name
      database_system  = kubernetes_namespace.database_system.metadata[0].name
      cache_system     = kubernetes_namespace.cache_system.metadata[0].name
      argocd           = kubernetes_namespace.argocd.metadata[0].name
    }
    phase_1_infrastructure = "PostgreSQL, Redis, RabbitMQ, MinIO, Vault, Keycloak, Temporal"
    phase_2_data_layer     = "Supabase, Directus, Novu, Observability"
    phase_3_migrations     = "Database migrations completed"
    phase_4_services       = "Control Plane (4 services), App Plane (4+ services)"
    phase_5_frontends      = "Admin App, Customer Portal, Backstage, CNS Dashboard, Dashboard"
    phase_6_gitops         = "ArgoCD deployed"
  }
}

output "infrastructure_endpoints" {
  description = "Infrastructure service endpoints"
  value = {
    postgres_host   = module.database.postgres_host
    postgres_port   = module.database.postgres_port
    redis_host      = module.cache.redis_host
    redis_port      = module.cache.redis_port
    rabbitmq_host   = module.rabbitmq.rabbitmq_host
    rabbitmq_mgmt   = module.rabbitmq.rabbitmq_management_url
    minio_endpoint  = module.minio.minio_endpoint
    minio_console   = module.minio.minio_console_url
    vault_url       = module.vault.vault_url
    keycloak_url    = module.keycloak.keycloak_url
    temporal_ui     = module.temporal.temporal_ui_url
  }
}

output "control_plane_endpoints" {
  description = "Control Plane service endpoints"
  value = {
    tenant_management = "http://${module.control_plane.tenant_management_service_host}:${module.control_plane.tenant_management_service_port}"
    orchestrator      = "http://${module.control_plane.orchestrator_service_host}:${module.control_plane.orchestrator_service_port}"
    subscription      = "http://${module.control_plane.subscription_service_host}:${module.control_plane.subscription_service_port}"
    admin_app         = module.frontends.admin_app_url
  }
}

output "app_plane_endpoints" {
  description = "App Plane service endpoints"
  value = {
    supabase_url      = module.supabase.supabase_url
    supabase_studio   = module.supabase.supabase_studio_url
    directus_url      = module.directus.directus_url
    cns_service       = module.app_plane_services.cns_service_url
    customer_portal   = module.frontends.customer_portal_url
    backstage_portal  = module.frontends.backstage_portal_url
    cns_dashboard     = module.frontends.cns_dashboard_url
    dashboard         = module.frontends.dashboard_url
  }
}

output "observability_endpoints" {
  description = "Monitoring and observability endpoints"
  value = {
    prometheus_url = module.observability.prometheus_url
    grafana_url    = module.observability.grafana_url
    loki_url       = module.observability.loki_url
    tempo_url      = module.observability.tempo_url
  }
}

output "gitops_endpoints" {
  description = "GitOps endpoints"
  value = {
    argocd_url    = module.argocd.argocd_url
    argocd_server = module.argocd.argocd_server_url
  }
}

output "admin_credentials" {
  description = "Admin credentials for platform services"
  sensitive   = true
  value = {
    postgres_password       = var.postgres_password
    redis_password          = var.redis_password
    rabbitmq_password       = var.rabbitmq_password
    minio_access_key        = var.minio_access_key
    minio_secret_key        = var.minio_secret_key
    vault_root_token        = var.vault_root_token
    keycloak_admin_password = var.keycloak_admin_password
    grafana_admin_password  = var.grafana_admin_password
    argocd_admin_password   = var.argocd_admin_password
    directus_admin_password = var.directus_admin_password
    supabase_jwt_secret     = var.supabase_jwt_secret
    jwt_secret              = var.jwt_secret
  }
}

output "connection_strings" {
  description = "Database connection strings"
  sensitive   = true
  value = {
    control_plane = "postgresql://${var.control_plane_db_user}:${var.control_plane_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.control_plane_database}"
    supabase      = "postgresql://${var.supabase_db_user}:${var.supabase_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.supabase_database}"
    components    = "postgresql://${var.components_db_user}:${var.components_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.components_database}"
    keycloak      = "postgresql://${var.keycloak_db_user}:${var.keycloak_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.keycloak_database}"
    temporal      = "postgresql://${var.temporal_db_user}:${var.temporal_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.temporal_database}"
    novu          = "postgresql://${var.novu_db_user}:${var.novu_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.novu_database}"
    directus      = "postgresql://${var.directus_db_user}:${var.directus_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.directus_database}"
    redis         = "redis://:${var.redis_password}@${module.cache.redis_host}:${module.cache.redis_port}/0"
  }
}

output "deployment_summary" {
  description = "Deployment summary with service counts"
  value = {
    total_services      = 47
    total_namespaces    = 9
    infrastructure      = 8  # PostgreSQL, Redis, RabbitMQ, MinIO, Vault, Keycloak, Temporal, Observability
    data_layer          = 3  # Supabase, Directus, Novu
    control_plane       = 4  # Tenant Management, Orchestrator, Subscription, Temporal Worker
    app_plane           = 4  # CNS, Enrichment, BOM, Analytics
    frontends           = 5  # Admin, Customer Portal, Backstage, CNS Dashboard, Dashboard
    gitops              = 1  # ArgoCD
    deployment_phases   = 6
    estimated_pods      = var.tenant_management_replicas + var.orchestrator_replicas + var.subscription_replicas + var.cns_service_replicas + var.enrichment_service_replicas + var.admin_app_replicas + var.customer_portal_replicas + 20  # Approximate
  }
}
