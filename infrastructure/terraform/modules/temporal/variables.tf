# =============================================================================
# Temporal Module Variables
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

variable "temporal_security_group_id" {
  description = "Security group ID for Temporal service"
  type        = string
}

# Database Configuration
variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "RDS instance class for Temporal database"
  type        = string
  default     = "db.t3.small"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB for Temporal database"
  type        = number
  default     = 50
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

# Temporal Configuration
variable "temporal_server_image" {
  description = "Temporal server Docker image"
  type        = string
  default     = "temporalio/auto-setup:1.22.4"
}

variable "temporal_ui_image" {
  description = "Temporal UI Docker image"
  type        = string
  default     = "temporalio/ui:2.21.3"
}

variable "namespace" {
  description = "Temporal namespace for workflows"
  type        = string
  default     = "arc-saas"
}

variable "task_queue" {
  description = "Default task queue name"
  type        = string
  default     = "tenant-provisioning"
}

variable "log_level" {
  description = "Temporal server log level"
  type        = string
  default     = "info"
}

# Server Task Configuration
variable "server_task_cpu" {
  description = "CPU units for Temporal server task"
  type        = number
  default     = 1024
}

variable "server_task_memory" {
  description = "Memory in MB for Temporal server task"
  type        = number
  default     = 2048
}

variable "server_desired_count" {
  description = "Desired number of Temporal server tasks"
  type        = number
  default     = 1
}

# UI Task Configuration
variable "ui_task_cpu" {
  description = "CPU units for Temporal UI task"
  type        = number
  default     = 256
}

variable "ui_task_memory" {
  description = "Memory in MB for Temporal UI task"
  type        = number
  default     = 512
}

variable "ui_desired_count" {
  description = "Desired number of Temporal UI tasks"
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
