#
# Ananta Platform SaaS - Complete Outputs
# All service endpoints and credentials
#

#==============================================================================
# PLATFORM STATUS & SUMMARY
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

output "deployment_summary" {
  description = "Deployment summary with service counts"
  value = {
    total_services      = 47
    total_namespaces    = 9
    infrastructure      = 8
    data_layer          = 3
    control_plane       = 4
    app_plane           = 4
    frontends           = 5
    gitops              = 1
    deployment_phases   = 6
    estimated_pods      = var.tenant_management_replicas + var.orchestrator_replicas + var.subscription_replicas + var.cns_service_replicas + var.enrichment_service_replicas + var.admin_app_replicas + var.customer_portal_replicas + 20
  }
}

#==============================================================================
# INFRASTRUCTURE ENDPOINTS
#==============================================================================

output "infrastructure_endpoints" {
  description = "Infrastructure service endpoints"
  value = {
    postgres_host   = module.database.postgres_host
    postgres_port   = module.database.postgres_port
    redis_host      = module.cache.redis_host
    redis_port      = module.cache.redis_port
    rabbitmq_host   = module.rabbitmq.rabbitmq_host
    rabbitmq_port   = module.rabbitmq.rabbitmq_port
    rabbitmq_mgmt   = module.rabbitmq.rabbitmq_management_url
    minio_endpoint  = module.minio.minio_endpoint
    minio_console   = module.minio.minio_console_url
    vault_url       = module.vault.vault_url
    keycloak_url    = module.keycloak.keycloak_url
    temporal_grpc   = module.temporal.temporal_address
    temporal_ui     = module.temporal.temporal_ui_url
  }
}

output "postgres_connection" {
  description = "PostgreSQL connection details"
  value = {
    host              = module.database.postgres_host
    port              = module.database.postgres_port
    admin_user        = "postgres"
    replica_count     = var.postgres_replica_count
    replication_enabled = var.postgres_enable_replication
    backup_enabled    = var.postgres_enable_backup
  }
}

output "redis_connection" {
  description = "Redis connection details"
  value = {
    host              = module.cache.redis_host
    port              = module.cache.redis_port
    sentinel_enabled  = var.redis_enable_sentinel
    replica_count     = var.redis_replica_count
    max_memory        = var.redis_max_memory
  }
}

output "rabbitmq_connection" {
  description = "RabbitMQ connection details"
  value = {
    host              = module.rabbitmq.rabbitmq_host
    port              = module.rabbitmq.rabbitmq_port
    management_port   = 15672
    management_url    = module.rabbitmq.rabbitmq_management_url
    username          = var.rabbitmq_user
    replica_count     = var.rabbitmq_replica_count
  }
}

output "minio_connection" {
  description = "MinIO connection details"
  value = {
    endpoint          = module.minio.minio_endpoint
    console_url       = module.minio.minio_console_url
    access_key_id     = var.minio_access_key
    default_buckets   = var.minio_default_buckets
    replica_count     = var.minio_replica_count
  }
  sensitive = true
}

output "vault_connection" {
  description = "Vault connection details"
  value = {
    url               = module.vault.vault_url
    ui_enabled        = var.vault_enable_ui
    raft_enabled      = var.vault_enable_raft
    replica_count     = var.vault_replica_count
  }
}

output "keycloak_connection" {
  description = "Keycloak connection details"
  value = {
    url               = module.keycloak.keycloak_url
    admin_console     = "${module.keycloak.keycloak_url}/admin"
    realm             = var.keycloak_realm
    admin_user        = var.keycloak_admin_user
    replica_count     = var.keycloak_replica_count
    clients = {
      control_plane = var.keycloak_client_id
      app_plane     = var.keycloak_client_id_app
      frontend      = var.keycloak_client_id_frontend
    }
  }
}

output "temporal_connection" {
  description = "Temporal connection details"
  value = {
    address           = module.temporal.temporal_address
    ui_url            = module.temporal.temporal_ui_url
    web_url           = module.temporal.temporal_web_url
    default_namespace = var.temporal_default_namespace
    additional_namespaces = var.temporal_additional_namespaces
    task_queue        = var.temporal_task_queue
    replicas = {
      frontend = var.temporal_frontend_replicas
      history  = var.temporal_history_replicas
      matching = var.temporal_matching_replicas
      worker   = var.temporal_worker_replicas
    }
  }
}

#==============================================================================
# DATA LAYER ENDPOINTS
#==============================================================================

output "data_layer_endpoints" {
  description = "Data layer service endpoints"
  value = {
    supabase_url      = module.supabase.supabase_url
    supabase_studio   = module.supabase.supabase_studio_url
    directus_url      = module.directus.directus_url
    novu_api          = module.novu.novu_api_url
    novu_web          = module.novu.novu_web_url
    novu_ws           = module.novu.novu_ws_url
  }
}

output "supabase_connection" {
  description = "Supabase connection details"
  value = {
    url               = module.supabase.supabase_url
    studio_url        = module.supabase.supabase_studio_url
    database_host     = module.database.postgres_host
    database_name     = var.supabase_database
    database_user     = var.supabase_db_user
    storage_enabled   = var.supabase_enable_storage
  }
}

output "supabase_keys" {
  description = "Supabase API keys"
  sensitive   = true
  value = {
    anon_key          = var.supabase_anon_key
    service_key       = var.supabase_service_key
    jwt_secret        = var.supabase_jwt_secret
  }
}

output "directus_connection" {
  description = "Directus connection details"
  value = {
    url               = module.directus.directus_url
    admin_email       = var.directus_admin_email
    database_name     = var.directus_database
    storage_backend   = "minio"
    replica_count     = var.directus_replica_count
  }
}

output "novu_connection" {
  description = "Novu connection details"
  value = {
    api_url           = module.novu.novu_api_url
    web_url           = module.novu.novu_web_url
    ws_url            = module.novu.novu_ws_url
    replicas = {
      api    = var.novu_api_replicas
      worker = var.novu_worker_replicas
      ws     = var.novu_ws_replicas
    }
  }
}

#==============================================================================
# CONTROL PLANE ENDPOINTS
#==============================================================================

output "control_plane_endpoints" {
  description = "Control Plane service endpoints"
  value = {
    tenant_management = "http://${module.control_plane.tenant_management_service_host}:${module.control_plane.tenant_management_service_port}"
    orchestrator      = "http://${module.control_plane.orchestrator_service_host}:${module.control_plane.orchestrator_service_port}"
    subscription      = "http://${module.control_plane.subscription_service_host}:${module.control_plane.subscription_service_port}"
    admin_app         = module.frontends.admin_app_url
  }
}

output "control_plane_services" {
  description = "Control Plane service details"
  value = {
    tenant_management = {
      host          = module.control_plane.tenant_management_service_host
      port          = module.control_plane.tenant_management_service_port
      replicas      = var.tenant_management_replicas
      image         = var.tenant_management_image
    }
    orchestrator = {
      host          = module.control_plane.orchestrator_service_host
      port          = module.control_plane.orchestrator_service_port
      replicas      = var.orchestrator_replicas
      image         = var.orchestrator_image
    }
    subscription = {
      host          = module.control_plane.subscription_service_host
      port          = module.control_plane.subscription_service_port
      replicas      = var.subscription_replicas
      image         = var.subscription_image
    }
    temporal_worker = {
      replicas      = var.temporal_worker_replicas_cp
      image         = var.temporal_worker_image
      task_queue    = var.temporal_task_queue
    }
  }
}

#==============================================================================
# APP PLANE ENDPOINTS
#==============================================================================

output "app_plane_endpoints" {
  description = "App Plane service endpoints"
  value = {
    cns_service       = module.app_plane_services.cns_service_url
    enrichment_service = module.app_plane_services.enrichment_service_url
    bom_service       = module.app_plane_services.bom_service_url
    analytics_service = module.app_plane_services.analytics_service_url
    customer_portal   = module.frontends.customer_portal_url
    backstage_portal  = module.frontends.backstage_portal_url
    cns_dashboard     = module.frontends.cns_dashboard_url
    dashboard         = module.frontends.dashboard_url
  }
}

output "app_plane_services" {
  description = "App Plane service details"
  value = {
    cns_service = {
      url           = module.app_plane_services.cns_service_url
      replicas      = var.cns_service_replicas
      image         = var.cns_service_image
    }
    enrichment_service = {
      url           = module.app_plane_services.enrichment_service_url
      replicas      = var.enrichment_service_replicas
      image         = var.enrichment_service_image
    }
    bom_service = {
      url           = module.app_plane_services.bom_service_url
      replicas      = var.bom_service_replicas
      image         = var.bom_service_image
    }
    analytics_service = {
      url           = module.app_plane_services.analytics_service_url
      replicas      = var.analytics_service_replicas
      image         = var.analytics_service_image
    }
  }
}

#==============================================================================
# FRONTEND ENDPOINTS
#==============================================================================

output "frontend_endpoints" {
  description = "Frontend application endpoints"
  value = {
    admin_app         = module.frontends.admin_app_url
    customer_portal   = module.frontends.customer_portal_url
    backstage_portal  = module.frontends.backstage_portal_url
    cns_dashboard     = module.frontends.cns_dashboard_url
    dashboard         = module.frontends.dashboard_url
  }
}

output "frontend_applications" {
  description = "Frontend application details"
  value = {
    admin_app = {
      url           = module.frontends.admin_app_url
      replicas      = var.admin_app_replicas
      image         = var.admin_app_image
      api_url       = "http://${module.control_plane.tenant_management_service_host}:${module.control_plane.tenant_management_service_port}"
    }
    customer_portal = {
      url           = module.frontends.customer_portal_url
      replicas      = var.customer_portal_replicas
      image         = var.customer_portal_image
      cns_api       = module.app_plane_services.cns_service_url
      supabase_url  = module.supabase.supabase_url
    }
    backstage_portal = {
      url           = module.frontends.backstage_portal_url
      replicas      = var.backstage_portal_replicas
      image         = var.backstage_portal_image
    }
    cns_dashboard = {
      url           = module.frontends.cns_dashboard_url
      replicas      = var.cns_dashboard_replicas
      image         = var.cns_dashboard_image
      api_url       = module.app_plane_services.cns_service_url
    }
    dashboard = {
      url           = module.frontends.dashboard_url
      replicas      = var.dashboard_replicas
      image         = var.dashboard_image
    }
  }
}

#==============================================================================
# OBSERVABILITY ENDPOINTS
#==============================================================================

output "observability_endpoints" {
  description = "Monitoring and observability endpoints"
  value = {
    prometheus_url = module.observability.prometheus_url
    grafana_url    = module.observability.grafana_url
    loki_url       = module.observability.loki_url
    tempo_url      = module.observability.tempo_url
  }
}

output "observability_details" {
  description = "Observability stack details"
  value = {
    prometheus = {
      enabled       = var.enable_prometheus
      url           = module.observability.prometheus_url
      storage_size  = var.prometheus_storage_size
      retention_days = var.metrics_retention_days
    }
    grafana = {
      enabled       = var.enable_grafana
      url           = module.observability.grafana_url
      admin_user    = var.grafana_admin_user
    }
    loki = {
      enabled       = var.enable_loki
      url           = module.observability.loki_url
      storage_size  = var.loki_storage_size
    }
    tempo = {
      enabled       = var.enable_tempo
      url           = module.observability.tempo_url
      storage_size  = var.tempo_storage_size
    }
  }
}

#==============================================================================
# GITOPS ENDPOINTS
#==============================================================================

output "gitops_endpoints" {
  description = "GitOps endpoints"
  value = {
    argocd_url    = module.argocd.argocd_url
    argocd_server = module.argocd.argocd_server_url
  }
}

output "argocd_details" {
  description = "ArgoCD configuration details"
  value = {
    url               = module.argocd.argocd_url
    server_url        = module.argocd.argocd_server_url
    admin_user        = "admin"
    git_repo_url      = var.argocd_git_repo_url
    git_repo_branch   = var.argocd_git_repo_branch
    auto_sync_enabled = var.argocd_auto_sync
    notifications     = var.argocd_enable_notifications
    applications = {
      control_plane = {
        namespace = kubernetes_namespace.control_plane.metadata[0].name
        path      = "infrastructure/gitops/control-plane"
      }
      app_plane = {
        namespace = kubernetes_namespace.app_plane.metadata[0].name
        path      = "infrastructure/gitops/app-plane"
      }
      infrastructure = {
        namespace = kubernetes_namespace.database_system.metadata[0].name
        path      = "infrastructure/gitops/infrastructure"
      }
    }
  }
}

#==============================================================================
# ADMIN CREDENTIALS (Sensitive)
#==============================================================================

output "admin_credentials" {
  description = "Admin credentials for platform services (SENSITIVE)"
  sensitive   = true
  value = {
    postgres = {
      password = var.postgres_password
    }
    redis = {
      password = var.redis_password
    }
    rabbitmq = {
      username = var.rabbitmq_user
      password = var.rabbitmq_password
    }
    minio = {
      access_key = var.minio_access_key
      secret_key = var.minio_secret_key
    }
    vault = {
      root_token = var.vault_root_token
    }
    keycloak = {
      admin_user     = var.keycloak_admin_user
      admin_password = var.keycloak_admin_password
      realm          = var.keycloak_realm
      client_secrets = {
        control_plane = var.keycloak_client_secret
        app_plane     = var.keycloak_client_secret_app
      }
    }
    directus = {
      admin_email    = var.directus_admin_email
      admin_password = var.directus_admin_password
      secret_key     = var.directus_secret_key
    }
    grafana = {
      admin_user     = var.grafana_admin_user
      admin_password = var.grafana_admin_password
    }
    argocd = {
      admin_user     = "admin"
      admin_password = var.argocd_admin_password
    }
  }
}

#==============================================================================
# CONNECTION STRINGS (Sensitive)
#==============================================================================

output "connection_strings" {
  description = "Database and service connection strings (SENSITIVE)"
  sensitive   = true
  value = {
    databases = {
      control_plane = "postgresql://${var.control_plane_db_user}:${var.control_plane_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.control_plane_database}"
      supabase      = "postgresql://${var.supabase_db_user}:${var.supabase_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.supabase_database}"
      components    = "postgresql://${var.components_db_user}:${var.components_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.components_database}"
      keycloak      = "postgresql://${var.keycloak_db_user}:${var.keycloak_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.keycloak_database}"
      temporal      = "postgresql://${var.temporal_db_user}:${var.temporal_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.temporal_database}"
      novu          = "postgresql://${var.novu_db_user}:${var.novu_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.novu_database}"
      directus      = "postgresql://${var.directus_db_user}:${var.directus_db_password}@${module.database.postgres_host}:${module.database.postgres_port}/${var.directus_database}"
    }
    redis = "redis://:${var.redis_password}@${module.cache.redis_host}:${module.cache.redis_port}/0"
    rabbitmq = "amqp://${var.rabbitmq_user}:${var.rabbitmq_password}@${module.rabbitmq.rabbitmq_host}:${module.rabbitmq.rabbitmq_port}/"
    temporal = module.temporal.temporal_address
  }
}

output "jwt_secrets" {
  description = "JWT and API secrets (SENSITIVE)"
  sensitive   = true
  value = {
    jwt_secret          = var.jwt_secret
    supabase_jwt_secret = var.supabase_jwt_secret
    novu_jwt_secret     = var.novu_jwt_secret
    novu_api_key        = var.novu_api_key
    supabase_anon_key   = var.supabase_anon_key
    supabase_service_key = var.supabase_service_key
  }
}

#==============================================================================
# QUICK ACCESS URLS
#==============================================================================

output "quick_access_urls" {
  description = "Quick access URLs for common services"
  value = {
    description = "Commonly accessed service endpoints"
    admin_app = {
      url         = module.frontends.admin_app_url
      description = "Admin Portal - Tenant & subscription management"
    }
    customer_portal = {
      url         = module.frontends.customer_portal_url
      description = "Customer Portal - End-user BOM management"
    }
    keycloak_admin = {
      url         = "${module.keycloak.keycloak_url}/admin"
      description = "Keycloak Admin Console - Identity management"
    }
    temporal_ui = {
      url         = module.temporal.temporal_ui_url
      description = "Temporal UI - Workflow monitoring"
    }
    grafana = {
      url         = module.observability.grafana_url
      description = "Grafana - Metrics & dashboards"
    }
    argocd = {
      url         = module.argocd.argocd_url
      description = "ArgoCD - GitOps deployments"
    }
    minio_console = {
      url         = module.minio.minio_console_url
      description = "MinIO Console - Object storage management"
    }
    supabase_studio = {
      url         = module.supabase.supabase_studio_url
      description = "Supabase Studio - Database admin"
    }
    directus = {
      url         = module.directus.directus_url
      description = "Directus - Content management"
    }
    novu_web = {
      url         = module.novu.novu_web_url
      description = "Novu - Notification management"
    }
  }
}

#==============================================================================
# DEPLOYMENT VERIFICATION
#==============================================================================

output "deployment_verification" {
  description = "Commands to verify deployment"
  value = {
    check_pods = "kubectl get pods --all-namespaces"
    check_services = "kubectl get services --all-namespaces"
    check_ingresses = "kubectl get ingresses --all-namespaces"
    check_pvcs = "kubectl get pvc --all-namespaces"
    argocd_login = "argocd login ${module.argocd.argocd_server_url} --username admin --password <admin_password>"
    argocd_apps = "argocd app list"
    temporal_workflows = "temporal workflow list --namespace ${var.temporal_default_namespace}"
  }
}

output "next_steps" {
  description = "Post-deployment next steps"
  value = {
    step_1 = "Access ArgoCD: ${module.argocd.argocd_url} (admin / <argocd_admin_password>)"
    step_2 = "Configure Keycloak realm: ${module.keycloak.keycloak_url}/admin (admin / <keycloak_admin_password>)"
    step_3 = "Import realm configuration from infrastructure/keycloak/realm-ananta.json"
    step_4 = "Access Admin App: ${module.frontends.admin_app_url}"
    step_5 = "Access Customer Portal: ${module.frontends.customer_portal_url}"
    step_6 = "Monitor with Grafana: ${module.observability.grafana_url} (admin / <grafana_admin_password>)"
    step_7 = "Check Temporal workflows: ${module.temporal.temporal_ui_url}"
    step_8 = "Review logs: kubectl logs -f -n <namespace> <pod-name>"
  }
}
