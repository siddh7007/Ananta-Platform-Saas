# =============================================================================
# ARC-SAAS Production Environment Configuration
# =============================================================================
# Production environment - high availability, multi-AZ, full monitoring
# All features enabled with production-grade security
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
    key            = "prod/terraform.tfstate"
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
      Compliance  = "required"
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
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "arc-saas.example.com"
}

variable "certificate_arn" {
  description = "ACM Certificate ARN for HTTPS"
  type        = string
}

# -----------------------------------------------------------------------------
# Networking - Production Grade
# -----------------------------------------------------------------------------

module "network" {
  source = "../../modules/network"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = "10.0.0.0/16"
  az_count             = 3  # 3 AZs for production
  enable_nat_gateway   = true
  single_nat_gateway   = false  # One NAT per AZ for HA
  enable_vpc_endpoints = true

  tags = {
    CostCenter  = "production"
    Compliance  = "required"
  }
}

# -----------------------------------------------------------------------------
# Database (RDS PostgreSQL) - Production Grade
# -----------------------------------------------------------------------------

module "database" {
  source = "../../modules/database"

  project_name           = var.project_name
  environment            = var.environment
  vpc_id                 = module.network.vpc_id
  subnet_ids             = module.network.database_subnet_ids
  security_group_id      = module.network.database_security_group_id
  db_subnet_group_name   = module.network.database_subnet_group_name

  # Production settings - high capacity
  postgres_version       = "15.4"
  db_instance_class      = "db.r6g.large"  # Production-grade instance
  allocated_storage      = 100
  max_allocated_storage  = 1000
  multi_az               = true   # Multi-AZ for HA
  backup_retention_days  = 30     # 30 days retention
  deletion_protection    = true   # Prevent accidental deletion

  # Full monitoring enabled
  monitoring_interval    = 30
  performance_insights   = true
  performance_insights_retention_period = 7

  # Enable enhanced logging
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    CostCenter  = "production"
    Compliance  = "required"
    Backup      = "critical"
  }
}

# -----------------------------------------------------------------------------
# Redis (ElastiCache) - Production Grade
# -----------------------------------------------------------------------------

module "elasticache" {
  source = "../../modules/elasticache"

  project_name               = var.project_name
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  security_group_id          = module.network.redis_security_group_id
  elasticache_subnet_group_name = module.network.elasticache_subnet_group_name

  # Production settings
  redis_version              = "7.0"
  node_type                  = "cache.r6g.large"
  num_cache_clusters         = 3  # Primary + 2 replicas for HA
  automatic_failover_enabled = true
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true

  # Maintenance window during low-traffic hours
  maintenance_window         = "sun:05:00-sun:06:00"
  snapshot_retention_limit   = 7

  tags = {
    CostCenter  = "production"
    Compliance  = "required"
  }
}

# -----------------------------------------------------------------------------
# ECS Cluster - Production Grade
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

  # Production: Use only on-demand Fargate for reliability
  capacity_provider_strategy = [
    {
      capacity_provider = "FARGATE"
      weight            = 1
      base              = 2  # Minimum 2 tasks always running
    }
  ]

  # Full monitoring
  enable_container_insights = true

  # SSL Certificate
  certificate_arn = var.certificate_arn

  # Enable access logging
  enable_access_logs = true
  access_logs_bucket = "arc-saas-prod-alb-logs"

  # WAF integration
  # waf_web_acl_arn = aws_wafv2_web_acl.main.arn

  tags = {
    CostCenter  = "production"
    Compliance  = "required"
  }
}

# -----------------------------------------------------------------------------
# Keycloak - Production Grade
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

  # Production settings - high capacity
  keycloak_cpu    = 1024
  keycloak_memory = 2048
  desired_count   = 2  # Multiple instances for HA

  # Admin credentials from Secrets Manager
  keycloak_admin_user_secret_arn     = "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:keycloak-admin"
  keycloak_admin_password_secret_arn = "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:keycloak-admin"

  tags = {
    CostCenter  = "production"
    Compliance  = "required"
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms - Production Monitoring
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB 5XX errors exceeded threshold"

  dimensions = {
    LoadBalancer = module.ecs.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_target_response_time" {
  alarm_name          = "${var.project_name}-${var.environment}-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 2  # 2 seconds
  alarm_description   = "Average response time exceeded 2 seconds"

  dimensions = {
    LoadBalancer = module.ecs.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
  }
}

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${var.environment}-alerts"

  tags = {
    Environment = var.environment
  }
}

# -----------------------------------------------------------------------------
# Route53 DNS Records
# -----------------------------------------------------------------------------

data "aws_route53_zone" "main" {
  name         = "example.com"  # Replace with your domain
  private_zone = false
}

resource "aws_route53_record" "main" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.ecs.alb_dns_name
    zone_id                = module.ecs.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = module.ecs.alb_dns_name
    zone_id                = module.ecs.alb_zone_id
    evaluate_target_health = true
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

output "application_url" {
  description = "Application URL"
  value       = "https://${var.domain_name}"
}

output "api_url" {
  description = "API URL"
  value       = "https://api.${var.domain_name}"
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

output "alerts_sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}
