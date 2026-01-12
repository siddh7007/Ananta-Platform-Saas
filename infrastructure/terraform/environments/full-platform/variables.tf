#
# Ananta Platform SaaS - Complete Variables Configuration
# All 47 services across 9 namespaces
#

#==============================================================================
# ENVIRONMENT & CLUSTER
#==============================================================================

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "kubernetes_context" {
  description = "Kubernetes context to use for deployment"
  type        = string
  default     = "docker-desktop"
}

variable "kubernetes_config_path" {
  description = "Path to kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "storage_class" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "standard"
}

#==============================================================================
# NETWORK CONFIGURATION
#==============================================================================

variable "enable_network_policies" {
  description = "Enable Kubernetes network policies for security"
  type        = bool
  default     = true
}

variable "enable_ingress" {
  description = "Enable ingress controller"
  type        = bool
  default     = true
}

variable "ingress_class" {
  description = "Ingress class to use (nginx, traefik, etc.)"
  type        = string
  default     = "nginx"
}

variable "domain_name" {
  description = "Base domain name for ingress rules"
  type        = string
  default     = "ananta-platform.local"
}

variable "enable_tls" {
  description = "Enable TLS for ingress"
  type        = bool
  default     = true
}

variable "tls_secret_name" {
  description = "Name of the TLS secret for ingress"
  type        = string
  default     = "ananta-platform-tls"
}

#==============================================================================
# DATABASE (PostgreSQL)
#==============================================================================

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15.4.0"
}

variable "postgres_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "postgres_storage_size" {
  description = "PostgreSQL storage size"
  type        = string
  default     = "20Gi"
}

variable "postgres_enable_replication" {
  description = "Enable PostgreSQL replication"
  type        = bool
  default     = true
}

variable "postgres_replica_count" {
  description = "Number of PostgreSQL replicas"
  type        = number
  default     = 2
}

variable "postgres_enable_backup" {
  description = "Enable PostgreSQL backups"
  type        = bool
  default     = true
}

variable "postgres_backup_schedule" {
  description = "Cron schedule for PostgreSQL backups"
  type        = string
  default     = "0 2 * * *"  # Daily at 2 AM
}

variable "postgres_cpu_request" {
  description = "PostgreSQL CPU request"
  type        = string
  default     = "500m"
}

variable "postgres_memory_request" {
  description = "PostgreSQL memory request"
  type        = string
  default     = "1Gi"
}

variable "postgres_cpu_limit" {
  description = "PostgreSQL CPU limit"
  type        = string
  default     = "2"
}

variable "postgres_memory_limit" {
  description = "PostgreSQL memory limit"
  type        = string
  default     = "4Gi"
}

#------------------------------------------------------------------------------
# Database Names & Users
#------------------------------------------------------------------------------

variable "control_plane_database" {
  description = "Control Plane database name"
  type        = string
  default     = "arc_saas"
}

variable "control_plane_db_user" {
  description = "Control Plane database user"
  type        = string
  default     = "arc_saas_user"
}

variable "control_plane_db_password" {
  description = "Control Plane database password"
  type        = string
  sensitive   = true
}

variable "supabase_database" {
  description = "Supabase database name"
  type        = string
  default     = "postgres"
}

variable "supabase_db_user" {
  description = "Supabase database user"
  type        = string
  default     = "postgres"
}

variable "supabase_db_password" {
  description = "Supabase database password"
  type        = string
  sensitive   = true
}

variable "components_database" {
  description = "Components V2 database name"
  type        = string
  default     = "components_v2"
}

variable "components_db_user" {
  description = "Components V2 database user"
  type        = string
  default     = "components_user"
}

variable "components_db_password" {
  description = "Components V2 database password"
  type        = string
  sensitive   = true
}

variable "keycloak_database" {
  description = "Keycloak database name"
  type        = string
  default     = "keycloak"
}

variable "keycloak_db_user" {
  description = "Keycloak database user"
  type        = string
  default     = "keycloak_user"
}

variable "keycloak_db_password" {
  description = "Keycloak database password"
  type        = string
  sensitive   = true
}

variable "temporal_database" {
  description = "Temporal database name"
  type        = string
  default     = "temporal"
}

variable "temporal_db_user" {
  description = "Temporal database user"
  type        = string
  default     = "temporal_user"
}

variable "temporal_db_password" {
  description = "Temporal database password"
  type        = string
  sensitive   = true
}

variable "novu_database" {
  description = "Novu database name"
  type        = string
  default     = "novu"
}

variable "novu_db_user" {
  description = "Novu database user"
  type        = string
  default     = "novu_user"
}

variable "novu_db_password" {
  description = "Novu database password"
  type        = string
  sensitive   = true
}

variable "directus_database" {
  description = "Directus database name"
  type        = string
  default     = "directus"
}

variable "directus_db_user" {
  description = "Directus database user"
  type        = string
  default     = "directus_user"
}

variable "directus_db_password" {
  description = "Directus database password"
  type        = string
  sensitive   = true
}

#==============================================================================
# CACHE (Redis)
#==============================================================================

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7.2.0"
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
}

variable "redis_storage_size" {
  description = "Redis storage size"
  type        = string
  default     = "5Gi"
}

variable "redis_enable_sentinel" {
  description = "Enable Redis Sentinel for HA"
  type        = bool
  default     = true
}

variable "redis_replica_count" {
  description = "Number of Redis replicas"
  type        = number
  default     = 3
}

variable "redis_max_memory" {
  description = "Redis max memory"
  type        = string
  default     = "2gb"
}

variable "redis_max_memory_policy" {
  description = "Redis eviction policy"
  type        = string
  default     = "allkeys-lru"
}

variable "redis_cpu_request" {
  description = "Redis CPU request"
  type        = string
  default     = "100m"
}

variable "redis_memory_request" {
  description = "Redis memory request"
  type        = string
  default     = "256Mi"
}

variable "redis_cpu_limit" {
  description = "Redis CPU limit"
  type        = string
  default     = "500m"
}

variable "redis_memory_limit" {
  description = "Redis memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# RABBITMQ
#==============================================================================

variable "rabbitmq_version" {
  description = "RabbitMQ version"
  type        = string
  default     = "3.12.0"
}

variable "rabbitmq_user" {
  description = "RabbitMQ username"
  type        = string
  default     = "rabbitmq"
}

variable "rabbitmq_password" {
  description = "RabbitMQ password"
  type        = string
  sensitive   = true
}

variable "rabbitmq_storage_size" {
  description = "RabbitMQ storage size"
  type        = string
  default     = "5Gi"
}

variable "rabbitmq_replica_count" {
  description = "Number of RabbitMQ replicas"
  type        = number
  default     = 3
}

variable "rabbitmq_enable_metrics" {
  description = "Enable RabbitMQ metrics"
  type        = bool
  default     = true
}

variable "rabbitmq_cpu_request" {
  description = "RabbitMQ CPU request"
  type        = string
  default     = "200m"
}

variable "rabbitmq_memory_request" {
  description = "RabbitMQ memory request"
  type        = string
  default     = "512Mi"
}

variable "rabbitmq_cpu_limit" {
  description = "RabbitMQ CPU limit"
  type        = string
  default     = "1"
}

variable "rabbitmq_memory_limit" {
  description = "RabbitMQ memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# MINIO
#==============================================================================

variable "minio_version" {
  description = "MinIO version"
  type        = string
  default     = "RELEASE.2024-01-01T00-00-00Z"
}

variable "minio_access_key" {
  description = "MinIO access key"
  type        = string
  sensitive   = true
}

variable "minio_secret_key" {
  description = "MinIO secret key"
  type        = string
  sensitive   = true
}

variable "minio_storage_size" {
  description = "MinIO storage size per server"
  type        = string
  default     = "10Gi"
}

variable "minio_replica_count" {
  description = "Number of MinIO servers"
  type        = number
  default     = 4
}

variable "minio_enable_console" {
  description = "Enable MinIO console"
  type        = bool
  default     = true
}

variable "minio_default_buckets" {
  description = "Default buckets to create"
  type        = list(string)
  default     = ["directus", "supabase-storage", "backups", "uploads"]
}

variable "minio_cpu_request" {
  description = "MinIO CPU request"
  type        = string
  default     = "200m"
}

variable "minio_memory_request" {
  description = "MinIO memory request"
  type        = string
  default     = "512Mi"
}

variable "minio_cpu_limit" {
  description = "MinIO CPU limit"
  type        = string
  default     = "1"
}

variable "minio_memory_limit" {
  description = "MinIO memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# VAULT
#==============================================================================

variable "vault_version" {
  description = "HashiCorp Vault version"
  type        = string
  default     = "1.15.0"
}

variable "vault_storage_size" {
  description = "Vault storage size"
  type        = string
  default     = "5Gi"
}

variable "vault_replica_count" {
  description = "Number of Vault replicas"
  type        = number
  default     = 3
}

variable "vault_enable_ui" {
  description = "Enable Vault UI"
  type        = bool
  default     = true
}

variable "vault_enable_raft" {
  description = "Enable Raft storage backend"
  type        = bool
  default     = true
}

variable "vault_unseal_keys" {
  description = "Vault unseal keys (for auto-unseal)"
  type        = list(string)
  sensitive   = true
  default     = []
}

variable "vault_root_token" {
  description = "Vault root token"
  type        = string
  sensitive   = true
}

variable "vault_cpu_request" {
  description = "Vault CPU request"
  type        = string
  default     = "200m"
}

variable "vault_memory_request" {
  description = "Vault memory request"
  type        = string
  default     = "256Mi"
}

variable "vault_cpu_limit" {
  description = "Vault CPU limit"
  type        = string
  default     = "1"
}

variable "vault_memory_limit" {
  description = "Vault memory limit"
  type        = string
  default     = "1Gi"
}

#==============================================================================
# KEYCLOAK
#==============================================================================

variable "keycloak_version" {
  description = "Keycloak version"
  type        = string
  default     = "22.0.0"
}

variable "keycloak_admin_user" {
  description = "Keycloak admin username"
  type        = string
  default     = "admin"
}

variable "keycloak_admin_password" {
  description = "Keycloak admin password"
  type        = string
  sensitive   = true
}

variable "keycloak_realm" {
  description = "Keycloak realm name"
  type        = string
  default     = "ananta"
}

variable "keycloak_client_id" {
  description = "Keycloak client ID for Control Plane"
  type        = string
  default     = "ananta-control-plane"
}

variable "keycloak_client_secret" {
  description = "Keycloak client secret for Control Plane"
  type        = string
  sensitive   = true
}

variable "keycloak_client_id_app" {
  description = "Keycloak client ID for App Plane"
  type        = string
  default     = "ananta-app-plane"
}

variable "keycloak_client_secret_app" {
  description = "Keycloak client secret for App Plane"
  type        = string
  sensitive   = true
}

variable "keycloak_client_id_frontend" {
  description = "Keycloak client ID for frontend apps"
  type        = string
  default     = "ananta-frontend"
}

variable "keycloak_replica_count" {
  description = "Number of Keycloak replicas"
  type        = number
  default     = 2
}

variable "keycloak_enable_metrics" {
  description = "Enable Keycloak metrics"
  type        = bool
  default     = true
}

variable "keycloak_themes" {
  description = "Custom Keycloak themes to install"
  type        = list(string)
  default     = []
}

variable "keycloak_cpu_request" {
  description = "Keycloak CPU request"
  type        = string
  default     = "500m"
}

variable "keycloak_memory_request" {
  description = "Keycloak memory request"
  type        = string
  default     = "1Gi"
}

variable "keycloak_cpu_limit" {
  description = "Keycloak CPU limit"
  type        = string
  default     = "2"
}

variable "keycloak_memory_limit" {
  description = "Keycloak memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# TEMPORAL
#==============================================================================

variable "temporal_version" {
  description = "Temporal version"
  type        = string
  default     = "1.22.0"
}

variable "temporal_default_namespace" {
  description = "Temporal default namespace"
  type        = string
  default     = "arc-saas"
}

variable "temporal_additional_namespaces" {
  description = "Additional Temporal namespaces to create"
  type        = list(string)
  default     = ["enrichment", "workflows"]
}

variable "temporal_task_queue" {
  description = "Temporal task queue for Control Plane"
  type        = string
  default     = "tenant-provisioning"
}

variable "temporal_enable_ui" {
  description = "Enable Temporal UI"
  type        = bool
  default     = true
}

variable "temporal_enable_web" {
  description = "Enable Temporal Web"
  type        = bool
  default     = true
}

variable "temporal_frontend_replicas" {
  description = "Number of Temporal frontend replicas"
  type        = number
  default     = 2
}

variable "temporal_history_replicas" {
  description = "Number of Temporal history replicas"
  type        = number
  default     = 3
}

variable "temporal_matching_replicas" {
  description = "Number of Temporal matching replicas"
  type        = number
  default     = 3
}

variable "temporal_worker_replicas" {
  description = "Number of Temporal worker replicas"
  type        = number
  default     = 3
}

variable "temporal_cpu_request" {
  description = "Temporal CPU request"
  type        = string
  default     = "500m"
}

variable "temporal_memory_request" {
  description = "Temporal memory request"
  type        = string
  default     = "1Gi"
}

variable "temporal_cpu_limit" {
  description = "Temporal CPU limit"
  type        = string
  default     = "2"
}

variable "temporal_memory_limit" {
  description = "Temporal memory limit"
  type        = string
  default     = "4Gi"
}

#==============================================================================
# SUPABASE
#==============================================================================

variable "supabase_version" {
  description = "Supabase version"
  type        = string
  default     = "v2.38.0"
}

variable "supabase_jwt_secret" {
  description = "Supabase JWT secret"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anon key"
  type        = string
  sensitive   = true
}

variable "supabase_service_key" {
  description = "Supabase service key"
  type        = string
  sensitive   = true
}

variable "supabase_enable_studio" {
  description = "Enable Supabase Studio"
  type        = bool
  default     = true
}

variable "supabase_enable_storage" {
  description = "Enable Supabase Storage"
  type        = bool
  default     = true
}

variable "supabase_cpu_request" {
  description = "Supabase CPU request"
  type        = string
  default     = "200m"
}

variable "supabase_memory_request" {
  description = "Supabase memory request"
  type        = string
  default     = "512Mi"
}

variable "supabase_cpu_limit" {
  description = "Supabase CPU limit"
  type        = string
  default     = "1"
}

variable "supabase_memory_limit" {
  description = "Supabase memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# DIRECTUS
#==============================================================================

variable "directus_version" {
  description = "Directus version"
  type        = string
  default     = "10.8.0"
}

variable "directus_admin_email" {
  description = "Directus admin email"
  type        = string
  default     = "admin@ananta-platform.local"
}

variable "directus_admin_password" {
  description = "Directus admin password"
  type        = string
  sensitive   = true
}

variable "directus_secret_key" {
  description = "Directus secret key"
  type        = string
  sensitive   = true
}

variable "directus_replica_count" {
  description = "Number of Directus replicas"
  type        = number
  default     = 2
}

variable "directus_cpu_request" {
  description = "Directus CPU request"
  type        = string
  default     = "200m"
}

variable "directus_memory_request" {
  description = "Directus memory request"
  type        = string
  default     = "512Mi"
}

variable "directus_cpu_limit" {
  description = "Directus CPU limit"
  type        = string
  default     = "1"
}

variable "directus_memory_limit" {
  description = "Directus memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# NOVU
#==============================================================================

variable "novu_version" {
  description = "Novu version"
  type        = string
  default     = "0.21.0"
}

variable "novu_jwt_secret" {
  description = "Novu JWT secret"
  type        = string
  sensitive   = true
}

variable "novu_api_key" {
  description = "Novu API key"
  type        = string
  sensitive   = true
}

variable "novu_enable_api" {
  description = "Enable Novu API"
  type        = bool
  default     = true
}

variable "novu_enable_worker" {
  description = "Enable Novu worker"
  type        = bool
  default     = true
}

variable "novu_enable_ws" {
  description = "Enable Novu WebSocket"
  type        = bool
  default     = true
}

variable "novu_enable_web" {
  description = "Enable Novu web UI"
  type        = bool
  default     = true
}

variable "novu_api_replicas" {
  description = "Number of Novu API replicas"
  type        = number
  default     = 2
}

variable "novu_worker_replicas" {
  description = "Number of Novu worker replicas"
  type        = number
  default     = 3
}

variable "novu_ws_replicas" {
  description = "Number of Novu WebSocket replicas"
  type        = number
  default     = 2
}

variable "novu_cpu_request" {
  description = "Novu CPU request"
  type        = string
  default     = "200m"
}

variable "novu_memory_request" {
  description = "Novu memory request"
  type        = string
  default     = "512Mi"
}

variable "novu_cpu_limit" {
  description = "Novu CPU limit"
  type        = string
  default     = "1"
}

variable "novu_memory_limit" {
  description = "Novu memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# OBSERVABILITY
#==============================================================================

variable "enable_prometheus" {
  description = "Enable Prometheus"
  type        = bool
  default     = true
}

variable "enable_grafana" {
  description = "Enable Grafana"
  type        = bool
  default     = true
}

variable "enable_loki" {
  description = "Enable Loki"
  type        = bool
  default     = true
}

variable "enable_tempo" {
  description = "Enable Tempo"
  type        = bool
  default     = true
}

variable "grafana_admin_user" {
  description = "Grafana admin username"
  type        = string
  default     = "admin"
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
}

variable "prometheus_storage_size" {
  description = "Prometheus storage size"
  type        = string
  default     = "20Gi"
}

variable "loki_storage_size" {
  description = "Loki storage size"
  type        = string
  default     = "20Gi"
}

variable "tempo_storage_size" {
  description = "Tempo storage size"
  type        = string
  default     = "20Gi"
}

variable "metrics_retention_days" {
  description = "Metrics retention in days"
  type        = number
  default     = 30
}

variable "monitoring_cpu_request" {
  description = "Monitoring CPU request"
  type        = string
  default     = "200m"
}

variable "monitoring_memory_request" {
  description = "Monitoring memory request"
  type        = string
  default     = "512Mi"
}

variable "monitoring_cpu_limit" {
  description = "Monitoring CPU limit"
  type        = string
  default     = "1"
}

variable "monitoring_memory_limit" {
  description = "Monitoring memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# MIGRATIONS
#==============================================================================

variable "migration_image_tag" {
  description = "Migration image tag"
  type        = string
  default     = "latest"
}

#==============================================================================
# JWT CONFIGURATION
#==============================================================================

variable "jwt_secret" {
  description = "JWT secret for Control Plane"
  type        = string
  sensitive   = true
}

variable "jwt_issuer" {
  description = "JWT issuer"
  type        = string
  default     = "ananta-platform"
}

variable "jwt_expires_in" {
  description = "JWT expiration time"
  type        = string
  default     = "24h"
}

#==============================================================================
# CONTROL PLANE SERVICES
#==============================================================================

variable "tenant_management_image" {
  description = "Tenant Management Service image"
  type        = string
  default     = "ananta/tenant-management-service:latest"
}

variable "orchestrator_image" {
  description = "Orchestrator Service image"
  type        = string
  default     = "ananta/orchestrator-service:latest"
}

variable "subscription_image" {
  description = "Subscription Service image"
  type        = string
  default     = "ananta/subscription-service:latest"
}

variable "temporal_worker_image" {
  description = "Temporal Worker Service image"
  type        = string
  default     = "ananta/temporal-worker-service:latest"
}

variable "tenant_management_replicas" {
  description = "Number of Tenant Management Service replicas"
  type        = number
  default     = 2
}

variable "orchestrator_replicas" {
  description = "Number of Orchestrator Service replicas"
  type        = number
  default     = 2
}

variable "subscription_replicas" {
  description = "Number of Subscription Service replicas"
  type        = number
  default     = 2
}

variable "temporal_worker_replicas_cp" {
  description = "Number of Temporal Worker Service replicas (Control Plane)"
  type        = number
  default     = 3
}

variable "control_plane_cpu_request" {
  description = "Control Plane CPU request"
  type        = string
  default     = "200m"
}

variable "control_plane_memory_request" {
  description = "Control Plane memory request"
  type        = string
  default     = "512Mi"
}

variable "control_plane_cpu_limit" {
  description = "Control Plane CPU limit"
  type        = string
  default     = "1"
}

variable "control_plane_memory_limit" {
  description = "Control Plane memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# APP PLANE SERVICES
#==============================================================================

variable "cns_service_image" {
  description = "CNS Service image"
  type        = string
  default     = "ananta/cns-service:latest"
}

variable "enrichment_service_image" {
  description = "Enrichment Service image"
  type        = string
  default     = "ananta/enrichment-service:latest"
}

variable "bom_service_image" {
  description = "BOM Service image"
  type        = string
  default     = "ananta/bom-service:latest"
}

variable "analytics_service_image" {
  description = "Analytics Service image"
  type        = string
  default     = "ananta/analytics-service:latest"
}

variable "cns_service_replicas" {
  description = "Number of CNS Service replicas"
  type        = number
  default     = 2
}

variable "enrichment_service_replicas" {
  description = "Number of Enrichment Service replicas"
  type        = number
  default     = 3
}

variable "bom_service_replicas" {
  description = "Number of BOM Service replicas"
  type        = number
  default     = 2
}

variable "analytics_service_replicas" {
  description = "Number of Analytics Service replicas"
  type        = number
  default     = 2
}

variable "app_plane_cpu_request" {
  description = "App Plane CPU request"
  type        = string
  default     = "200m"
}

variable "app_plane_memory_request" {
  description = "App Plane memory request"
  type        = string
  default     = "512Mi"
}

variable "app_plane_cpu_limit" {
  description = "App Plane CPU limit"
  type        = string
  default     = "1"
}

variable "app_plane_memory_limit" {
  description = "App Plane memory limit"
  type        = string
  default     = "2Gi"
}

#==============================================================================
# FRONTEND APPLICATIONS
#==============================================================================

variable "admin_app_image" {
  description = "Admin App image"
  type        = string
  default     = "ananta/admin-app:latest"
}

variable "customer_portal_image" {
  description = "Customer Portal image"
  type        = string
  default     = "ananta/customer-portal:latest"
}

variable "backstage_portal_image" {
  description = "Backstage Portal image"
  type        = string
  default     = "ananta/backstage-portal:latest"
}

variable "cns_dashboard_image" {
  description = "CNS Dashboard image"
  type        = string
  default     = "ananta/cns-dashboard:latest"
}

variable "dashboard_image" {
  description = "Unified Dashboard image"
  type        = string
  default     = "ananta/dashboard:latest"
}

variable "admin_app_replicas" {
  description = "Number of Admin App replicas"
  type        = number
  default     = 2
}

variable "customer_portal_replicas" {
  description = "Number of Customer Portal replicas"
  type        = number
  default     = 2
}

variable "backstage_portal_replicas" {
  description = "Number of Backstage Portal replicas"
  type        = number
  default     = 2
}

variable "cns_dashboard_replicas" {
  description = "Number of CNS Dashboard replicas"
  type        = number
  default     = 2
}

variable "dashboard_replicas" {
  description = "Number of Unified Dashboard replicas"
  type        = number
  default     = 2
}

variable "frontend_cpu_request" {
  description = "Frontend CPU request"
  type        = string
  default     = "100m"
}

variable "frontend_memory_request" {
  description = "Frontend memory request"
  type        = string
  default     = "256Mi"
}

variable "frontend_cpu_limit" {
  description = "Frontend CPU limit"
  type        = string
  default     = "500m"
}

variable "frontend_memory_limit" {
  description = "Frontend memory limit"
  type        = string
  default     = "1Gi"
}

#==============================================================================
# ARGOCD (GitOps)
#==============================================================================

variable "argocd_version" {
  description = "ArgoCD version"
  type        = string
  default     = "v2.9.0"
}

variable "argocd_admin_password" {
  description = "ArgoCD admin password"
  type        = string
  sensitive   = true
}

variable "argocd_git_repo_url" {
  description = "Git repository URL for ArgoCD"
  type        = string
}

variable "argocd_git_repo_path" {
  description = "Git repository path for ArgoCD manifests"
  type        = string
  default     = "infrastructure/gitops"
}

variable "argocd_git_repo_branch" {
  description = "Git repository branch"
  type        = string
  default     = "main"
}

variable "argocd_git_credentials_secret" {
  description = "Name of secret containing git credentials"
  type        = string
  default     = "argocd-git-creds"
}

variable "argocd_auto_sync" {
  description = "Enable auto-sync for ArgoCD applications"
  type        = bool
  default     = false
}

variable "argocd_enable_notifications" {
  description = "Enable ArgoCD notifications"
  type        = bool
  default     = true
}

variable "argocd_slack_webhook" {
  description = "Slack webhook URL for ArgoCD notifications"
  type        = string
  default     = ""
}

variable "argocd_cpu_request" {
  description = "ArgoCD CPU request"
  type        = string
  default     = "200m"
}

variable "argocd_memory_request" {
  description = "ArgoCD memory request"
  type        = string
  default     = "512Mi"
}

variable "argocd_cpu_limit" {
  description = "ArgoCD CPU limit"
  type        = string
  default     = "1"
}

variable "argocd_memory_limit" {
  description = "ArgoCD memory limit"
  type        = string
  default     = "2Gi"
}
