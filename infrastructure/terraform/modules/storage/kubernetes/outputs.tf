# =============================================================================
# Kubernetes Storage Module Outputs
# =============================================================================

output "bucket_name" {
  description = "Bucket name (MinIO instance name)"
  value       = local.bucket_name
}

output "bucket_arn" {
  description = "Bucket ARN equivalent (service URL)"
  value       = var.use_operator ? "" : "minio://${kubernetes_service.minio[0].metadata[0].namespace}/${kubernetes_service.minio[0].metadata[0].name}"
}

output "endpoint" {
  description = "MinIO API endpoint"
  value       = var.use_operator ? "" : "${kubernetes_service.minio[0].metadata[0].name}.${kubernetes_service.minio[0].metadata[0].namespace}.svc.cluster.local:9000"
}

output "resource_id" {
  description = "Resource ID (StatefulSet name)"
  value       = var.use_operator ? "" : kubernetes_stateful_set.minio[0].metadata[0].name
}

output "resource_arn" {
  description = "Resource ARN equivalent"
  value       = var.use_operator ? "" : "kubernetes://${kubernetes_stateful_set.minio[0].metadata[0].namespace}/${kubernetes_stateful_set.minio[0].metadata[0].name}"
}

# Kubernetes-specific outputs

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.create_namespace ? kubernetes_namespace.minio[0].metadata[0].name : var.namespace
}

output "service_name" {
  description = "Kubernetes service name"
  value       = var.use_operator ? local.bucket_name : kubernetes_service.minio[0].metadata[0].name
}

output "headless_service_name" {
  description = "Headless service name (for StatefulSet)"
  value       = var.use_operator ? "" : kubernetes_service.minio_headless[0].metadata[0].name
}

output "secret_name" {
  description = "Secret containing MinIO credentials"
  value       = kubernetes_secret.minio_credentials.metadata[0].name
}

output "access_key" {
  description = "MinIO access key"
  value       = var.access_key != null ? var.access_key : random_password.access_key[0].result
  sensitive   = true
}

output "secret_key" {
  description = "MinIO secret key"
  value       = var.secret_key != null ? var.secret_key : random_password.secret_key[0].result
  sensitive   = true
}

output "connection_string" {
  description = "Connection string for S3-compatible clients"
  value = var.use_operator ? "" : format(
    "%s://%s:%s@%s.%s.svc.cluster.local:9000",
    var.tls_enabled ? "https" : "http",
    var.access_key != null ? var.access_key : random_password.access_key[0].result,
    var.secret_key != null ? var.secret_key : random_password.secret_key[0].result,
    kubernetes_service.minio[0].metadata[0].name,
    kubernetes_service.minio[0].metadata[0].namespace
  )
  sensitive = true
}

output "api_port" {
  description = "MinIO API port"
  value       = 9000
}

output "console_port" {
  description = "MinIO console port"
  value       = 9001
}

output "console_endpoint" {
  description = "MinIO console endpoint"
  value       = var.use_operator ? "" : "${kubernetes_service.minio[0].metadata[0].name}.${kubernetes_service.minio[0].metadata[0].namespace}.svc.cluster.local:9001"
}

output "ingress_host" {
  description = "Ingress hostname for MinIO API"
  value       = var.ingress_enabled ? var.ingress_host : ""
}

output "console_ingress_host" {
  description = "Ingress hostname for MinIO console"
  value       = var.console_ingress_enabled ? var.console_ingress_host : ""
}

output "replicas" {
  description = "Number of MinIO replicas"
  value       = local.config.replicas
}

output "storage_size" {
  description = "Storage size per replica"
  value       = var.storage_size != null ? var.storage_size : local.config.storage_size
}

output "tls_enabled" {
  description = "Whether TLS is enabled"
  value       = var.tls_enabled
}

output "default_bucket_name" {
  description = "Default bucket name"
  value       = var.create_default_bucket ? var.default_bucket_name : ""
}
