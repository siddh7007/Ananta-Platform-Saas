# =============================================================================
# ARC-SaaS Keycloak Module - Variables
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "arc-saas"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "keycloak_version" {
  description = "Keycloak version"
  type        = string
  default     = "23.0"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "cluster_id" {
  description = "ECS cluster ID"
  type        = string
}

variable "cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "listener_arn" {
  description = "ALB listener ARN"
  type        = string
}

variable "task_execution_role_arn" {
  description = "ECS task execution role ARN"
  type        = string
}

variable "task_role_arn" {
  description = "ECS task role ARN"
  type        = string
}

variable "service_discovery_namespace_id" {
  description = "Service discovery namespace ID"
  type        = string
}

variable "service_discovery_namespace" {
  description = "Service discovery namespace name"
  type        = string
}

variable "keycloak_hostname" {
  description = "Hostname for Keycloak"
  type        = string
}

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "keycloak"
}

variable "db_credentials_secret_arn" {
  description = "ARN of database credentials secret"
  type        = string
}

variable "admin_username" {
  description = "Keycloak admin username"
  type        = string
  default     = "admin"
}

variable "admin_password" {
  description = "Keycloak admin password (if null, will be generated)"
  type        = string
  default     = null
  sensitive   = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_autoscaling" {
  description = "Enable auto scaling"
  type        = bool
  default     = true
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 3
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
