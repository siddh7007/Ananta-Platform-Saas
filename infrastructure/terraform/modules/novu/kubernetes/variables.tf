# =============================================================================
# Novu Module Variables
# =============================================================================

variable "namespace" {
  description = "Kubernetes namespace for Novu"
  type        = string
  default     = "notifications"
}

variable "labels" {
  description = "Common labels for all resources"
  type        = map(string)
  default     = {}
}

variable "storage_class" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "local-path"
}

variable "service_type" {
  description = "Service type for Novu services"
  type        = string
  default     = "ClusterIP"
}

# -----------------------------------------------------------------------------
# Version Configuration
# -----------------------------------------------------------------------------

variable "novu_version" {
  description = "Novu Docker image version"
  type        = string
  default     = "0.24.0"
}

variable "mongodb_version" {
  description = "MongoDB image version"
  type        = string
  default     = "6.0"
}

variable "mongodb_chart_version" {
  description = "MongoDB Helm chart version"
  type        = string
  default     = "15.1.0"
}

variable "redis_version" {
  description = "Redis image version"
  type        = string
  default     = "7.2"
}

variable "redis_chart_version" {
  description = "Redis Helm chart version"
  type        = string
  default     = "20.0.0"
}

# -----------------------------------------------------------------------------
# MongoDB Configuration
# -----------------------------------------------------------------------------

variable "mongodb_root_password" {
  description = "MongoDB root password"
  type        = string
  sensitive   = true
}

variable "mongodb_password" {
  description = "MongoDB novu user password"
  type        = string
  sensitive   = true
}

variable "mongodb_storage_size" {
  description = "MongoDB storage size"
  type        = string
  default     = "5Gi"
}

variable "mongodb_cpu_request" {
  description = "MongoDB CPU request"
  type        = string
  default     = "100m"
}

variable "mongodb_memory_request" {
  description = "MongoDB memory request"
  type        = string
  default     = "256Mi"
}

variable "mongodb_cpu_limit" {
  description = "MongoDB CPU limit"
  type        = string
  default     = "500m"
}

variable "mongodb_memory_limit" {
  description = "MongoDB memory limit"
  type        = string
  default     = "512Mi"
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "redis_storage_size" {
  description = "Redis storage size"
  type        = string
  default     = "1Gi"
}

variable "redis_cpu_request" {
  description = "Redis CPU request"
  type        = string
  default     = "50m"
}

variable "redis_memory_request" {
  description = "Redis memory request"
  type        = string
  default     = "64Mi"
}

variable "redis_cpu_limit" {
  description = "Redis CPU limit"
  type        = string
  default     = "200m"
}

variable "redis_memory_limit" {
  description = "Redis memory limit"
  type        = string
  default     = "128Mi"
}

# -----------------------------------------------------------------------------
# Novu Secrets
# -----------------------------------------------------------------------------

variable "novu_jwt_secret" {
  description = "Novu JWT secret"
  type        = string
  sensitive   = true
}

variable "novu_encryption_key" {
  description = "Novu store encryption key"
  type        = string
  sensitive   = true
}

variable "novu_secret_key" {
  description = "Novu secret key"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# MinIO/S3 Configuration
# -----------------------------------------------------------------------------

variable "minio_endpoint" {
  description = "MinIO endpoint URL"
  type        = string
  default     = "http://control-plane-minio:9000"
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

# -----------------------------------------------------------------------------
# URL Configuration
# -----------------------------------------------------------------------------

variable "novu_api_url" {
  description = "External Novu API URL"
  type        = string
  default     = "http://localhost:31340"
}

variable "novu_web_url" {
  description = "External Novu Web URL"
  type        = string
  default     = "http://localhost:31342"
}

variable "novu_ws_url" {
  description = "External Novu WebSocket URL"
  type        = string
  default     = "ws://localhost:31341"
}

# -----------------------------------------------------------------------------
# Replica Configuration
# -----------------------------------------------------------------------------

variable "api_replicas" {
  description = "Novu API replicas"
  type        = number
  default     = 1
}

variable "ws_replicas" {
  description = "Novu WebSocket replicas"
  type        = number
  default     = 1
}

variable "worker_replicas" {
  description = "Novu Worker replicas"
  type        = number
  default     = 1
}

variable "web_replicas" {
  description = "Novu Web replicas"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# API Resources
# -----------------------------------------------------------------------------

variable "api_cpu_request" {
  type    = string
  default = "100m"
}

variable "api_memory_request" {
  type    = string
  default = "256Mi"
}

variable "api_cpu_limit" {
  type    = string
  default = "500m"
}

variable "api_memory_limit" {
  type    = string
  default = "512Mi"
}

# -----------------------------------------------------------------------------
# WebSocket Resources
# -----------------------------------------------------------------------------

variable "ws_cpu_request" {
  type    = string
  default = "50m"
}

variable "ws_memory_request" {
  type    = string
  default = "128Mi"
}

variable "ws_cpu_limit" {
  type    = string
  default = "200m"
}

variable "ws_memory_limit" {
  type    = string
  default = "256Mi"
}

# -----------------------------------------------------------------------------
# Worker Resources
# -----------------------------------------------------------------------------

variable "worker_cpu_request" {
  type    = string
  default = "100m"
}

variable "worker_memory_request" {
  type    = string
  default = "256Mi"
}

variable "worker_cpu_limit" {
  type    = string
  default = "500m"
}

variable "worker_memory_limit" {
  type    = string
  default = "512Mi"
}

# -----------------------------------------------------------------------------
# Web Resources
# -----------------------------------------------------------------------------

variable "web_cpu_request" {
  type    = string
  default = "50m"
}

variable "web_memory_request" {
  type    = string
  default = "128Mi"
}

variable "web_cpu_limit" {
  type    = string
  default = "200m"
}

variable "web_memory_limit" {
  type    = string
  default = "256Mi"
}

variable "web_node_port" {
  description = "NodePort for Novu Web"
  type        = number
  default     = 31342
}
