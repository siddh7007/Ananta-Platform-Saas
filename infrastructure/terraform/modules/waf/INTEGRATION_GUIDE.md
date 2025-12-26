# WAF Module Integration Guide

## Overview

This guide shows how to integrate the WAF module into the Ananta Platform SaaS Terraform infrastructure.

## Prerequisites

Before integrating the WAF module:

1. **Existing ALB**: You must have an Application Load Balancer already deployed
2. **Terraform Version**: >= 1.6.0
3. **AWS Provider**: >= 5.0
4. **Permissions**: IAM permissions for WAF, CloudWatch, and KMS operations

## Directory Structure

```
infrastructure/terraform/
├── environments/
│   ├── dev/
│   │   └── main.tf              # Import WAF here
│   ├── staging/
│   │   └── main.tf              # Import WAF here
│   └── prod/
│       └── main.tf              # Import WAF here
└── modules/
    └── waf/                      # This module
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── ...
```

## Integration Steps

### Step 1: Add WAF Module to Environment

Edit your environment's `main.tf` (e.g., `environments/prod/main.tf`):

```hcl
# Existing ALB configuration
module "alb" {
  source = "../../modules/alb"  # Or wherever your ALB module is

  name_prefix = var.environment
  vpc_id      = module.vpc.vpc_id
  subnets     = module.vpc.public_subnets

  # ... other ALB configuration
}

# NEW: Add WAF protection
module "waf" {
  source = "../../modules/waf"

  name_prefix = "${var.environment}-api"
  alb_arn     = module.alb.alb_arn

  # Environment-specific rate limiting
  rate_limit = var.environment == "prod" ? 2000 : 5000

  # Enable logging and alarms in production
  enable_logging = var.environment == "prod" ? true : false
  enable_alarms  = var.environment == "prod" ? true : false

  # Production: Send alerts to SNS
  alarm_actions = var.environment == "prod" ? [module.sns_alerts.topic_arn] : []

  tags = merge(
    var.tags,
    {
      Module = "waf"
    }
  )
}
```

### Step 2: Add Required Variables

Add to your environment's `variables.tf`:

```hcl
variable "waf_rate_limit" {
  description = "WAF rate limit per IP per 5 minutes"
  type        = number
  default     = 2000
}

variable "waf_blocked_ips" {
  description = "List of IP addresses to block"
  type        = list(string)
  default     = []
}
```

### Step 3: Add Outputs

Add to your environment's `outputs.tf`:

```hcl
output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = module.waf.web_acl_id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = module.waf.web_acl_arn
}

output "waf_dashboard_url" {
  description = "WAF CloudWatch dashboard URL"
  value       = module.waf.dashboard_url
}
```

### Step 4: Configure Environment Variables

Create/update `environments/prod/terraform.tfvars`:

```hcl
environment = "prod"

# WAF Configuration
waf_rate_limit = 1000

# Optional: Block specific IPs
waf_blocked_ips = [
  # "192.0.2.0/24",
]

tags = {
  Environment = "production"
  ManagedBy   = "terraform"
  Project     = "ananta-platform"
}
```

## Advanced Integration Patterns

### Pattern 1: Multi-Environment with Different Policies

```hcl
locals {
  waf_config = {
    dev = {
      rate_limit     = 10000
      enable_logging = false
      enable_alarms  = false
    }
    staging = {
      rate_limit     = 5000
      enable_logging = true
      enable_alarms  = false
    }
    prod = {
      rate_limit     = 1000
      enable_logging = true
      enable_alarms  = true
    }
  }
}

module "waf" {
  source = "../../modules/waf"

  name_prefix = "${var.environment}-api"
  alb_arn     = module.alb.alb_arn

  rate_limit     = local.waf_config[var.environment].rate_limit
  enable_logging = local.waf_config[var.environment].enable_logging
  enable_alarms  = local.waf_config[var.environment].enable_alarms

  # Production-only features
  kms_key_id    = var.environment == "prod" ? module.kms.key_arn : null
  alarm_actions = var.environment == "prod" ? [module.sns.topic_arn] : []

  tags = var.tags
}
```

### Pattern 2: Shared WAF Configuration

Create a shared configuration file `modules/waf/configs/default.tf`:

```hcl
locals {
  default_waf_config = {
    rate_limit              = 2000
    log_retention_days      = 30
    blocked_requests_threshold = 1000
    rate_limit_threshold    = 100
  }
}
```

Use in environments:

```hcl
module "waf_config" {
  source = "../../modules/waf/configs"
}

module "waf" {
  source = "../../modules/waf"

  name_prefix = var.environment
  alb_arn     = module.alb.alb_arn

  # Use defaults with overrides
  rate_limit              = var.waf_rate_limit != null ? var.waf_rate_limit : module.waf_config.default_waf_config.rate_limit
  log_retention_days      = module.waf_config.default_waf_config.log_retention_days
  blocked_requests_threshold = module.waf_config.default_waf_config.blocked_requests_threshold

  tags = var.tags
}
```

### Pattern 3: Multiple ALBs with WAF

```hcl
# API ALB with WAF
module "waf_api" {
  source = "../../modules/waf"

  name_prefix = "${var.environment}-api"
  alb_arn     = module.alb_api.alb_arn
  rate_limit  = 1000

  tags = merge(var.tags, { Service = "api" })
}

# Admin ALB with WAF
module "waf_admin" {
  source = "../../modules/waf"

  name_prefix = "${var.environment}-admin"
  alb_arn     = module.alb_admin.alb_arn
  rate_limit  = 500

  # Stricter for admin interface
  blocked_ip_addresses = var.admin_allowed_ips_inverted

  tags = merge(var.tags, { Service = "admin" })
}
```

## Integration with Existing Modules

### With KMS Module

```hcl
module "kms_logs" {
  source = "../../modules/kms"

  description = "KMS key for WAF logs encryption"
  alias       = "${var.environment}-waf-logs"

  tags = var.tags
}

module "waf" {
  source = "../../modules/waf"

  name_prefix = var.environment
  alb_arn     = module.alb.alb_arn
  kms_key_id  = module.kms_logs.key_arn

  tags = var.tags
}
```

### With SNS Module

```hcl
module "sns_security_alerts" {
  source = "../../modules/sns"

  name = "${var.environment}-security-alerts"

  subscriptions = [
    {
      protocol = "email"
      endpoint = "security@example.com"
    }
  ]

  tags = var.tags
}

module "waf" {
  source = "../../modules/waf"

  name_prefix   = var.environment
  alb_arn       = module.alb.alb_arn
  enable_alarms = true
  alarm_actions = [module.sns_security_alerts.topic_arn]

  tags = var.tags
}
```

### With CloudWatch Dashboard

```hcl
resource "aws_cloudwatch_dashboard" "security" {
  dashboard_name = "${var.environment}-security"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/WAFV2", "AllowedRequests", { stat = "Sum" }],
            [".", "BlockedRequests", { stat = "Sum" }]
          ]
          period = 300
          region = var.aws_region
          title  = "WAF Traffic (${var.environment})"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
            [".", "RequestCount", { stat = "Sum" }]
          ]
          period = 300
          region = var.aws_region
          title  = "ALB Performance"
        }
      }
    ]
  })
}
```

## Deployment Process

### Initial Deployment

```bash
# Navigate to environment
cd infrastructure/terraform/environments/prod

# Initialize Terraform (download WAF module)
terraform init

# Preview changes
terraform plan

# Apply WAF configuration
terraform apply -target=module.waf

# Verify deployment
terraform output waf_web_acl_id
```

### Incremental Updates

```bash
# Update rate limit
terraform apply -var="waf_rate_limit=500"

# Add blocked IPs
terraform apply -var='waf_blocked_ips=["192.0.2.0/24"]'

# Enable logging
terraform apply -var="waf_enable_logging=true"
```

## Testing After Integration

### 1. Verify WAF Association

```bash
# Get WAF ARN from Terraform output
WAF_ARN=$(terraform output -raw waf_web_acl_arn)

# Check associated resources
aws wafv2 list-resources-for-web-acl --web-acl-arn "$WAF_ARN"
```

### 2. Test Protection

```bash
# Get ALB endpoint
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test normal request (should succeed)
curl "https://$ALB_DNS/"

# Test SQL injection (should block)
curl "https://$ALB_DNS/?id=1' OR '1'='1"
```

### 3. Monitor Metrics

```bash
# Get dashboard URL
terraform output waf_dashboard_url

# Or query metrics directly
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=WebACL,Value=$(terraform output -raw waf_web_acl_name) \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Troubleshooting Integration Issues

### Issue: "Resource already has a web ACL associated"

**Cause**: ALB already has a WAF attached

**Solution**:
```bash
# List existing associations
aws wafv2 list-resources-for-web-acl --scope REGIONAL --web-acl-arn <existing-arn>

# Import existing WAF into Terraform
terraform import module.waf.aws_wafv2_web_acl_association.main <association-id>
```

### Issue: "Insufficient permissions"

**Cause**: IAM user/role lacks WAF permissions

**Solution**: Add to IAM policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "wafv2:*",
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DeleteAlarms",
        "logs:CreateLogGroup",
        "logs:PutRetentionPolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

### Issue: "Module not found"

**Cause**: Incorrect source path

**Solution**: Verify relative path:
```hcl
# From environments/prod/main.tf
module "waf" {
  source = "../../modules/waf"  # Correct
  # NOT: "../modules/waf" or "./modules/waf"
}
```

## Migration from Existing WAF

If you have an existing WAF setup:

### Step 1: Import Resources

```bash
# Import Web ACL
terraform import module.waf.aws_wafv2_web_acl.main <web-acl-id>/<web-acl-name>/<scope>

# Import association
terraform import module.waf.aws_wafv2_web_acl_association.main <web-acl-arn>,<alb-arn>

# Import IP set (if exists)
terraform import module.waf.aws_wafv2_ip_set.blocked[0] <ip-set-id>/<ip-set-name>/<scope>
```

### Step 2: Update Configuration

Match your existing WAF settings in Terraform:

```hcl
module "waf" {
  source = "../../modules/waf"

  name_prefix = "existing-waf-name"  # Match existing name
  alb_arn     = module.alb.alb_arn

  # Match existing rate limit
  rate_limit = 2000

  # Match existing blocked IPs
  blocked_ip_addresses = [
    "192.0.2.0/24"
  ]

  tags = var.tags
}
```

### Step 3: Verify No Changes

```bash
# Should show no changes
terraform plan
```

## Best Practices for Integration

1. **Start with Dev**: Deploy to development environment first
2. **Enable Logging**: Always enable logging in production for audit trails
3. **Set Up Alarms**: Configure SNS notifications for security events
4. **Use Tagging**: Apply consistent tags for cost allocation
5. **Document Exclusions**: If you need to exclude rules, document why
6. **Version Control**: Keep WAF configuration in version control
7. **Review Metrics**: Set up regular reviews of WAF metrics
8. **Test Changes**: Test configuration changes in lower environments first

## Maintenance

### Regular Tasks

**Weekly**:
- Review CloudWatch metrics for attack patterns
- Check alarm history

**Monthly**:
- Review and update blocked IP list
- Analyze WAF logs for false positives
- Update rate limits based on traffic patterns

**Quarterly**:
- Review and update documentation
- Audit WAF rules and configuration
- Update cost estimates

### Updating the Module

When a new version of the WAF module is available:

```bash
# Update module source (if using Git)
cd infrastructure/terraform/modules
git pull origin main

# Or update version constraint (if using registry)
# In your environment's main.tf:
module "waf" {
  source  = "registry.terraform.io/your-org/waf/aws"
  version = "~> 2.0"  # Update version
  # ...
}

# Update and apply
terraform init -upgrade
terraform plan
terraform apply
```

## Cost Management

### Estimate Costs Before Deployment

```bash
# Using Infracost
infracost breakdown --path environments/prod
```

### Monitor Costs

```bash
# Get WAF cost tags
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://waf-cost-filter.json
```

`waf-cost-filter.json`:
```json
{
  "Tags": {
    "Key": "Module",
    "Values": ["waf"]
  }
}
```

## Support and Resources

- Module Documentation: [README.md](./README.md)
- Testing Guide: [TESTING.md](./TESTING.md)
- Examples: [examples/](./examples/)
- AWS WAF Documentation: https://docs.aws.amazon.com/waf/

## Next Steps

After successful integration:

1. Set up monitoring dashboard
2. Configure alerting and incident response
3. Document custom configurations
4. Train team on WAF management
5. Establish security review process
6. Plan for regular updates and maintenance
