# =============================================================================
# ARC-SAAS Staging Environment Configuration
# =============================================================================
# Staging environment - mirrors production but with reduced capacity
# Used for QA testing and pre-production validation
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }

  backend "s3" {
    bucket         = "arc-saas-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "arc-saas-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Team        = "platform"
    }
  }
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "arc-saas"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "staging.arc-saas.example.com"
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

module "network" {
  source = "../../modules/network"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = "10.1.0.0/16"  # Different CIDR from dev
  az_count             = 2
  enable_nat_gateway   = true
  single_nat_gateway   = true  # Single NAT for staging (cost saving)
  enable_vpc_endpoints = true

  tags = {
    CostCenter = "staging"
  }
}

# -----------------------------------------------------------------------------
# Database (RDS PostgreSQL)
# -----------------------------------------------------------------------------

module "database" {
  source = "../../modules/database"

  project_name           = var.project_name
  environment            = var.environment
  vpc_id                 = module.network.vpc_id
  subnet_ids             = module.network.database_subnet_ids
  security_group_id      = module.network.database_security_group_id
  db_subnet_group_name   = module.network.database_subnet_group_name

  # Staging settings - moderate capacity
  db_instance_class      = "db.t3.medium"
  allocated_storage      = 50
  max_allocated_storage  = 200
  multi_az               = false  # Single AZ for staging
  backup_retention_days  = 7
  deletion_protection    = true   # Protect staging data

  # Enhanced monitoring enabled for staging
  monitoring_interval    = 60
  performance_insights   = true

  tags = {
    CostCenter = "staging"
  }
}

# -----------------------------------------------------------------------------
# Redis (ElastiCache)
# -----------------------------------------------------------------------------

module "elasticache" {
  source = "../../modules/elasticache"

  project_name               = var.project_name
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  security_group_id          = module.network.redis_security_group_id
  elasticache_subnet_group_name = module.network.elasticache_subnet_group_name

  # Staging settings
  node_type                  = "cache.t3.small"
  num_cache_clusters         = 2  # Primary + 1 replica
  transit_encryption_enabled = true

  tags = {
    CostCenter = "staging"
  }
}

# -----------------------------------------------------------------------------
# ECS Cluster
# -----------------------------------------------------------------------------

module "ecs" {
  source = "../../modules/ecs"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  private_subnet_ids    = module.network.private_subnet_ids
  alb_security_group_id = module.network.alb_security_group_id
  ecs_security_group_id = module.network.ecs_security_group_id

  # Staging: Use Fargate Spot for cost savings but with some on-demand
  capacity_provider_strategy = [
    {
      capacity_provider = "FARGATE_SPOT"
      weight            = 2
      base              = 0
    },
    {
      capacity_provider = "FARGATE"
      weight            = 1
      base              = 1  # At least 1 on-demand for stability
    }
  ]

  # Enable Container Insights for staging
  enable_container_insights = true

  # SSL Certificate (use ACM certificate ARN)
  # certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

  tags = {
    CostCenter = "staging"
  }
}

# -----------------------------------------------------------------------------
# Keycloak
# -----------------------------------------------------------------------------

module "keycloak" {
  source = "../../modules/keycloak"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  ecs_cluster_id        = module.ecs.cluster_id
  ecs_cluster_name      = module.ecs.cluster_name
  alb_listener_arn      = module.ecs.alb_listener_arn
  alb_security_group_id = module.network.alb_security_group_id
  ecs_security_group_id = module.network.ecs_security_group_id
  service_discovery_namespace_id = module.ecs.service_discovery_namespace_id

  # Database connection
  db_host     = module.database.db_endpoint
  db_name     = "keycloak"
  db_username = "keycloak"
  db_password_secret_arn = module.database.db_credentials_secret_arn

  # Staging settings
  keycloak_cpu    = 512
  keycloak_memory = 1024
  desired_count   = 1

  keycloak_admin_user     = "admin"
  keycloak_admin_password = "CHANGE_ME_IN_SECRETS_MANAGER"

  tags = {
    CostCenter = "staging"
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.ecs.alb_dns_name
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.db_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.elasticache.redis_endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "service_discovery_namespace" {
  description = "Service discovery namespace"
  value       = module.ecs.service_discovery_namespace
}

output "keycloak_url" {
  description = "Keycloak URL"
  value       = "https://${var.domain_name}/auth"
}
