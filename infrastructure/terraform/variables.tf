# =============================================================================
# Terraform Variables - Ananta Platform
# =============================================================================
# All configurable parameters for the infrastructure deployment
# Supports multi-cloud: AWS, Azure, GCP, and Kubernetes
# =============================================================================

# -----------------------------------------------------------------------------
# Cloud Provider Selection
# -----------------------------------------------------------------------------

variable "cloud_provider" {
  description = "Target cloud provider for deployment"
  type        = string
  default     = "aws"
  validation {
    condition     = contains(["aws", "azure", "gcp", "kubernetes"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, azure, gcp, kubernetes."
  }
}

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "ananta"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# -----------------------------------------------------------------------------
# AWS-Specific Configuration
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# Azure-Specific Configuration
# -----------------------------------------------------------------------------

variable "azure_subscription_id" {
  description = "Azure subscription ID"
  type        = string
  default     = ""
}

variable "azure_tenant_id" {
  description = "Azure tenant ID"
  type        = string
  default     = ""
}

variable "azure_location" {
  description = "Azure region for deployment"
  type        = string
  default     = "eastus"
}

variable "azure_resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# GCP-Specific Configuration
# -----------------------------------------------------------------------------

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-central1"
}

# -----------------------------------------------------------------------------
# Kubernetes-Specific Configuration
# -----------------------------------------------------------------------------

variable "kubeconfig_path" {
  description = "Path to kubeconfig file for Kubernetes provider"
  type        = string
  default     = "~/.kube/config"
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace for deployments"
  type        = string
  default     = "ananta"
}

variable "kubernetes_storage_class" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "standard"
}

variable "kubernetes_ingress_class" {
  description = "Ingress controller class name"
  type        = string
  default     = "nginx"
}

variable "kubernetes_image_pull_secrets" {
  description = "List of image pull secret names for private registries"
  type        = list(string)
  default     = []
}

variable "kubernetes_node_selector" {
  description = "Node selector for pod scheduling"
  type        = map(string)
  default     = {}
}

variable "kubernetes_tolerations" {
  description = "Pod tolerations for scheduling"
  type = list(object({
    key      = string
    operator = optional(string, "Equal")
    value    = optional(string)
    effect   = string
  }))
  default = []
}

variable "enable_prometheus_operator" {
  description = "Enable Prometheus Operator for ServiceMonitor resources"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# Network Configuration
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway (cost saving for non-prod)"
  type        = bool
  default     = false
}

variable "enable_vpc_endpoints" {
  description = "Enable VPC endpoints for private AWS service access (reduces NAT Gateway costs)"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Control Plane Database Configuration
# -----------------------------------------------------------------------------

variable "control_plane_db_instance_class" {
  description = "RDS instance class for control plane database"
  type        = string
  default     = "db.t3.medium"
}

variable "control_plane_db_allocated_storage" {
  description = "Allocated storage in GB for control plane database"
  type        = number
  default     = 20
}

variable "control_plane_db_max_allocated_storage" {
  description = "Maximum storage autoscaling limit in GB"
  type        = number
  default     = 100
}

variable "control_plane_db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "control_plane_db_multi_az" {
  description = "Enable Multi-AZ for high availability"
  type        = bool
  default     = false
}

variable "control_plane_db_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "control_plane_db_create_read_replica" {
  description = "Enable read replicas for control plane database"
  type        = bool
  default     = false
}

variable "control_plane_db_replica_count" {
  description = "Number of read replicas for control plane database"
  type        = number
  default     = 1
}

variable "control_plane_db_replica_instance_class" {
  description = "Instance class for read replicas (defaults to primary instance class)"
  type        = string
  default     = null
}

variable "control_plane_db_create_rds_proxy" {
  description = "Enable RDS Proxy for connection pooling on control plane database"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# App Plane Database Configuration (Supabase-compatible)
# -----------------------------------------------------------------------------

variable "app_plane_db_instance_class" {
  description = "RDS instance class for app plane database"
  type        = string
  default     = "db.t3.medium"
}

variable "app_plane_db_allocated_storage" {
  description = "Allocated storage in GB for app plane database"
  type        = number
  default     = 50
}

variable "app_plane_db_max_allocated_storage" {
  description = "Maximum storage autoscaling limit in GB"
  type        = number
  default     = 500
}

variable "app_plane_db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "app_plane_db_multi_az" {
  description = "Enable Multi-AZ for high availability"
  type        = bool
  default     = false
}

variable "app_plane_db_create_read_replica" {
  description = "Enable read replicas for app plane database"
  type        = bool
  default     = false
}

variable "app_plane_db_replica_count" {
  description = "Number of read replicas for app plane database"
  type        = number
  default     = 1
}

variable "app_plane_db_replica_instance_class" {
  description = "Instance class for read replicas (defaults to primary instance class)"
  type        = string
  default     = null
}

variable "app_plane_db_create_rds_proxy" {
  description = "Enable RDS Proxy for connection pooling on app plane database"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Components-V2 Database Configuration
# -----------------------------------------------------------------------------

variable "components_db_instance_class" {
  description = "RDS instance class for components database"
  type        = string
  default     = "db.t3.small"
}

variable "components_db_allocated_storage" {
  description = "Allocated storage in GB for components database"
  type        = number
  default     = 20
}

# -----------------------------------------------------------------------------
# ElastiCache (Redis) Configuration
# -----------------------------------------------------------------------------

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the cluster"
  type        = number
  default     = 1
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
}

variable "redis_automatic_failover_enabled" {
  description = "Enable automatic failover for Redis cluster"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# ECS Configuration
# -----------------------------------------------------------------------------

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
  default     = "ananta-cluster"
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = true
}

variable "ecs_log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_service_discovery" {
  description = "Enable AWS Cloud Map service discovery for ECS services"
  type        = bool
  default     = true
}

# Control Plane Services
variable "tenant_mgmt_cpu" {
  description = "CPU units for tenant management service"
  type        = number
  default     = 512
}

variable "tenant_mgmt_memory" {
  description = "Memory in MB for tenant management service"
  type        = number
  default     = 1024
}

variable "tenant_mgmt_desired_count" {
  description = "Desired number of tenant management tasks"
  type        = number
  default     = 2
}

# App Plane Services
variable "cns_service_cpu" {
  description = "CPU units for CNS service"
  type        = number
  default     = 512
}

variable "cns_service_memory" {
  description = "Memory in MB for CNS service"
  type        = number
  default     = 1024
}

variable "cns_service_desired_count" {
  description = "Desired number of CNS service tasks"
  type        = number
  default     = 2
}

# -----------------------------------------------------------------------------
# Auto Scaling Configuration
# -----------------------------------------------------------------------------

variable "enable_autoscaling" {
  description = "Enable ECS service auto scaling"
  type        = bool
  default     = true
}

variable "autoscaling_min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "autoscaling_max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "autoscaling_cpu_target" {
  description = "Target CPU utilization percentage for scaling"
  type        = number
  default     = 70
}

variable "autoscaling_memory_target" {
  description = "Target memory utilization percentage for scaling"
  type        = number
  default     = 80
}

variable "autoscaling_scale_in_cooldown" {
  description = "Cooldown period in seconds before scale in"
  type        = number
  default     = 300
}

variable "autoscaling_scale_out_cooldown" {
  description = "Cooldown period in seconds before scale out"
  type        = number
  default     = 60
}

# -----------------------------------------------------------------------------
# Secrets Management
# -----------------------------------------------------------------------------

variable "secrets_manager_prefix" {
  description = "Prefix for Secrets Manager secret names"
  type        = string
  default     = "ananta"
}

variable "enable_secrets_rotation" {
  description = "Enable automatic rotation for database credentials"
  type        = bool
  default     = true
}

variable "secrets_rotation_days" {
  description = "Number of days between automatic secret rotations"
  type        = number
  default     = 30
}

# -----------------------------------------------------------------------------
# Keycloak Configuration
# -----------------------------------------------------------------------------

variable "keycloak_db_instance_class" {
  description = "RDS instance class for Keycloak database"
  type        = string
  default     = "db.t3.micro"
}

variable "keycloak_task_cpu" {
  description = "CPU units for Keycloak ECS task"
  type        = number
  default     = 512
}

variable "keycloak_task_memory" {
  description = "Memory in MB for Keycloak ECS task"
  type        = number
  default     = 1024
}

variable "keycloak_desired_count" {
  description = "Desired number of Keycloak tasks"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Temporal Configuration
# -----------------------------------------------------------------------------

variable "temporal_db_instance_class" {
  description = "RDS instance class for Temporal database"
  type        = string
  default     = "db.t3.small"
}

variable "temporal_namespace" {
  description = "Temporal namespace for workflows"
  type        = string
  default     = "arc-saas"
}

variable "temporal_server_task_cpu" {
  description = "CPU units for Temporal server ECS task"
  type        = number
  default     = 1024
}

variable "temporal_server_task_memory" {
  description = "Memory in MB for Temporal server ECS task"
  type        = number
  default     = 2048
}

variable "temporal_server_desired_count" {
  description = "Desired number of Temporal server tasks"
  type        = number
  default     = 1
}

variable "temporal_ui_task_cpu" {
  description = "CPU units for Temporal UI ECS task"
  type        = number
  default     = 256
}

variable "temporal_ui_task_memory" {
  description = "Memory in MB for Temporal UI ECS task"
  type        = number
  default     = 512
}

variable "temporal_ui_desired_count" {
  description = "Desired number of Temporal UI tasks"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Message Queue Configuration (Amazon MQ / RabbitMQ)
# -----------------------------------------------------------------------------

variable "mq_instance_type" {
  description = "Amazon MQ broker instance type"
  type        = string
  default     = "mq.t3.micro"
}

variable "mq_engine_version" {
  description = "RabbitMQ engine version"
  type        = string
  default     = "3.11.20"
}

variable "mq_deployment_mode" {
  description = "Deployment mode (SINGLE_INSTANCE or ACTIVE_STANDBY_MULTI_AZ)"
  type        = string
  default     = "SINGLE_INSTANCE"
}

# -----------------------------------------------------------------------------
# Object Storage (S3) Configuration
# -----------------------------------------------------------------------------

variable "s3_bucket_prefix" {
  description = "Prefix for S3 bucket names"
  type        = string
  default     = "ananta"
}

variable "enable_s3_versioning" {
  description = "Enable versioning on S3 buckets"
  type        = bool
  default     = true
}

variable "s3_lifecycle_days" {
  description = "Days before transitioning objects to cheaper storage"
  type        = number
  default     = 90
}

# -----------------------------------------------------------------------------
# Monitoring & Observability
# -----------------------------------------------------------------------------

variable "enable_prometheus" {
  description = "Deploy Prometheus for metrics collection"
  type        = bool
  default     = true
}

variable "enable_grafana" {
  description = "Deploy Grafana for visualization"
  type        = bool
  default     = true
}

variable "enable_jaeger" {
  description = "Deploy Jaeger for distributed tracing"
  type        = bool
  default     = true
}

variable "prometheus_retention_days" {
  description = "Prometheus data retention period in days"
  type        = number
  default     = 15
}

# -----------------------------------------------------------------------------
# Domain & SSL Configuration
# -----------------------------------------------------------------------------

variable "domain_name" {
  description = "Primary domain name for the platform"
  type        = string
  default     = ""
}

variable "create_dns_records" {
  description = "Create Route53 DNS records"
  type        = bool
  default     = false
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Container Image Configuration
# -----------------------------------------------------------------------------

variable "container_registry" {
  description = "Container registry URL (e.g., ECR, ACR, GCR, Docker Hub)"
  type        = string
  default     = ""
}

variable "tenant_mgmt_image" {
  description = "Container image for tenant management service"
  type        = string
  default     = "ananta/tenant-management-service:latest"
}

variable "cns_service_image" {
  description = "Container image for CNS service"
  type        = string
  default     = "ananta/cns-service:latest"
}

variable "keycloak_image" {
  description = "Container image for Keycloak"
  type        = string
  default     = "quay.io/keycloak/keycloak:22.0"
}

variable "keycloak_version" {
  description = "Keycloak version (used for Kubernetes deployment)"
  type        = string
  default     = "22.0"
}

variable "temporal_image" {
  description = "Container image for Temporal server"
  type        = string
  default     = "temporalio/auto-setup:1.24.2"
}

variable "temporal_version" {
  description = "Temporal server version"
  type        = string
  default     = "1.24.2"
}

variable "temporal_ui_image" {
  description = "Container image for Temporal UI"
  type        = string
  default     = "temporalio/ui:2.22.3"
}

variable "temporal_ui_version" {
  description = "Temporal UI version"
  type        = string
  default     = "2.22.3"
}

# -----------------------------------------------------------------------------
# Database Credentials
# -----------------------------------------------------------------------------

variable "control_plane_db_username" {
  description = "Username for control plane database"
  type        = string
  default     = "arc_saas"
  sensitive   = true
}

variable "control_plane_db_password" {
  description = "Password for control plane database"
  type        = string
  default     = ""
  sensitive   = true
}

variable "app_plane_db_username" {
  description = "Username for app plane database"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "app_plane_db_password" {
  description = "Password for app plane database"
  type        = string
  default     = ""
  sensitive   = true
}

variable "components_db_username" {
  description = "Username for components database"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "components_db_password" {
  description = "Password for components database"
  type        = string
  default     = ""
  sensitive   = true
}

variable "keycloak_db_username" {
  description = "Username for Keycloak database"
  type        = string
  default     = "keycloak"
  sensitive   = true
}

variable "keycloak_db_password" {
  description = "Password for Keycloak database"
  type        = string
  default     = ""
  sensitive   = true
}

variable "keycloak_admin_password" {
  description = "Keycloak admin password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "temporal_db_username" {
  description = "Username for Temporal database"
  type        = string
  default     = "temporal"
  sensitive   = true
}

variable "temporal_db_password" {
  description = "Password for Temporal database"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Service URLs & Endpoints
# -----------------------------------------------------------------------------

variable "keycloak_realm" {
  description = "Keycloak realm name"
  type        = string
  default     = "ananta-saas"
}

variable "keycloak_client_id" {
  description = "Keycloak client ID for services"
  type        = string
  default     = "admin-cli"
}

variable "keycloak_client_secret" {
  description = "Keycloak client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret for services"
  type        = string
  default     = ""
  sensitive   = true
}

variable "jwt_issuer" {
  description = "JWT issuer URL"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------

variable "enable_temporal" {
  description = "Enable Temporal workflow engine deployment"
  type        = bool
  default     = true
}

variable "enable_keycloak" {
  description = "Enable Keycloak IAM deployment"
  type        = bool
  default     = true
}

variable "enable_monitoring_stack" {
  description = "Enable full monitoring stack (Prometheus, Grafana, Jaeger)"
  type        = bool
  default     = true
}
