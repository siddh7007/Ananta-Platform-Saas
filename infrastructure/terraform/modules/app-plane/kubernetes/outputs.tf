# =============================================================================
# App Plane Kubernetes Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Database Endpoints
# -----------------------------------------------------------------------------

output "supabase_db_host" {
  description = "Supabase PostgreSQL service hostname"
  value       = kubernetes_service.supabase_db.metadata[0].name
}

output "supabase_db_port" {
  description = "Supabase PostgreSQL service port"
  value       = 5432
}

output "components_db_host" {
  description = "Components-V2 PostgreSQL service hostname"
  value       = kubernetes_service.components_db.metadata[0].name
}

output "components_db_port" {
  description = "Components-V2 PostgreSQL service port"
  value       = 5432
}

# -----------------------------------------------------------------------------
# Cache & Messaging Endpoints (Native Kubernetes StatefulSets)
# -----------------------------------------------------------------------------

output "redis_host" {
  description = "Redis service hostname (native StatefulSet)"
  value       = "redis-master"  # Native StatefulSet service name
}

output "redis_port" {
  description = "Redis service port"
  value       = 6379
}

output "rabbitmq_host" {
  description = "RabbitMQ service hostname (native StatefulSet)"
  value       = "rabbitmq"  # Native StatefulSet service name
}

output "rabbitmq_port" {
  description = "RabbitMQ AMQP port"
  value       = 5672
}

output "rabbitmq_management_port" {
  description = "RabbitMQ management UI port"
  value       = 15672
}

output "rabbitmq_stream_port" {
  description = "RabbitMQ Stream protocol port"
  value       = 5552
}

# -----------------------------------------------------------------------------
# Storage Endpoints (Helm-managed services)
# -----------------------------------------------------------------------------

output "minio_host" {
  description = "MinIO service hostname (Helm release)"
  value       = "minio"  # MinIO Helm chart naming
}

output "minio_api_port" {
  description = "MinIO API port"
  value       = 9000
}

output "minio_console_port" {
  description = "MinIO console port"
  value       = 9001
}

output "minio_endpoint" {
  description = "MinIO endpoint for S3 API"
  value       = "minio:9000"
}

# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------

output "supabase_api_url" {
  description = "Supabase PostgREST API URL (internal)"
  value       = var.deploy_supabase_api ? "http://${kubernetes_service.supabase_api[0].metadata[0].name}:3000" : ""
}

output "cns_service_url" {
  description = "CNS Service URL (internal)"
  value       = var.deploy_cns_service ? "http://${kubernetes_service.cns_service[0].metadata[0].name}:27200" : ""
}

output "customer_portal_url" {
  description = "Customer Portal URL (internal)"
  value       = var.deploy_customer_portal ? "http://${kubernetes_service.customer_portal[0].metadata[0].name}:27100" : ""
}

# -----------------------------------------------------------------------------
# Secret Names (for other modules to reference)
# -----------------------------------------------------------------------------

output "supabase_db_secret_name" {
  description = "Name of the Supabase DB credentials secret"
  value       = kubernetes_secret.supabase_db.metadata[0].name
}

output "components_db_secret_name" {
  description = "Name of the Components DB credentials secret"
  value       = kubernetes_secret.components_db.metadata[0].name
}

output "rabbitmq_secret_name" {
  description = "Name of the RabbitMQ credentials secret (native StatefulSet)"
  value       = "rabbitmq"  # Native Terraform kubernetes_secret resource
}

output "minio_secret_name" {
  description = "Name of the MinIO credentials secret (Helm-managed)"
  value       = "minio"  # MinIO Helm chart creates this secret
}

# -----------------------------------------------------------------------------
# Connection Strings (for convenience)
# -----------------------------------------------------------------------------

output "supabase_db_connection_string" {
  description = "PostgreSQL connection string for Supabase DB"
  value       = "postgresql://postgres@${kubernetes_service.supabase_db.metadata[0].name}:5432/postgres"
  sensitive   = true
}

output "components_db_connection_string" {
  description = "PostgreSQL connection string for Components DB"
  value       = "postgresql://postgres@${kubernetes_service.components_db.metadata[0].name}:5432/components_v2"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string (Helm-managed)"
  value       = "redis://redis-master:6379"
}

output "rabbitmq_connection_string" {
  description = "RabbitMQ AMQP connection string (Helm-managed)"
  value       = "amqp://admin@rabbitmq:5672"
  sensitive   = true
}
