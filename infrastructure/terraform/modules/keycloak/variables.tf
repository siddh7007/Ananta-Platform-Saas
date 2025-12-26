# =============================================================================
# Keycloak Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "database_subnet_ids" {
  description = "List of database subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_cluster_id" {
  description = "ECS cluster ID"
  type        = string
}

variable "alb_https_listener_arn" {
  description = "ARN of the HTTPS listener on the ALB"
  type        = string
}

# Security Groups
variable "rds_security_group_id" {
  description = "Security group ID for RDS database"
  type        = string
}

variable "keycloak_security_group_id" {
  description = "Security group ID for Keycloak service"
  type        = string
}

# Database Configuration
variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "RDS instance class for Keycloak database"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB for Keycloak database"
  type        = number
  default     = 20
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for database"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection for database"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when deleting database"
  type        = bool
  default     = false
}

# Keycloak Configuration
variable "keycloak_image" {
  description = "Keycloak Docker image"
  type        = string
  default     = "quay.io/keycloak/keycloak:23.0"
}

variable "admin_username" {
  description = "Keycloak admin username"
  type        = string
  default     = "admin"
}

variable "task_cpu" {
  description = "CPU units for Keycloak task"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Memory in MB for Keycloak task"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of Keycloak tasks"
  type        = number
  default     = 1
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# IAM Roles
variable "execution_role_arn" {
  description = "ARN of ECS task execution role"
  type        = string
}

variable "task_role_arn" {
  description = "ARN of ECS task role"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
