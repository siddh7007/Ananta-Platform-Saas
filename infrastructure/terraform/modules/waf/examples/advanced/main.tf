# Advanced WAF Example
# Demonstrates full-featured WAF configuration with all security options

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# KMS key for log encryption
resource "aws_kms_key" "logs" {
  description             = "KMS key for WAF logs encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = var.tags
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${var.name_prefix}-waf-logs"
  target_key_id = aws_kms_key.logs.key_id
}

# SNS topic for security alerts
resource "aws_sns_topic" "security_alerts" {
  name              = "${var.name_prefix}-waf-alerts"
  kms_master_key_id = aws_kms_key.logs.id

  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.security_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# VPC for ALB (in real usage, reference existing VPC)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.name_prefix}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false

  tags = var.tags
}

# Security group for ALB
resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-alb-"
  description = "Security group for ALB with WAF protection"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet (redirects to HTTPS)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = var.tags
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = true
  enable_http2              = true
  enable_cross_zone_load_balancing = true

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    enabled = true
  }

  tags = var.tags
}

# S3 bucket for ALB access logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${var.name_prefix}-alb-logs"

  tags = var.tags
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.logs.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Target group
resource "aws_lb_target_group" "main" {
  name     = "${var.name_prefix}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    enabled             = true
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = var.tags
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-Ext-2018-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# WAF Module - Advanced Configuration
module "waf" {
  source = "../../"

  name_prefix = var.name_prefix
  alb_arn     = aws_lb.main.arn

  # Strict rate limiting for production
  rate_limit = 1000

  # Block known malicious IPs
  blocked_ip_addresses = var.blocked_ip_addresses

  # Full logging with encryption and extended retention
  enable_logging     = true
  log_retention_days = 90
  kms_key_id        = aws_kms_key.logs.arn

  # CloudWatch alarms with SNS notifications
  enable_alarms              = true
  blocked_requests_threshold = 500
  rate_limit_threshold       = 50
  alarm_actions             = [aws_sns_topic.security_alerts.arn]

  tags = merge(
    var.tags,
    {
      SecurityLevel = "high"
      Compliance    = "pci-dss,soc2"
    }
  )
}

# CloudWatch Dashboard for WAF metrics
resource "aws_cloudwatch_dashboard" "waf" {
  dashboard_name = "${var.name_prefix}-waf-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/WAFV2", "AllowedRequests", { stat = "Sum", label = "Allowed" }],
            [".", "BlockedRequests", { stat = "Sum", label = "Blocked" }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "WAF Requests Overview"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/WAFV2", "BlockedRequests", "Rule", "RateLimitRule", { stat = "Sum" }]
          ]
          period = 60
          stat   = "Sum"
          region = var.aws_region
          title  = "Rate Limiting Blocks"
        }
      },
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '${module.waf.log_group_name}'
            | fields @timestamp, httpRequest.clientIp, action, terminatingRuleId
            | filter action = 'BLOCK'
            | stats count() by terminatingRuleId
          EOT
          region  = var.aws_region
          title   = "Top Blocking Rules"
        }
      }
    ]
  })
}

# Outputs
output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = module.waf.web_acl_id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = module.waf.web_acl_arn
}

output "waf_capacity" {
  description = "WAF capacity units used"
  value       = module.waf.web_acl_capacity
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "log_group_name" {
  description = "WAF log group name"
  value       = module.waf.log_group_name
}

output "dashboard_url" {
  description = "WAF CloudWatch dashboard URL"
  value       = module.waf.dashboard_url
}

output "custom_dashboard_name" {
  description = "Custom CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.waf.dashboard_name
}

output "security_features" {
  description = "Enabled WAF security features"
  value       = module.waf.security_features
}
