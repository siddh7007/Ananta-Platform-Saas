# =============================================================================
# Local Kubernetes Environment - Terraform Configuration
# =============================================================================
# Deploys the complete Ananta Platform to a local Kubernetes cluster
# (Rancher Desktop, Docker Desktop, Kind, Minikube, etc.)
#
# Components:
# - Vault for secrets management
# - PostgreSQL database
# - Redis cache
# - Keycloak identity provider
# - Temporal workflow engine
# - Control plane services
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.25.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.12.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = ">= 3.23.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
  }

  # For local development, use local backend
  # For production, use remote backend (S3, GCS, etc.)
  backend "local" {
    path = "terraform.tfstate"
  }
}

# -----------------------------------------------------------------------------
# Provider Configuration
# -----------------------------------------------------------------------------

provider "kubernetes" {
  # Uses ~/.kube/config by default (Rancher Desktop, etc.)
  config_path    = var.kubeconfig_path
  config_context = var.kubeconfig_context
}

provider "helm" {
  # Helm provider v3+ requires kubernetes block
  kubernetes = {
    config_path    = var.kubeconfig_path
    config_context = var.kubeconfig_context
  }
}

# Vault provider - configured after Vault is deployed
provider "vault" {
  address = var.vault_address
  token   = var.vault_token
  # Skip TLS verification for local development
  skip_tls_verify = var.environment == "local"
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  name_prefix = "ananta"
  environment = var.environment

  # Calculate project root from module path (environments/local -> project root)
  # path.module gives the directory of main.tf, go up 4 levels to reach project root
  project_root = var.project_root != "" ? var.project_root : abspath("${path.module}/../../../..")

  common_labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "app.kubernetes.io/part-of"    = "ananta-platform"
    "environment"                  = local.environment
  }

  # Namespace definitions
  namespaces = {
    vault         = "vault-system"
    database      = "database-system"
    cache         = "cache-system"
    auth          = "auth-system"
    temporal      = "temporal-system"
    control_plane = "control-plane"
    monitoring    = "monitoring-system"
  }
}

# -----------------------------------------------------------------------------
# Namespaces
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "namespaces" {
  for_each = local.namespaces

  metadata {
    name   = each.value
    labels = merge(local.common_labels, {
      "app.kubernetes.io/component" = each.key
    })
  }
}

# -----------------------------------------------------------------------------
# Module: Vault (Secrets Management)
# -----------------------------------------------------------------------------

module "vault" {
  source = "../../modules/vault/kubernetes"

  namespace    = kubernetes_namespace.namespaces["vault"].metadata[0].name
  name_prefix  = local.name_prefix
  environment  = local.environment
  labels       = local.common_labels

  # Vault configuration
  dev_mode           = var.environment == "local"
  storage_size       = "1Gi"
  storage_class      = var.storage_class

  # Initialize secrets for other services
  init_secrets = true

  depends_on = [kubernetes_namespace.namespaces]
}

# -----------------------------------------------------------------------------
# Module: PostgreSQL Database
# -----------------------------------------------------------------------------

module "database" {
  source = "../../modules/database/kubernetes"

  namespace      = kubernetes_namespace.namespaces["database"].metadata[0].name
  name_prefix    = local.name_prefix
  environment    = local.environment
  labels         = local.common_labels

  # Database configuration
  instance_size     = var.db_instance_size
  storage_gb        = var.db_storage_gb
  storage_class     = var.storage_class
  engine_version    = "15"
  database_name     = "ananta"
  app_username      = "ananta_app"
  high_availability = false  # Single node for local
  create_namespace  = false  # Already created above

  # Disable Prometheus monitoring for local (no Prometheus Operator)
  enable_monitoring        = false
  create_prometheus_rules  = false

  depends_on = [
    kubernetes_namespace.namespaces,
    module.vault
  ]
}

# -----------------------------------------------------------------------------
# Database Migrations ConfigMap
# -----------------------------------------------------------------------------
# Uses the MASTER migration files from database/migrations/ (single source of truth)
# These are comprehensive, idempotent migrations with all tables and seed data.
#
# Available MASTER migrations:
#   - 001_SUPABASE_MASTER.sql                (App Plane customer data - 82+ tables)
#   - 002_COMPONENTS_V2_MASTER.sql           (Component catalog - 57 tables)
#   - 003_ARC_SAAS_MASTER.sql                (Control Plane - 30 tables, 9 users)
#   - 005_DIRECTUS_ENRICHMENT_TABLES.sql     (Enrichment queue/history)
#   - 006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql (CNS enrichment config)
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "db_migrations" {
  metadata {
    name      = "${local.name_prefix}-db-migrations"
    namespace = kubernetes_namespace.namespaces["database"].metadata[0].name
    labels    = local.common_labels
  }

  # Use existing MASTER migration file (single comprehensive file)
  # Path: database/migrations/ (single source of truth)
  # Contents:
  #   - All schemas (main, subscription, public)
  #   - All 30 tables with indexes and constraints
  #   - Helper functions (create_tenant_schema, drop_tenant_schema)
  #   - Seed data: 3 tenants, 9 users, 4 plans, subscriptions, quotas
  data = {
    "003_ARC_SAAS_MASTER.sql"                = file("${local.project_root}/database/migrations/003_ARC_SAAS_MASTER.sql")
    "006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql" = file("${local.project_root}/database/migrations/006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql")
  }

  depends_on = [kubernetes_namespace.namespaces]
}

# -----------------------------------------------------------------------------
# App Plane Migrations ConfigMap (optional, for full platform deployment)
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "app_plane_migrations" {
  count = var.include_app_plane_migrations ? 1 : 0

  metadata {
    name      = "${local.name_prefix}-app-plane-migrations"
    namespace = kubernetes_namespace.namespaces["database"].metadata[0].name
    labels    = local.common_labels
  }

  data = {
    # Supabase database - customer data, BOMs, organizations (82+ tables)
    # Path: database/migrations/ (single source of truth)
    "001_SUPABASE_MASTER.sql" = file("${local.project_root}/database/migrations/001_SUPABASE_MASTER.sql")
    # Components-V2 database - component catalog, manufacturers, categories
    "002_COMPONENTS_V2_MASTER.sql" = file("${local.project_root}/database/migrations/002_COMPONENTS_V2_MASTER.sql")
    # Directus enrichment tables - enrichment queue, history, component_catalog updates
    "005_DIRECTUS_ENRICHMENT_TABLES.sql" = file("${local.project_root}/database/migrations/005_DIRECTUS_ENRICHMENT_TABLES.sql")
  }

  depends_on = [kubernetes_namespace.namespaces]
}

# -----------------------------------------------------------------------------
# Database Migration Job (Arc-SaaS Control Plane)
# -----------------------------------------------------------------------------
# This job runs the ARC_SAAS_MASTER.sql migration to set up the control plane
# database schema and seed data. It creates:
#   - All required schemas and tables
#   - Helper functions (create_tenant_schema, drop_tenant_schema)
#   - Seed data: tenants, users, plans, subscriptions
#   - Databases for Keycloak and Temporal
#
# Note: Uses generated passwords from random_password resources. For local
# development, passwords are deterministic based on Terraform state.
# -----------------------------------------------------------------------------

# Simple default passwords for local development
locals {
  keycloak_db_password = "keycloak123"
  temporal_db_password = "temporal123"
}

resource "kubernetes_job" "db_migration" {
  metadata {
    name      = "${local.name_prefix}-db-migration"
    namespace = kubernetes_namespace.namespaces["database"].metadata[0].name
    labels    = local.common_labels
  }

  spec {
    ttl_seconds_after_finished = 600
    backoff_limit              = 5

    template {
      metadata {
        labels = local.common_labels
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "migration"
          image = "postgres:15-alpine"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            echo "Waiting for PostgreSQL to be ready..."
            # Wait for PostgreSQL service
            MAX_RETRIES=60
            RETRY_COUNT=0
            until pg_isready -h ${module.database.host} -p ${module.database.port} -U postgres 2>/dev/null; do
              RETRY_COUNT=$((RETRY_COUNT + 1))
              if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
                echo "Timeout waiting for PostgreSQL after $MAX_RETRIES attempts"
                exit 1
              fi
              echo "Attempt $RETRY_COUNT/$MAX_RETRIES: PostgreSQL not ready, waiting 5s..."
              sleep 5
            done
            echo "PostgreSQL is ready!"

            # Create databases for other services
            echo "Creating databases for Keycloak and Temporal..."
            PGPASSWORD=$POSTGRES_PASSWORD psql -h ${module.database.host} -p ${module.database.port} -U postgres <<EOF
            -- Create keycloak database and user
            SELECT 'CREATE DATABASE keycloak' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
            DO \$\$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak') THEN
                CREATE ROLE keycloak WITH LOGIN PASSWORD '$KEYCLOAK_DB_PASSWORD';
              END IF;
            END
            \$\$;
            GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;

            -- Create temporal database and user
            SELECT 'CREATE DATABASE temporal' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal')\gexec
            DO \$\$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'temporal') THEN
                CREATE ROLE temporal WITH LOGIN PASSWORD '$TEMPORAL_DB_PASSWORD';
              END IF;
            END
            \$\$;
            GRANT ALL PRIVILEGES ON DATABASE temporal TO temporal;

            -- Create temporal_visibility database
            SELECT 'CREATE DATABASE temporal_visibility' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal_visibility')\gexec
            GRANT ALL PRIVILEGES ON DATABASE temporal_visibility TO temporal;

            -- Create arc_saas database for control plane
            SELECT 'CREATE DATABASE arc_saas' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'arc_saas')\gexec
            GRANT ALL PRIVILEGES ON DATABASE arc_saas TO ${module.database.app_username};
EOF

            echo "Databases created successfully!"

            # Run the Arc-SaaS migration on the arc_saas database
            echo "Running Arc-SaaS control plane migration..."
            PGPASSWORD=$POSTGRES_PASSWORD psql -h ${module.database.host} -p ${module.database.port} -U postgres -d arc_saas -f /migrations/003_ARC_SAAS_MASTER.sql

            echo "Migration completed successfully!"
          EOT
          ]

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = module.database.superuser_secret_name
                key  = "password"
              }
            }
          }

          # Use simple default passwords for local development
          env {
            name  = "KEYCLOAK_DB_PASSWORD"
            value = local.keycloak_db_password
          }

          env {
            name  = "TEMPORAL_DB_PASSWORD"
            value = local.temporal_db_password
          }

          volume_mount {
            name       = "migrations"
            mount_path = "/migrations"
          }
        }

        volume {
          name = "migrations"
          config_map {
            name = kubernetes_config_map.db_migrations.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [
    module.database,
    kubernetes_config_map.db_migrations
  ]
}

# -----------------------------------------------------------------------------
# Module: Redis Cache
# -----------------------------------------------------------------------------

module "cache" {
  source = "../../modules/cache/kubernetes"

  namespace     = kubernetes_namespace.namespaces["cache"].metadata[0].name
  name_prefix   = local.name_prefix
  environment   = local.environment
  labels        = local.common_labels

  # Redis configuration
  instance_size       = var.redis_instance_size
  high_availability   = false  # Standalone for local
  persistence_enabled = true
  storage_gb          = 1
  storage_class       = var.storage_class
  create_namespace    = false  # Already created above

  # Disable Prometheus monitoring for local (no Prometheus Operator)
  enable_monitoring       = false
  create_service_monitor  = false
  create_prometheus_rules = false

  depends_on = [
    kubernetes_namespace.namespaces,
    module.vault
  ]
}

# -----------------------------------------------------------------------------
# Module: Keycloak (Identity Provider)
# -----------------------------------------------------------------------------

module "keycloak" {
  source = "../../modules/keycloak/kubernetes"

  namespace    = kubernetes_namespace.namespaces["auth"].metadata[0].name
  name_prefix  = local.name_prefix
  environment  = local.environment
  labels       = local.common_labels

  # Keycloak configuration
  keycloak_image = var.keycloak_image
  dev_mode       = var.environment == "local"

  # Database connection - use centralized password
  db_host     = module.database.host
  db_port     = module.database.port
  db_name     = "keycloak"
  db_username = "keycloak"
  db_password = local.keycloak_db_password

  # Realm configuration - enabled to import realm via Terraform job
  import_realm     = true
  realm_config_map = kubernetes_config_map.keycloak_realm.metadata[0].name

  # Resources
  replicas = 1
  resources = {
    requests = { cpu = "500m", memory = "512Mi" }
    limits   = { cpu = "1000m", memory = "1Gi" }
  }

  depends_on = [
    kubernetes_namespace.namespaces,
    module.vault,
    module.database,
    kubernetes_job.db_migration  # Wait for DB and users to be created
  ]
}

# -----------------------------------------------------------------------------
# Keycloak Realm ConfigMap
# Uses centralized realm file from database/keycloak/ (single source of truth)
# Contains: 5 roles, 5 groups, 9 seed users with consistent UUIDs
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "keycloak_realm" {
  metadata {
    name      = "${local.name_prefix}-keycloak-realm"
    namespace = kubernetes_namespace.namespaces["auth"].metadata[0].name
    labels    = local.common_labels
  }

  data = {
    # Use centralized realm file - aligned with database migrations
    "ananta-saas-realm.json" = file("${local.project_root}/database/keycloak/realm-ananta-saas.json")
  }

  depends_on = [kubernetes_namespace.namespaces]
}

# -----------------------------------------------------------------------------
# Module: Temporal (Workflow Engine)
# -----------------------------------------------------------------------------

module "temporal" {
  source = "../../modules/temporal/kubernetes"

  namespace    = kubernetes_namespace.namespaces["temporal"].metadata[0].name
  name_prefix  = local.name_prefix
  environment  = local.environment
  labels       = local.common_labels

  # Temporal configuration
  temporal_version = var.temporal_version

  # Database connection - use centralized password
  db_host     = module.database.host
  db_port     = module.database.port
  db_name     = "temporal"
  db_username = "temporal"
  db_password = local.temporal_db_password

  # Namespace configuration - create arc-saas and enrichment namespaces
  create_namespaces = ["arc-saas", "enrichment", "default"]

  # UI configuration
  enable_ui = true
  ui_port   = 8080

  depends_on = [
    kubernetes_namespace.namespaces,
    module.vault,
    module.database,
    kubernetes_job.db_migration  # Wait for DB and users to be created
  ]
}

# -----------------------------------------------------------------------------
# Module: Control Plane Services
# -----------------------------------------------------------------------------

module "control_plane" {
  source = "../../modules/control-plane/kubernetes"

  namespace    = kubernetes_namespace.namespaces["control_plane"].metadata[0].name
  name_prefix  = local.name_prefix
  environment  = local.environment
  labels       = local.common_labels

  # Database configuration
  database_host     = module.database.host
  database_port     = module.database.port
  database_name     = "arc_saas"
  database_user     = module.database.app_username
  database_password = module.database.password
  database_schema   = "tenant_management"

  # Redis configuration
  redis_host     = module.cache.host
  redis_port     = module.cache.port
  redis_password = ""  # No password for local development

  # JWT configuration
  jwt_secret = "ananta-jwt-secret-change-in-production-at-least-32-characters-long"
  jwt_issuer = "ananta-platform"

  # Keycloak configuration
  keycloak_url           = module.keycloak.internal_url
  keycloak_realm         = "ananta-saas"
  keycloak_client_id     = "admin-app"
  keycloak_client_secret = "admin-app-secret-change-in-production"

  # Temporal configuration
  temporal_address    = module.temporal.grpc_address
  temporal_namespace  = "arc-saas"
  temporal_task_queue = "tenant-provisioning"

  # Novu configuration
  novu_api_key     = var.novu_secret_key
  novu_backend_url = "http://novu-api.shared-services.svc.cluster.local:3000"

  # Service images
  tenant_mgmt_image     = var.tenant_management_image
  temporal_worker_image = var.temporal_worker_image
  subscription_image    = var.subscription_image
  orchestrator_image    = var.orchestrator_image

  # Service replicas - single replica for local development
  tenant_mgmt_replicas     = 1
  temporal_worker_replicas = 1
  subscription_replicas    = 1
  orchestrator_replicas    = 1

  # Resource limits - minimal for local development
  tenant_mgmt_cpu_request     = "200m"
  tenant_mgmt_cpu_limit       = "500m"
  tenant_mgmt_memory_request  = "256Mi"
  tenant_mgmt_memory_limit    = "512Mi"

  temporal_worker_cpu_request     = "200m"
  temporal_worker_cpu_limit       = "500m"
  temporal_worker_memory_request  = "256Mi"
  temporal_worker_memory_limit    = "512Mi"

  subscription_cpu_request     = "100m"
  subscription_cpu_limit       = "250m"
  subscription_memory_request  = "128Mi"
  subscription_memory_limit    = "256Mi"

  orchestrator_cpu_request     = "100m"
  orchestrator_cpu_limit       = "250m"
  orchestrator_memory_request  = "128Mi"
  orchestrator_memory_limit    = "256Mi"

  # Application configuration
  log_level      = "info"
  enable_swagger = true
  cors_origins   = "*"

  depends_on = [
    kubernetes_namespace.namespaces,
    module.vault,
    module.database,
    module.cache,
    module.keycloak,
    module.temporal
  ]
}

# -----------------------------------------------------------------------------
# Module: App Plane
# -----------------------------------------------------------------------------
# Deploys the App Plane infrastructure:
# - Supabase PostgreSQL (tenant business data)
# - Components-V2 PostgreSQL (component catalog)
# - Redis cache
# - RabbitMQ message broker
# - MinIO S3-compatible storage
# - Supabase PostgREST API
# - Optional: CNS Service, Customer Portal
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "app_plane" {
  count = var.deploy_app_plane ? 1 : 0

  metadata {
    name = "app-plane"
    labels = merge(local.common_labels, {
      "app.kubernetes.io/component" = "app-plane"
    })
  }
}

module "app_plane" {
  count  = var.deploy_app_plane ? 1 : 0
  source = "../../modules/app-plane/kubernetes"

  namespace    = kubernetes_namespace.app_plane[0].metadata[0].name
  name_prefix  = local.name_prefix
  environment  = local.environment
  labels       = local.common_labels

  # Container images
  images = {
    supabase_db      = "supabase/postgres:15.1.0.147"
    components_db    = "postgres:15-alpine"
    redis            = "redis:7-alpine"
    rabbitmq         = "rabbitmq:3.12-management-alpine"
    minio            = "minio/minio:latest"
    supabase_api     = "postgrest/postgrest:v11.2.2"
    supabase_studio  = "supabase/studio:latest"
    supabase_meta    = "supabase/postgres-meta:v0.74.0"
    cns_service      = var.cns_service_image
    cns_dashboard    = var.cns_dashboard_image
    customer_portal  = var.customer_portal_image
    # Novu services
    novu_api         = "ghcr.io/novuhq/novu/api:latest"
    novu_worker      = "ghcr.io/novuhq/novu/worker:latest"
    novu_web         = "ghcr.io/novuhq/novu/web:latest"
    novu_ws          = "ghcr.io/novuhq/novu/ws:latest"
    mongodb          = "mongo:6"
    # Observability
    jaeger           = "jaegertracing/all-in-one:1.51"
    prometheus       = "prom/prometheus:v2.47.0"
    grafana          = "grafana/grafana:10.2.0"
  }

  # Storage configuration
  storage_class = var.storage_class

  # Dependencies
  temporal_address      = module.temporal.grpc_address
  keycloak_url          = module.keycloak.internal_url
  control_plane_api_url = "http://tenant-management-service.${kubernetes_namespace.namespaces["control_plane"].metadata[0].name}:14000"

  # Service deployment flags
  deploy_cns_service     = var.deploy_cns_service
  deploy_customer_portal = var.deploy_customer_portal
  deploy_supabase_studio = var.deploy_supabase_studio
  deploy_cns_dashboard   = var.deploy_cns_dashboard
  deploy_novu            = var.deploy_novu
  deploy_observability   = var.deploy_observability

  # Helm chart versions
  redis_chart_version    = var.redis_chart_version
  rabbitmq_chart_version = var.rabbitmq_chart_version

  # CNS Service Vendor API Keys
  cns_jwt_secret        = var.cns_jwt_secret
  mouser_api_key        = var.mouser_api_key
  digikey_client_id     = var.digikey_client_id
  digikey_client_secret = var.digikey_client_secret
  element14_api_key     = var.element14_api_key
  arrow_api_key         = var.arrow_api_key

  # Novu configuration
  novu_jwt_secret     = var.novu_jwt_secret
  novu_encryption_key = var.novu_encryption_key
  novu_secret_key     = var.novu_secret_key

  # Observability configuration
  grafana_admin_password = var.grafana_admin_password

  # CNS Dashboard Keycloak configuration
  # Note: These are passed to Terraform for documentation - actual config is baked
  # into the dashboard at build time via .env.production (Vite build-time env vars)
  cns_dashboard_keycloak_url       = var.cns_dashboard_keycloak_url
  cns_dashboard_keycloak_realm     = var.cns_dashboard_keycloak_realm
  cns_dashboard_keycloak_client_id = var.cns_dashboard_keycloak_client_id
  cns_dashboard_auth_provider      = var.cns_dashboard_auth_provider

  # Migrations
  run_migrations        = var.include_app_plane_migrations
  migrations_config_map = var.include_app_plane_migrations ? kubernetes_config_map.app_plane_migrations[0].metadata[0].name : ""

  depends_on = [
    kubernetes_namespace.app_plane,
    module.vault,
    module.database,
    module.cache,
    module.temporal
  ]
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "vault_address" {
  description = "Vault server address"
  value       = module.vault.address
}

output "database_host" {
  description = "PostgreSQL host"
  value       = module.database.host
}

output "keycloak_url" {
  description = "Keycloak URL"
  value       = module.keycloak.external_url
}

output "temporal_ui_url" {
  description = "Temporal UI URL"
  value       = module.temporal.ui_url
}

output "admin_app_url" {
  description = "Admin App URL (use port-forward on port 27555)"
  value       = "http://localhost:27555"
}

output "api_url" {
  description = "Tenant Management API URL"
  value       = "http://${module.control_plane.tenant_management_endpoint}"
}

# App Plane outputs
output "app_plane_supabase_db_host" {
  description = "Supabase PostgreSQL host (App Plane)"
  value       = var.deploy_app_plane ? module.app_plane[0].supabase_db_host : ""
}

output "app_plane_components_db_host" {
  description = "Components-V2 PostgreSQL host (App Plane)"
  value       = var.deploy_app_plane ? module.app_plane[0].components_db_host : ""
}

output "app_plane_supabase_api_url" {
  description = "Supabase PostgREST API URL (App Plane)"
  value       = var.deploy_app_plane ? module.app_plane[0].supabase_api_url : ""
}

output "app_plane_minio_endpoint" {
  description = "MinIO S3 endpoint (App Plane)"
  value       = var.deploy_app_plane ? module.app_plane[0].minio_endpoint : ""
}
