# =============================================================================
# Development Environment - Main Configuration
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

# Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# Variables (loaded from ../dev.tfvars)
variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs"
  type        = list(string)
}

variable "database_subnet_cidrs" {
  description = "Database subnet CIDRs"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway"
  type        = bool
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway"
  type        = bool
}

# Database variables
variable "control_plane_db_instance_class" {
  description = "Control plane DB instance class"
  type        = string
}

variable "control_plane_db_allocated_storage" {
  description = "Control plane DB storage in GB"
  type        = number
}

variable "control_plane_db_max_allocated_storage" {
  description = "Control plane DB max storage in GB"
  type        = number
}

variable "control_plane_db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
}

variable "control_plane_db_multi_az" {
  description = "Enable Multi-AZ"
  type        = bool
}

variable "control_plane_db_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
}

# Additional database instances
variable "app_plane_db_instance_class" {
  type = string
}

variable "app_plane_db_allocated_storage" {
  type = number
}

variable "app_plane_db_max_allocated_storage" {
  type = number
}

variable "app_plane_db_engine_version" {
  type = string
}

variable "app_plane_db_multi_az" {
  type = bool
}

variable "components_db_instance_class" {
  type = string
}

variable "components_db_allocated_storage" {
  type = number
}

# Redis variables
variable "redis_node_type" {
  type = string
}

variable "redis_num_cache_nodes" {
  type = number
}

variable "redis_engine_version" {
  type = string
}

variable "redis_parameter_group_family" {
  type = string
}

variable "redis_automatic_failover_enabled" {
  type = bool
}

# ECS variables
variable "ecs_cluster_name" {
  type = string
}

variable "enable_container_insights" {
  type = bool
}

variable "ecs_log_retention_days" {
  type = number
}

variable "tenant_mgmt_cpu" {
  type = number
}

variable "tenant_mgmt_memory" {
  type = number
}

variable "tenant_mgmt_desired_count" {
  type = number
}

variable "cns_service_cpu" {
  type = number
}

variable "cns_service_memory" {
  type = number
}

variable "cns_service_desired_count" {
  type = number
}

# Outputs for cost estimation reference
output "environment" {
  value = var.environment
}

output "region" {
  value = var.aws_region
}
