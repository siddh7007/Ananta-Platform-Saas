# =============================================================================
# Example: Secrets Module with Automatic Rotation Enabled
# =============================================================================
# This example demonstrates how to use the secrets module with automatic
# rotation enabled for production environments.
#
# Prerequisites:
# 1. Build the psycopg2 Lambda layer:
#    cd ../lambda && ./build-layer.sh
# 2. Ensure VPC has private subnets with NAT gateway
# 3. Verify RDS security groups allow Lambda access
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# =============================================================================
# Local Variables
# =============================================================================

locals {
  environment = "prod"
  project     = "ananta-platform"

  common_tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "Terraform"
    Module      = "secrets"
  }
}

# =============================================================================
# Data Sources
# =============================================================================

# Assume these resources exist in your infrastructure
data "aws_vpc" "main" {
  tags = {
    Name = "${local.environment}-vpc"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Type = "private"
  }
}

data "aws_db_instance" "control_plane" {
  db_instance_identifier = "${local.environment}-control-plane-db"
}

data "aws_db_instance" "app_plane" {
  db_instance_identifier = "${local.environment}-app-plane-db"
}

data "aws_db_instance" "components" {
  db_instance_identifier = "${local.environment}-components-db"
}

data "aws_elasticache_cluster" "redis" {
  cluster_id = "${local.environment}-redis"
}

data "aws_kms_key" "secrets" {
  key_id = "alias/${local.environment}-secrets"
}

data "aws_security_group" "rds_control_plane" {
  name = "${local.environment}-control-plane-db-sg"
}

data "aws_security_group" "rds_app_plane" {
  name = "${local.environment}-app-plane-db-sg"
}

data "aws_security_group" "rds_components" {
  name = "${local.environment}-components-db-sg"
}

# =============================================================================
# Secrets Module with Rotation Enabled
# =============================================================================

module "secrets" {
  source = "../"

  # Basic configuration
  name_prefix            = local.environment
  secrets_manager_prefix = "ananta"

  # Enable automatic rotation
  enable_rotation = true
  rotation_days   = 30  # Rotate every 30 days
  aws_region      = "us-east-1"

  # Recovery window for deleted secrets
  recovery_window_days = 7

  # VPC configuration for rotation Lambda
  vpc_id     = data.aws_vpc.main.id
  subnet_ids = data.aws_subnets.private.ids

  # RDS security groups - Lambda needs access
  rds_security_group_ids = [
    data.aws_security_group.rds_control_plane.id,
    data.aws_security_group.rds_app_plane.id,
    data.aws_security_group.rds_components.id
  ]

  # RDS instance ARNs for IAM policy
  rds_instance_arns = [
    data.aws_db_instance.control_plane.db_instance_arn,
    data.aws_db_instance.app_plane.db_instance_arn,
    data.aws_db_instance.components.db_instance_arn
  ]

  # KMS key for secret encryption
  kms_key_arn = data.aws_kms_key.secrets.arn

  # Control Plane Database
  control_plane_db_host     = data.aws_db_instance.control_plane.address
  control_plane_db_port     = data.aws_db_instance.control_plane.port
  control_plane_db_name     = "arc_saas"
  control_plane_db_password = var.control_plane_db_password

  # App Plane Database (Supabase)
  app_plane_db_host     = data.aws_db_instance.app_plane.address
  app_plane_db_port     = data.aws_db_instance.app_plane.port
  app_plane_db_name     = "postgres"
  app_plane_db_password = var.app_plane_db_password

  # Components-V2 Database
  components_db_host     = data.aws_db_instance.components.address
  components_db_port     = data.aws_db_instance.components.port
  components_db_name     = "components_v2"
  components_db_password = var.components_db_password

  # Redis
  redis_endpoint = data.aws_elasticache_cluster.redis.cache_nodes[0].address
  redis_port     = data.aws_elasticache_cluster.redis.cache_nodes[0].port

  # External API keys (optional)
  novu_api_key          = var.novu_api_key
  stripe_api_key        = var.stripe_api_key
  openai_api_key        = var.openai_api_key
  anthropic_api_key     = var.anthropic_api_key
  digikey_client_id     = var.digikey_client_id
  digikey_client_secret = var.digikey_client_secret
  mouser_api_key        = var.mouser_api_key

  tags = local.common_tags
}

# =============================================================================
# CloudWatch Alarms for Rotation Monitoring
# =============================================================================

resource "aws_sns_topic" "rotation_alerts" {
  name = "${local.environment}-secrets-rotation-alerts"
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "rotation_alerts_email" {
  topic_arn = aws_sns_topic.rotation_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "rotation_failures" {
  alarm_name          = "${local.environment}-secrets-rotation-failures"
  alarm_description   = "Alert when secret rotation fails"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = module.secrets.rotation_lambda_name
  }

  alarm_actions = [aws_sns_topic.rotation_alerts.arn]
  tags          = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rotation_duration" {
  alarm_name          = "${local.environment}-secrets-rotation-duration"
  alarm_description   = "Alert when rotation takes too long"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 240000  # 4 minutes (Lambda timeout is 5 min)
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = module.secrets.rotation_lambda_name
  }

  alarm_actions = [aws_sns_topic.rotation_alerts.arn]
  tags          = local.common_tags
}

# =============================================================================
# Example: Attach to ECS Task Role
# =============================================================================

data "aws_iam_role" "ecs_task" {
  name = "${local.environment}-ecs-task-role"
}

resource "aws_iam_role_policy_attachment" "ecs_secrets_access" {
  role       = data.aws_iam_role.ecs_task.name
  policy_arn = module.secrets.secrets_access_policy_arn
}

# =============================================================================
# Variables
# =============================================================================

variable "control_plane_db_password" {
  description = "Control plane database password"
  type        = string
  sensitive   = true
}

variable "app_plane_db_password" {
  description = "App plane database password"
  type        = string
  sensitive   = true
}

variable "components_db_password" {
  description = "Components database password"
  type        = string
  sensitive   = true
}

variable "novu_api_key" {
  description = "Novu API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_api_key" {
  description = "Stripe API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "digikey_client_id" {
  description = "DigiKey client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "digikey_client_secret" {
  description = "DigiKey client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mouser_api_key" {
  description = "Mouser API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "alert_email" {
  description = "Email address for rotation alerts"
  type        = string
}

# =============================================================================
# Outputs
# =============================================================================

output "secret_arns" {
  description = "All secret ARNs"
  value       = module.secrets.all_secret_arns
}

output "rotation_lambda_arn" {
  description = "Rotation Lambda ARN"
  value       = module.secrets.rotation_lambda_arn
}

output "rotation_enabled" {
  description = "Whether rotation is enabled"
  value       = module.secrets.rotation_enabled
}

output "rotation_schedule" {
  description = "Rotation schedule"
  value       = "${module.secrets.rotation_schedule_days} days"
}
