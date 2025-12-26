# =============================================================================
# ARC-SaaS Development Environment
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }

  # Uncomment for remote state storage
  # backend "s3" {
  #   bucket         = "arc-saas-terraform-state"
  #   key            = "dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "arc-saas-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# -----------------------------------------------------------------------------
# Network Module
# -----------------------------------------------------------------------------

module "network" {
  source = "../../modules/network"

  project_name         = var.project_name
  environment          = var.environment
  aws_region           = var.aws_region
  vpc_cidr             = var.vpc_cidr
  az_count             = var.az_count
  enable_nat_gateway   = var.enable_nat_gateway
  single_nat_gateway   = true # Cost saving for dev
  enable_vpc_endpoints = var.enable_vpc_endpoints
  tags                 = local.common_tags
}

# -----------------------------------------------------------------------------
# Database Module
# -----------------------------------------------------------------------------

module "database" {
  source = "../../modules/database"

  project_name                 = var.project_name
  environment                  = var.environment
  db_instance_class            = var.db_instance_class
  db_name                      = "arc_saas"
  db_username                  = "arc_admin"
  allocated_storage            = 20
  max_allocated_storage        = 50
  multi_az                     = false # Cost saving for dev
  backup_retention_days        = 3
  enable_performance_insights  = false
  enhanced_monitoring_interval = 0
  enable_cloudwatch_alarms     = false
  db_subnet_group_name         = module.network.db_subnet_group_name
  security_group_ids           = [module.network.database_security_group_id]
  tags                         = local.common_tags
}

# -----------------------------------------------------------------------------
# ElastiCache Module
# -----------------------------------------------------------------------------

module "elasticache" {
  source = "../../modules/elasticache"

  project_name               = var.project_name
  environment                = var.environment
  node_type                  = var.redis_node_type
  num_cache_clusters         = 1 # Single node for dev
  transit_encryption_enabled = true
  snapshot_retention_days    = 1
  enable_cloudwatch_alarms   = false
  subnet_group_name          = module.network.elasticache_subnet_group_name
  security_group_ids         = [module.network.redis_security_group_id]
  tags                       = local.common_tags
}

# -----------------------------------------------------------------------------
# ECS Module
# -----------------------------------------------------------------------------

module "ecs" {
  source = "../../modules/ecs"

  project_name              = var.project_name
  environment               = var.environment
  aws_region                = var.aws_region
  vpc_id                    = module.network.vpc_id
  public_subnet_ids         = module.network.public_subnet_ids
  private_subnet_ids        = module.network.private_subnet_ids
  alb_security_group_id     = module.network.alb_security_group_id
  ecs_security_group_id     = module.network.ecs_security_group_id
  enable_container_insights = false # Cost saving for dev
  log_retention_days        = 7
  enable_autoscaling        = false
  certificate_arn           = var.certificate_arn
  secrets_arns = [
    module.database.db_credentials_secret_arn,
    module.elasticache.redis_credentials_secret_arn
  ]
  db_credentials_secret_arn    = module.database.db_credentials_secret_arn
  redis_credentials_secret_arn = module.elasticache.redis_credentials_secret_arn
  tags                         = local.common_tags
}

# -----------------------------------------------------------------------------
# Keycloak Module
# -----------------------------------------------------------------------------

module "keycloak" {
  source = "../../modules/keycloak"

  project_name                   = var.project_name
  environment                    = var.environment
  aws_region                     = var.aws_region
  vpc_id                         = module.network.vpc_id
  private_subnet_ids             = module.network.private_subnet_ids
  security_group_ids             = [module.network.ecs_security_group_id]
  cluster_id                     = module.ecs.cluster_id
  cluster_name                   = module.ecs.cluster_name
  listener_arn                   = module.ecs.https_listener_arn != null ? module.ecs.https_listener_arn : module.ecs.http_listener_arn
  task_execution_role_arn        = module.ecs.task_execution_role_arn
  task_role_arn                  = module.ecs.task_role_arn
  service_discovery_namespace_id = module.ecs.service_discovery_namespace_id
  service_discovery_namespace    = module.ecs.service_discovery_namespace_name
  keycloak_hostname              = var.keycloak_hostname
  db_host                        = module.database.db_address
  db_credentials_secret_arn      = module.database.db_credentials_secret_arn
  enable_autoscaling             = false
  tags                           = local.common_tags
}
