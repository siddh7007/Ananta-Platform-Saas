# =============================================================================
# Cloud-Agnostic Compute Module
# =============================================================================
# Unified compute interface supporting multiple cloud providers.
# Routes to the appropriate provider-specific implementation based on config.
#
# Supported providers:
# - kubernetes: Native Kubernetes (works on EKS, AKS, GKE, or any K8s cluster)
# - ecs: AWS ECS (Fargate or EC2)
# - azure_container_apps: Azure Container Apps
# - gcp_cloud_run: Google Cloud Run
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Detection
# -----------------------------------------------------------------------------

locals {
  # Determine effective provider from explicit setting or auto-detect
  effective_provider = var.cloud_provider != "" ? var.cloud_provider : "kubernetes"

  # Merge common and provider-specific configurations
  common_labels = merge(var.labels, {
    "managed-by"  = "terraform"
    "environment" = var.environment
    "module"      = "compute"
  })
}

# -----------------------------------------------------------------------------
# Kubernetes Compute (EKS, AKS, GKE, or any K8s cluster)
# -----------------------------------------------------------------------------

module "kubernetes" {
  source = "./kubernetes"
  count  = local.effective_provider == "kubernetes" ? 1 : 0

  # Common variables
  name_prefix  = var.name_prefix
  environment  = var.environment
  labels       = local.common_labels
  annotations  = var.annotations

  # Instance sizing
  instance_size = var.instance_size

  # Namespace configuration
  namespace        = var.kubernetes_config.namespace
  create_namespace = var.kubernetes_config.create_namespace

  # Service account configuration
  create_service_account       = var.kubernetes_config.create_service_account
  service_account_name         = var.kubernetes_config.service_account_name
  service_account_annotations  = var.kubernetes_config.service_account_annotations

  # ConfigMap
  config_data = var.config_data

  # Services configuration
  services = var.services

  # Image pull secrets
  image_pull_secrets = var.kubernetes_config.image_pull_secrets

  # Pod security context
  pod_security_context = var.kubernetes_config.pod_security_context

  # Scheduling
  node_selector = var.kubernetes_config.node_selector
  tolerations   = var.kubernetes_config.tolerations
  pod_affinity  = var.kubernetes_config.pod_affinity

  # Ingress
  ingress_class_name  = var.kubernetes_config.ingress_class_name
  ingress_annotations = var.kubernetes_config.ingress_annotations

  # Monitoring
  prometheus_operator_enabled = var.kubernetes_config.prometheus_operator_enabled
  prometheus_labels           = var.kubernetes_config.prometheus_labels
}

# -----------------------------------------------------------------------------
# AWS ECS (Placeholder for future implementation)
# -----------------------------------------------------------------------------

# module "ecs" {
#   source = "./ecs"
#   count  = local.effective_provider == "ecs" ? 1 : 0
#
#   name_prefix = var.name_prefix
#   environment = var.environment
#
#   # ECS-specific configuration
#   cluster_name        = var.ecs_config.cluster_name
#   vpc_id              = var.ecs_config.vpc_id
#   subnet_ids          = var.ecs_config.subnet_ids
#   security_group_ids  = var.ecs_config.security_group_ids
#   execution_role_arn  = var.ecs_config.execution_role_arn
#   task_role_arn       = var.ecs_config.task_role_arn
#
#   services = var.services
# }

# -----------------------------------------------------------------------------
# Azure Container Apps (Placeholder for future implementation)
# -----------------------------------------------------------------------------

# module "azure_container_apps" {
#   source = "./azure"
#   count  = local.effective_provider == "azure_container_apps" ? 1 : 0
#
#   name_prefix = var.name_prefix
#   environment = var.environment
#
#   # Azure-specific configuration
#   resource_group_name = var.azure_config.resource_group_name
#   location            = var.azure_config.location
#   container_app_environment_id = var.azure_config.container_app_environment_id
#
#   services = var.services
# }

# -----------------------------------------------------------------------------
# GCP Cloud Run (Placeholder for future implementation)
# -----------------------------------------------------------------------------

# module "gcp_cloud_run" {
#   source = "./gcp"
#   count  = local.effective_provider == "gcp_cloud_run" ? 1 : 0
#
#   name_prefix = var.name_prefix
#   environment = var.environment
#
#   # GCP-specific configuration
#   project_id = var.gcp_config.project_id
#   region     = var.gcp_config.region
#
#   services = var.services
# }
