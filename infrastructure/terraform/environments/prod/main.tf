# =============================================================================
# Production Environment - Main Configuration
# =============================================================================
# This is a stub file to enable Infracost cost estimation.
# The actual infrastructure is defined in the modules.
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# Import all variables
variable "project_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "tags" { type = map(string) }
variable "vpc_cidr" { type = string }
variable "availability_zones" { type = list(string) }
variable "public_subnet_cidrs" { type = list(string) }
variable "private_subnet_cidrs" { type = list(string) }
variable "database_subnet_cidrs" { type = list(string) }
variable "enable_nat_gateway" { type = bool }
variable "single_nat_gateway" { type = bool }

# Database variables
variable "control_plane_db_instance_class" { type = string }
variable "control_plane_db_allocated_storage" { type = number }
variable "control_plane_db_max_allocated_storage" { type = number }
variable "control_plane_db_engine_version" { type = string }
variable "control_plane_db_multi_az" { type = bool }
variable "control_plane_db_backup_retention_period" { type = number }
variable "app_plane_db_instance_class" { type = string }
variable "app_plane_db_allocated_storage" { type = number }
variable "app_plane_db_max_allocated_storage" { type = number }
variable "app_plane_db_engine_version" { type = string }
variable "app_plane_db_multi_az" { type = bool }
variable "components_db_instance_class" { type = string }
variable "components_db_allocated_storage" { type = number }

# Redis variables
variable "redis_node_type" { type = string }
variable "redis_num_cache_nodes" { type = number }
variable "redis_engine_version" { type = string }
variable "redis_parameter_group_family" { type = string }
variable "redis_automatic_failover_enabled" { type = bool }

# ECS variables
variable "ecs_cluster_name" { type = string }
variable "enable_container_insights" { type = bool }
variable "ecs_log_retention_days" { type = number }
variable "tenant_mgmt_cpu" { type = number }
variable "tenant_mgmt_memory" { type = number }
variable "tenant_mgmt_desired_count" { type = number }
variable "cns_service_cpu" { type = number }
variable "cns_service_memory" { type = number }
variable "cns_service_desired_count" { type = number }

output "environment" {
  value = var.environment
}

output "region" {
  value = var.aws_region
}
