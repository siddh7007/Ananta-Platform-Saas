# =============================================================================
# Main Terraform Configuration - Ananta Platform
# =============================================================================
# Cloud-agnostic root module that orchestrates all infrastructure components.
# Supports AWS, Azure, GCP, and Kubernetes deployments.
#
# Usage:
#   terraform init -backend-config="bucket=your-state-bucket"
#   terraform workspace select dev  # or staging, prod
#   terraform plan -var-file="environments/dev.tfvars"
#   terraform apply -var-file="environments/dev.tfvars"
#
# Cloud Provider Selection:
#   - Set cloud_provider = "aws" | "azure" | "gcp" | "kubernetes"
#   - Provider-specific variables are used based on selection
# =============================================================================

# -----------------------------------------------------------------------------
# Provider Configuration - Cloud Agnostic
# -----------------------------------------------------------------------------

# AWS Provider (used when cloud_provider = "aws")
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(
      {
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "terraform"
        Platform    = "ananta-saas"
      },
      var.tags
    )
  }

  # Skip AWS config if not using AWS
  skip_credentials_validation = var.cloud_provider != "aws"
  skip_metadata_api_check     = var.cloud_provider != "aws"
  skip_region_validation      = var.cloud_provider != "aws"
  skip_requesting_account_id  = var.cloud_provider != "aws"
}

# Azure Provider (used when cloud_provider = "azure")
provider "azurerm" {
  features {}

  subscription_id = var.azure_subscription_id
  tenant_id       = var.azure_tenant_id

  skip_provider_registration = var.cloud_provider != "azure"
}

# GCP Provider (used when cloud_provider = "gcp")
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Kubernetes Provider (used for all cloud-managed K8s or standalone K8s)
provider "kubernetes" {
  config_path = var.cloud_provider == "kubernetes" ? var.kubeconfig_path : null
  # For cloud-managed K8s (EKS, AKS, GKE), configuration will be set dynamically
  # host                   = local.is_cloud_k8s ? module.compute[0].kubernetes_host : null
  # cluster_ca_certificate = local.is_cloud_k8s ? module.compute[0].cluster_ca_certificate : null
  # token                  = local.is_cloud_k8s ? module.compute[0].cluster_token : null
}

# Helm Provider (for Kubernetes-based deployments)
provider "helm" {
  kubernetes {
    config_path = var.cloud_provider == "kubernetes" ? var.kubeconfig_path : null
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
    CloudProvider = var.cloud_provider
  }

  # Cloud provider detection
  is_aws        = var.cloud_provider == "aws"
  is_azure      = var.cloud_provider == "azure"
  is_gcp        = var.cloud_provider == "gcp"
  is_kubernetes = var.cloud_provider == "kubernetes"

  # Environment-specific configurations
  is_production = var.environment == "prod"

  # Database configurations
  db_deletion_protection = local.is_production
  db_skip_final_snapshot = !local.is_production

  # Instance size mapping (normalized across providers)
  instance_size = local.is_production ? "large" : (var.environment == "staging" ? "medium" : "small")

  # Auto-scaling defaults by environment
  autoscaling_config = {
    dev = {
      min_capacity = 1
      max_capacity = 2
    }
    staging = {
      min_capacity = 1
      max_capacity = 5
    }
    prod = {
      min_capacity = 2
      max_capacity = 10
    }
  }
}

# -----------------------------------------------------------------------------
# Data Sources - Cloud Provider Specific
# -----------------------------------------------------------------------------

# AWS Data Sources (only when using AWS)
data "aws_caller_identity" "current" {
  count = local.is_aws ? 1 : 0
}

data "aws_region" "current" {
  count = local.is_aws ? 1 : 0
}

data "aws_availability_zones" "available" {
  count = local.is_aws ? 1 : 0
  state = "available"
}

# Azure Data Sources (only when using Azure)
data "azurerm_subscription" "current" {
  count = local.is_azure ? 1 : 0
}

data "azurerm_resource_group" "main" {
  count = local.is_azure && var.azure_resource_group_name != "" ? 1 : 0
  name  = var.azure_resource_group_name
}

# GCP Data Sources (only when using GCP)
data "google_project" "current" {
  count = local.is_gcp ? 1 : 0
}

data "google_compute_zones" "available" {
  count  = local.is_gcp ? 1 : 0
  region = var.gcp_region
}

# -----------------------------------------------------------------------------
# Network Module (AWS-specific - for other providers, use their native networking)
# -----------------------------------------------------------------------------

module "network" {
  source = "./modules/network"
  count  = local.is_aws ? 1 : 0

  name_prefix           = local.name_prefix
  vpc_cidr              = var.vpc_cidr
  availability_zones    = var.availability_zones
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  enable_nat_gateway    = var.enable_nat_gateway
  single_nat_gateway    = var.single_nat_gateway
  enable_vpc_endpoints  = var.enable_vpc_endpoints
  aws_region            = var.aws_region

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Security Groups Module (AWS-specific)
# -----------------------------------------------------------------------------

module "security_groups" {
  source = "./modules/security-groups"
  count  = local.is_aws ? 1 : 0

  name_prefix = local.name_prefix
  vpc_id      = module.network[0].vpc_id

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Control Plane Database (arc_saas) - Cloud Agnostic
# -----------------------------------------------------------------------------

module "control_plane_database" {
  source = "./modules/database"

  # Cloud provider selection
  cloud_provider = var.cloud_provider

  name_prefix   = "${local.name_prefix}-control-plane"
  environment   = var.environment
  instance_size = local.instance_size
  database_name = "arc_saas"

  # AWS-specific configuration
  aws_config = local.is_aws ? {
    vpc_id               = module.network[0].vpc_id
    subnet_ids           = module.network[0].database_subnet_ids
    security_group_ids   = [module.security_groups[0].rds_security_group_id]
    engine_version       = var.control_plane_db_engine_version
    instance_class       = var.control_plane_db_instance_class
    allocated_storage    = var.control_plane_db_allocated_storage
    max_allocated_storage = var.control_plane_db_max_allocated_storage
    multi_az             = var.control_plane_db_multi_az
    backup_retention_period = var.control_plane_db_backup_retention_period
    deletion_protection  = local.db_deletion_protection
    skip_final_snapshot  = local.db_skip_final_snapshot
  } : {}

  # Azure-specific configuration
  azure_config = local.is_azure ? {
    resource_group_name = var.azure_resource_group_name
    location            = var.azure_location
    sku_name            = "GP_Standard_D2s_v3"
  } : {}

  # GCP-specific configuration
  gcp_config = local.is_gcp ? {
    project_id = var.gcp_project_id
    region     = var.gcp_region
    tier       = "db-custom-2-4096"
  } : {}

  # Kubernetes-specific configuration
  kubernetes_config = local.is_kubernetes ? {
    namespace        = var.kubernetes_namespace
    storage_class    = var.kubernetes_storage_class
    storage_size     = "20Gi"
    create_namespace = true
  } : {}

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# App Plane Database (Supabase) - Cloud Agnostic
# -----------------------------------------------------------------------------

module "app_plane_database" {
  source = "./modules/database"

  # Cloud provider selection
  cloud_provider = var.cloud_provider

  name_prefix   = "${local.name_prefix}-app-plane"
  environment   = var.environment
  instance_size = local.instance_size
  database_name = "postgres"

  # AWS-specific configuration
  aws_config = local.is_aws ? {
    vpc_id               = module.network[0].vpc_id
    subnet_ids           = module.network[0].database_subnet_ids
    security_group_ids   = [module.security_groups[0].rds_security_group_id]
    engine_version       = var.app_plane_db_engine_version
    instance_class       = var.app_plane_db_instance_class
    allocated_storage    = var.app_plane_db_allocated_storage
    max_allocated_storage = var.app_plane_db_max_allocated_storage
    multi_az             = var.app_plane_db_multi_az
    deletion_protection  = local.db_deletion_protection
    skip_final_snapshot  = local.db_skip_final_snapshot
  } : {}

  # Azure-specific configuration
  azure_config = local.is_azure ? {
    resource_group_name = var.azure_resource_group_name
    location            = var.azure_location
    sku_name            = "GP_Standard_D2s_v3"
  } : {}

  # GCP-specific configuration
  gcp_config = local.is_gcp ? {
    project_id = var.gcp_project_id
    region     = var.gcp_region
    tier       = "db-custom-2-4096"
  } : {}

  # Kubernetes-specific configuration
  kubernetes_config = local.is_kubernetes ? {
    namespace        = var.kubernetes_namespace
    storage_class    = var.kubernetes_storage_class
    storage_size     = "50Gi"
    create_namespace = true
  } : {}

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Components-V2 Database - Cloud Agnostic
# -----------------------------------------------------------------------------

module "components_database" {
  source = "./modules/database"

  # Cloud provider selection
  cloud_provider = var.cloud_provider

  name_prefix   = "${local.name_prefix}-components"
  environment   = var.environment
  instance_size = local.instance_size
  database_name = "components_v2"

  # AWS-specific configuration
  aws_config = local.is_aws ? {
    vpc_id               = module.network[0].vpc_id
    subnet_ids           = module.network[0].database_subnet_ids
    security_group_ids   = [module.security_groups[0].rds_security_group_id]
    engine_version       = var.control_plane_db_engine_version
    instance_class       = var.components_db_instance_class
    allocated_storage    = var.components_db_allocated_storage
    max_allocated_storage = 100
    deletion_protection  = local.db_deletion_protection
    skip_final_snapshot  = local.db_skip_final_snapshot
  } : {}

  # Azure-specific configuration
  azure_config = local.is_azure ? {
    resource_group_name = var.azure_resource_group_name
    location            = var.azure_location
    sku_name            = "GP_Standard_D2s_v3"
  } : {}

  # GCP-specific configuration
  gcp_config = local.is_gcp ? {
    project_id = var.gcp_project_id
    region     = var.gcp_region
    tier       = "db-custom-2-4096"
  } : {}

  # Kubernetes-specific configuration
  kubernetes_config = local.is_kubernetes ? {
    namespace        = var.kubernetes_namespace
    storage_class    = var.kubernetes_storage_class
    storage_size     = "20Gi"
    create_namespace = true
  } : {}

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Cache (Redis) - Cloud Agnostic
# -----------------------------------------------------------------------------

module "cache" {
  source = "./modules/cache"

  # Cloud provider selection
  cloud_provider = var.cloud_provider

  name_prefix   = local.name_prefix
  environment   = var.environment
  instance_size = local.instance_size
  engine_version = var.redis_engine_version

  # High availability based on environment
  high_availability = local.is_production
  replica_count     = local.is_production ? 2 : 0

  # AWS-specific configuration
  aws_config = local.is_aws ? {
    vpc_id                = module.network[0].vpc_id
    subnet_ids            = module.network[0].private_subnet_ids
    security_group_id     = module.security_groups[0].redis_security_group_id
    encryption_at_rest    = true
    encryption_in_transit = true
    maintenance_window    = "sun:05:00-sun:06:00"
    snapshot_window       = "03:00-04:00"
    snapshot_retention_days = local.is_production ? 7 : 1
  } : null

  # Azure-specific configuration
  azure_config = local.is_azure ? {
    resource_group_name     = var.azure_resource_group_name
    location                = var.azure_location
    encryption_in_transit   = true
    enable_private_endpoint = true
  } : null

  # GCP-specific configuration
  gcp_config = local.is_gcp ? {
    project_id            = var.gcp_project_id
    region                = var.gcp_region
    auth_enabled          = true
    encryption_in_transit = true
    enable_persistence    = local.is_production
  } : null

  # Kubernetes-specific configuration
  kubernetes_config = local.is_kubernetes ? {
    namespace           = var.kubernetes_namespace
    create_namespace    = true
    persistence_enabled = true
    storage_class       = var.kubernetes_storage_class
    storage_gb          = local.is_production ? 20 : 5
    enable_monitoring   = true
  } : null

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Service Discovery (AWS Cloud Map - only used for ECS)
# For Kubernetes, service discovery is handled natively via DNS
# -----------------------------------------------------------------------------

module "service_discovery" {
  source = "./modules/service-discovery"
  count  = local.is_aws ? 1 : 0

  name_prefix = local.name_prefix
  vpc_id      = module.network[0].vpc_id

  # HTTP services exposed via ALB
  services = {
    "tenant-management-service" = {
      port              = 14000
      health_check_path = "/health"
    }
    "cns-service" = {
      port              = 27200
      health_check_path = "/health"
    }
    "orchestrator-service" = {
      port              = 14001
      health_check_path = "/health"
    }
    "subscription-service" = {
      port              = 14002
      health_check_path = "/health"
    }
    "keycloak" = {
      port              = 8080
      health_check_path = "/health"
    }
    "temporal-ui" = {
      port              = 8080
      health_check_path = "/"
    }
    "novu" = {
      port              = 3000
      health_check_path = "/v1/health-check"
    }
  }

  # Internal services (gRPC, TCP - no ALB)
  internal_services = {
    "temporal" = {
      port     = 7233
      protocol = "grpc"
    }
  }

  dns_ttl                        = 10
  health_check_failure_threshold = 1

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# ECS Cluster & Services (AWS-specific)
# For Kubernetes deployments, use the compute module instead
# -----------------------------------------------------------------------------

module "ecs" {
  source = "./modules/ecs"
  count  = local.is_aws ? 1 : 0

  name_prefix               = local.name_prefix
  vpc_id                    = module.network[0].vpc_id
  public_subnet_ids         = module.network[0].public_subnet_ids
  private_subnet_ids        = module.network[0].private_subnet_ids

  # Security Groups (from security-groups module)
  alb_security_group_id     = module.security_groups[0].alb_security_group_id
  ecs_security_group_id     = module.security_groups[0].ecs_security_group_id

  enable_container_insights = var.enable_container_insights
  log_retention_days        = var.ecs_log_retention_days

  # Control Plane Service Configuration
  tenant_mgmt_cpu           = var.tenant_mgmt_cpu
  tenant_mgmt_memory        = var.tenant_mgmt_memory
  tenant_mgmt_desired_count = var.tenant_mgmt_desired_count

  # App Plane Service Configuration
  cns_service_cpu           = var.cns_service_cpu
  cns_service_memory        = var.cns_service_memory
  cns_service_desired_count = var.cns_service_desired_count

  # Database connection strings (from secrets - use local values for backward compat)
  control_plane_db_secret_arn = local.control_plane_db_secret_arn
  app_plane_db_secret_arn     = local.app_plane_db_secret_arn
  components_db_secret_arn    = local.components_db_secret_arn
  redis_endpoint              = module.cache.endpoint

  # Service Discovery Integration
  enable_service_discovery  = var.enable_service_discovery
  service_discovery_arns    = module.service_discovery[0].service_arns

  # Auto-scaling
  enable_autoscaling        = var.enable_autoscaling
  autoscaling_min_capacity  = lookup(local.autoscaling_config[var.environment], "min_capacity", var.autoscaling_min_capacity)
  autoscaling_max_capacity  = lookup(local.autoscaling_config[var.environment], "max_capacity", var.autoscaling_max_capacity)
  autoscaling_cpu_target    = var.autoscaling_cpu_target
  autoscaling_memory_target = var.autoscaling_memory_target

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Secrets Management - Cloud Agnostic
# -----------------------------------------------------------------------------

module "secrets" {
  source = "./modules/secrets"

  # Cloud provider selection
  cloud_provider = var.cloud_provider

  name_prefix    = local.name_prefix
  environment    = var.environment
  secrets_prefix = var.secrets_manager_prefix

  # Database secrets (unified interface)
  database_secrets = {
    control_plane = {
      host     = module.control_plane_database.endpoint
      port     = module.control_plane_database.port
      database = "arc_saas"
      username = var.control_plane_db_username
      password = var.control_plane_db_password
      engine   = "postgresql"
    }
    app_plane = {
      host     = module.app_plane_database.endpoint
      port     = module.app_plane_database.port
      database = "postgres"
      username = var.app_plane_db_username
      password = var.app_plane_db_password
      engine   = "postgresql"
    }
    components = {
      host     = module.components_database.endpoint
      port     = module.components_database.port
      database = "components_v2"
      username = var.components_db_username
      password = var.components_db_password
      engine   = "postgresql"
    }
  }

  # Generic secrets (redis endpoint, etc.)
  secrets = {
    redis = {
      description = "Redis connection details"
      value = {
        endpoint = module.cache.endpoint
        port     = module.cache.port
      }
    }
  }

  # AWS-specific configuration
  aws_config = local.is_aws ? {
    enable_rotation     = var.enable_secrets_rotation
    rotation_days       = var.secrets_rotation_days
    recovery_window_days = local.is_production ? 30 : 7
    create_access_policy = true
  } : {}

  # Azure-specific configuration
  azure_config = local.is_azure ? {
    resource_group_name        = var.azure_resource_group_name
    location                   = var.azure_location
    purge_protection_enabled   = local.is_production
    soft_delete_retention_days = local.is_production ? 90 : 7
    enable_rbac_authorization  = true
  } : {}

  # GCP-specific configuration
  gcp_config = local.is_gcp ? {
    project_id       = var.gcp_project_id
    enable_rotation  = var.enable_secrets_rotation
    rotation_period  = "${var.secrets_rotation_days * 24 * 3600}s"
  } : {}

  # Kubernetes-specific configuration
  kubernetes_config = local.is_kubernetes ? {
    namespace        = var.kubernetes_namespace
    create_namespace = true
    use_external_secrets_operator = var.use_external_secrets_operator
  } : {}

  tags = local.common_tags
}

# Local values to provide backward-compatible secret ARN outputs
locals {
  control_plane_db_secret_arn = try(module.secrets.secret_arns["control_plane"], "")
  app_plane_db_secret_arn     = try(module.secrets.secret_arns["app_plane"], "")
  components_db_secret_arn    = try(module.secrets.secret_arns["components"], "")
}

# -----------------------------------------------------------------------------
# Keycloak Module (OAuth2/OIDC Provider) - AWS ECS Deployment
# For Kubernetes deployments, Keycloak is deployed via the compute module
# -----------------------------------------------------------------------------

module "keycloak" {
  source = "./modules/keycloak"
  count  = local.is_aws ? 1 : 0

  name_prefix              = local.name_prefix
  vpc_id                   = module.network[0].vpc_id
  database_subnet_ids      = module.network[0].database_subnet_ids
  private_subnet_ids       = module.network[0].private_subnet_ids
  ecs_cluster_id           = module.ecs[0].cluster_id
  alb_https_listener_arn   = module.ecs[0].alb_https_listener_arn

  # Security Groups
  rds_security_group_id      = module.security_groups[0].rds_security_group_id
  keycloak_security_group_id = module.security_groups[0].keycloak_security_group_id

  # Database Configuration
  db_instance_class  = var.keycloak_db_instance_class
  db_multi_az        = local.is_production
  deletion_protection = local.db_deletion_protection
  skip_final_snapshot = local.db_skip_final_snapshot

  # ECS Configuration
  task_cpu       = var.keycloak_task_cpu
  task_memory    = var.keycloak_task_memory
  desired_count  = var.keycloak_desired_count

  # IAM Roles
  execution_role_arn = module.ecs[0].execution_role_arn
  task_role_arn      = module.ecs[0].task_role_arn

  aws_region        = var.aws_region
  log_retention_days = var.ecs_log_retention_days

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Temporal Module (Workflow Orchestration) - AWS ECS Deployment
# For Kubernetes deployments, Temporal is deployed via the compute module
# -----------------------------------------------------------------------------

module "temporal" {
  source = "./modules/temporal"
  count  = local.is_aws ? 1 : 0

  name_prefix             = local.name_prefix
  vpc_id                  = module.network[0].vpc_id
  database_subnet_ids     = module.network[0].database_subnet_ids
  private_subnet_ids      = module.network[0].private_subnet_ids
  ecs_cluster_id          = module.ecs[0].cluster_id
  alb_https_listener_arn  = module.ecs[0].alb_https_listener_arn

  # Security Groups
  rds_security_group_id      = module.security_groups[0].rds_security_group_id
  temporal_security_group_id = module.security_groups[0].temporal_security_group_id

  # Database Configuration
  db_instance_class  = var.temporal_db_instance_class
  db_multi_az        = local.is_production
  deletion_protection = local.db_deletion_protection
  skip_final_snapshot = local.db_skip_final_snapshot

  # Temporal Configuration
  namespace  = var.temporal_namespace

  # Server ECS Configuration
  server_task_cpu      = var.temporal_server_task_cpu
  server_task_memory   = var.temporal_server_task_memory
  server_desired_count = var.temporal_server_desired_count

  # UI ECS Configuration
  ui_task_cpu      = var.temporal_ui_task_cpu
  ui_task_memory   = var.temporal_ui_task_memory
  ui_desired_count = var.temporal_ui_desired_count

  # IAM Roles
  execution_role_arn = module.ecs[0].execution_role_arn
  task_role_arn      = module.ecs[0].task_role_arn

  aws_region        = var.aws_region
  log_retention_days = var.ecs_log_retention_days

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# App Plane Module (Additional Services) - AWS-specific
# For Kubernetes, these services are deployed via the compute module
# -----------------------------------------------------------------------------

module "app_plane" {
  source = "./modules/app-plane"
  count  = local.is_aws ? 1 : 0

  name_prefix          = local.name_prefix
  vpc_id               = module.network[0].vpc_id
  private_subnet_ids   = module.network[0].private_subnet_ids
  ecs_cluster_id       = module.ecs[0].cluster_id

  # Amazon MQ (RabbitMQ)
  mq_instance_type     = var.mq_instance_type
  mq_engine_version    = var.mq_engine_version
  mq_deployment_mode   = var.mq_deployment_mode

  # S3 Buckets
  s3_bucket_prefix     = var.s3_bucket_prefix
  enable_s3_versioning = var.enable_s3_versioning
  s3_lifecycle_days    = var.s3_lifecycle_days

  tags = local.common_tags
}

# =============================================================================
# Kubernetes Compute Module (Cloud-Agnostic)
# =============================================================================
# This module deploys all services to Kubernetes (EKS, AKS, GKE, or standalone K8s)
# Used when cloud_provider = "kubernetes" or when using managed K8s on any cloud
# =============================================================================

module "compute" {
  source = "./modules/compute"
  count  = local.is_kubernetes ? 1 : 0

  cloud_provider = "kubernetes"

  name_prefix   = local.name_prefix
  environment   = var.environment
  instance_size = local.instance_size
  labels        = local.common_tags

  # Kubernetes-specific configuration
  kubernetes_config = {
    namespace        = var.kubernetes_namespace
    create_namespace = true

    # Service account configuration
    create_service_account      = true
    service_account_annotations = {}

    # Image pull secrets (if using private registry)
    image_pull_secrets = var.kubernetes_image_pull_secrets

    # Pod security context
    pod_security_context = {
      run_as_non_root = true
      fs_group        = 1000
    }

    # Scheduling
    node_selector = var.kubernetes_node_selector
    tolerations   = var.kubernetes_tolerations

    # Ingress configuration
    ingress_class_name = var.kubernetes_ingress_class
    ingress_annotations = {
      "kubernetes.io/ingress.class"                = var.kubernetes_ingress_class
      "nginx.ingress.kubernetes.io/ssl-redirect"   = "true"
    }

    # Monitoring
    prometheus_operator_enabled = var.enable_prometheus_operator
  }

  # Services configuration
  services = {
    # Control Plane Services
    "tenant-management-service" = {
      image     = var.tenant_mgmt_image
      component = "control-plane"
      replicas  = local.is_production ? 3 : 1

      ports = [{
        name = "http"
        port = 14000
      }]

      env_vars = {
        NODE_ENV           = var.environment
        DATABASE_HOST      = module.control_plane_database.endpoint
        DATABASE_PORT      = tostring(module.control_plane_database.port)
        DATABASE_NAME      = "arc_saas"
        REDIS_HOST         = module.cache.endpoint
        REDIS_PORT         = tostring(module.cache.port)
      }

      liveness_probe = {
        type                  = "http"
        path                  = "/health"
        port                  = 14000
        initial_delay_seconds = 30
        period_seconds        = 10
      }

      readiness_probe = {
        type                  = "http"
        path                  = "/health"
        port                  = 14000
        initial_delay_seconds = 5
        period_seconds        = 5
      }

      autoscaling_enabled      = local.is_production
      autoscaling_min_replicas = local.is_production ? 2 : 1
      autoscaling_max_replicas = local.is_production ? 10 : 3
      autoscaling_cpu_threshold = 70

      ingress_enabled = true
      ingress_host    = "api.${var.domain_name}"
      ingress_path    = "/"
    }

    # CNS Service
    "cns-service" = {
      image     = var.cns_service_image
      component = "app-plane"
      replicas  = local.is_production ? 3 : 1

      ports = [{
        name = "http"
        port = 27200
      }]

      env_vars = {
        ENVIRONMENT          = var.environment
        SUPABASE_DB_HOST     = module.app_plane_database.endpoint
        SUPABASE_DB_PORT     = tostring(module.app_plane_database.port)
        COMPONENTS_DB_HOST   = module.components_database.endpoint
        COMPONENTS_DB_PORT   = tostring(module.components_database.port)
        REDIS_HOST           = module.cache.endpoint
        REDIS_PORT           = tostring(module.cache.port)
      }

      liveness_probe = {
        type                  = "http"
        path                  = "/health"
        port                  = 27200
        initial_delay_seconds = 30
        period_seconds        = 10
      }

      readiness_probe = {
        type                  = "http"
        path                  = "/health"
        port                  = 27200
        initial_delay_seconds = 5
        period_seconds        = 5
      }

      autoscaling_enabled      = local.is_production
      autoscaling_min_replicas = local.is_production ? 2 : 1
      autoscaling_max_replicas = local.is_production ? 10 : 3
      autoscaling_cpu_threshold = 70

      ingress_enabled = true
      ingress_host    = "cns.${var.domain_name}"
      ingress_path    = "/"
    }

    # Keycloak (for K8s deployments)
    "keycloak" = {
      image     = "quay.io/keycloak/keycloak:${var.keycloak_version}"
      component = "auth"
      replicas  = local.is_production ? 2 : 1

      ports = [{
        name = "http"
        port = 8080
      }]

      env_vars = {
        KC_DB           = "postgres"
        KC_DB_URL_HOST  = module.control_plane_database.endpoint
        KC_DB_URL_PORT  = tostring(module.control_plane_database.port)
        KC_DB_URL_DATABASE = "keycloak"
        KC_HEALTH_ENABLED  = "true"
        KC_METRICS_ENABLED = "true"
      }

      liveness_probe = {
        type                  = "http"
        path                  = "/health/live"
        port                  = 8080
        initial_delay_seconds = 60
        period_seconds        = 30
      }

      readiness_probe = {
        type                  = "http"
        path                  = "/health/ready"
        port                  = 8080
        initial_delay_seconds = 30
        period_seconds        = 10
      }

      pdb_enabled       = local.is_production
      pdb_min_available = "50%"

      ingress_enabled = true
      ingress_host    = "auth.${var.domain_name}"
      ingress_path    = "/"
    }

    # Temporal Server (for K8s deployments)
    "temporal" = {
      image     = "temporalio/auto-setup:${var.temporal_version}"
      component = "workflow"
      replicas  = local.is_production ? 2 : 1

      ports = [
        {
          name = "grpc"
          port = 7233
        },
        {
          name = "http"
          port = 7234
        }
      ]

      env_vars = {
        DB              = "postgresql"
        DB_PORT         = tostring(module.control_plane_database.port)
        POSTGRES_SEEDS  = module.control_plane_database.endpoint
        TEMPORAL_NAMESPACE = var.temporal_namespace
      }

      liveness_probe = {
        type    = "tcp"
        port    = 7233
        initial_delay_seconds = 60
        period_seconds        = 30
      }

      readiness_probe = {
        type    = "tcp"
        port    = 7233
        initial_delay_seconds = 30
        period_seconds        = 10
      }

      pdb_enabled       = local.is_production
      pdb_min_available = "1"
    }

    # Temporal UI
    "temporal-ui" = {
      image     = "temporalio/ui:${var.temporal_ui_version}"
      component = "workflow"
      replicas  = 1

      ports = [{
        name = "http"
        port = 8080
      }]

      env_vars = {
        TEMPORAL_ADDRESS     = "temporal:7233"
        TEMPORAL_UI_PORT     = "8080"
      }

      liveness_probe = {
        type                  = "http"
        path                  = "/"
        port                  = 8080
        initial_delay_seconds = 30
        period_seconds        = 10
      }

      ingress_enabled = true
      ingress_host    = "temporal.${var.domain_name}"
      ingress_path    = "/"
    }
  }

  # ConfigMap data shared across services
  config_data = {
    ENVIRONMENT      = var.environment
    LOG_LEVEL        = local.is_production ? "info" : "debug"
    CONTROL_PLANE_DB = module.control_plane_database.endpoint
    APP_PLANE_DB     = module.app_plane_database.endpoint
    COMPONENTS_DB    = module.components_database.endpoint
    REDIS_ENDPOINT   = module.cache.endpoint
  }
}
