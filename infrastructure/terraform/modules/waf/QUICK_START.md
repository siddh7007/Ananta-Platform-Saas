# WAF Module - Quick Start Guide

## 5-Minute Setup

### 1. Basic Integration

Add to your existing Terraform configuration:

```hcl
module "waf" {
  source = "./modules/waf"

  name_prefix = "myapp-prod"
  alb_arn     = module.alb.alb_arn

  tags = {
    Environment = "production"
  }
}
```

### 2. Apply

```bash
terraform init
terraform plan
terraform apply
```

### 3. Verify

```bash
# Check WAF is associated with ALB
aws wafv2 list-resources-for-web-acl \
  --web-acl-arn $(terraform output -raw waf_web_acl_arn)

# View metrics in AWS Console
terraform output waf_dashboard_url
```

## Common Configurations

### Production (Strict Security)

```hcl
module "waf" {
  source = "./modules/waf"

  name_prefix = "myapp-prod"
  alb_arn     = module.alb.alb_arn

  # Strict rate limiting
  rate_limit = 1000

  # Full logging
  enable_logging     = true
  log_retention_days = 90
  kms_key_id        = aws_kms_key.logs.arn

  # Alarms
  enable_alarms              = true
  blocked_requests_threshold = 500
  alarm_actions             = [aws_sns_topic.security.arn]

  tags = {
    Environment = "production"
  }
}
```

### Development (Relaxed)

```hcl
module "waf" {
  source = "./modules/waf"

  name_prefix = "myapp-dev"
  alb_arn     = module.alb.alb_arn

  # Relaxed rate limiting
  rate_limit = 5000

  # Minimal logging
  enable_logging = false
  enable_alarms  = false

  tags = {
    Environment = "development"
  }
}
```

### With IP Blocking

```hcl
module "waf" {
  source = "./modules/waf"

  name_prefix = "myapp-prod"
  alb_arn     = module.alb.alb_arn

  # Block specific IPs
  blocked_ip_addresses = [
    "192.0.2.0/24",
    "198.51.100.42/32"
  ]

  tags = {
    Environment = "production"
  }
}
```

## Outputs Usage

### Access WAF Information

```hcl
# In your root module
output "waf_info" {
  value = {
    acl_id       = module.waf.web_acl_id
    acl_arn      = module.waf.web_acl_arn
    capacity     = module.waf.web_acl_capacity
    dashboard    = module.waf.dashboard_url
    log_group    = module.waf.log_group_name
  }
}
```

### Use in Other Resources

```hcl
# Reference WAF ID in IAM policy
resource "aws_iam_policy" "waf_admin" {
  name = "waf-admin"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "wafv2:GetWebACL",
          "wafv2:UpdateWebACL"
        ]
        Resource = module.waf.web_acl_arn
      }
    ]
  })
}
```

## Testing

### Test Rate Limiting

```bash
# Normal load (should work)
curl https://your-alb.com/

# Excessive load (should get blocked)
for i in {1..3000}; do curl https://your-alb.com/ & done
```

### Test SQL Injection Protection

```bash
# Should return 403 Forbidden
curl "https://your-alb.com/?id=1' OR '1'='1"
```

### View Blocked Requests

```bash
# CloudWatch Logs Insights query
aws logs start-query \
  --log-group-name $(terraform output -raw waf_log_group_name) \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, httpRequest.clientIp, action | filter action = "BLOCK"'
```

## Monitoring

### CloudWatch Dashboard

Access the auto-generated dashboard:
```bash
# Get dashboard URL
terraform output waf_dashboard_url
```

### Custom Metrics Query

```bash
# Get blocked requests in last hour
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=WebACL,Value=$(terraform output -raw waf_web_acl_name) Name=Region,Value=us-east-1 Name=Rule,Value=ALL \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Troubleshooting

### WAF Not Blocking Malicious Traffic

1. Check WAF is associated:
```bash
aws wafv2 list-resources-for-web-acl --web-acl-arn <arn>
```

2. Verify rules are active:
```bash
aws wafv2 get-web-acl --scope REGIONAL --id <id> --name <name>
```

3. Check logs for ALLOW vs BLOCK actions

### Legitimate Requests Being Blocked

1. Check which rule is blocking:
```bash
# Query logs for your IP
aws logs filter-log-events \
  --log-group-name <log-group> \
  --filter-pattern "BLOCK" \
  --start-time $(date -u -d '1 hour ago' +%s000)
```

2. Temporarily increase rate limit:
```hcl
rate_limit = 5000  # Increase from 2000
```

3. Consider excluding specific rules (requires module enhancement)

### High Costs

1. Disable logging in dev/test:
```hcl
enable_logging = false
```

2. Reduce log retention:
```hcl
log_retention_days = 7  # Instead of 90
```

3. Remove unused IP sets:
```hcl
blocked_ip_addresses = []
```

## Updating

### Add New Blocked IPs

```hcl
# Update your configuration
blocked_ip_addresses = [
  "192.0.2.0/24",
  "198.51.100.42/32",
  "203.0.113.0/24"  # New IP to block
]
```

```bash
# Apply changes (non-destructive)
terraform apply
```

### Adjust Rate Limiting

```hcl
# Decrease for stricter protection
rate_limit = 500

# Increase for higher traffic sites
rate_limit = 10000
```

### Enable/Disable Features

```hcl
# Enable logging later
enable_logging = true

# Enable alarms
enable_alarms  = true
alarm_actions  = [aws_sns_topic.alerts.arn]
```

## Cost Breakdown

### Monthly Costs (Estimated)

| Component | Cost | Notes |
|-----------|------|-------|
| Web ACL | $5.00 | Fixed monthly cost |
| Rules (6 managed + rate limit) | $7.00 | $1 per rule |
| Requests (1M) | $0.60 | $0.60 per 1M requests |
| CloudWatch Logs (10GB) | $5.00 | If logging enabled |
| **Total** | **~$18/month** | Plus per-request costs |

Additional costs scale with traffic:
- Each additional 1M requests: $0.60
- CloudWatch log storage: $0.50/GB

## Best Practices

1. **Always enable in production**: WAF is essential for public-facing applications
2. **Start with default rules**: AWS managed rules cover 90% of threats
3. **Enable logging**: Essential for debugging and compliance
4. **Set up alarms**: Get notified of attacks in real-time
5. **Review metrics weekly**: Understand your traffic patterns
6. **Test before deploying**: Use the examples to test configuration
7. **Document exclusions**: If you need to exclude rules, document why
8. **Rotate blocked IPs**: Remove IPs that are no longer threats

## Next Steps

1. Review full documentation: [README.md](./README.md)
2. Check testing guide: [TESTING.md](./TESTING.md)
3. Run examples: [examples/](./examples/)
4. Set up monitoring dashboard
5. Configure SNS alerts
6. Schedule regular security reviews

## Support

For issues or questions:
1. Check [TESTING.md](./TESTING.md) troubleshooting section
2. Review AWS WAF documentation
3. Check CloudWatch Logs for detailed request information
4. Contact your security team for compliance requirements

## Related Modules

- `modules/alb` - Application Load Balancer
- `modules/acm` - Certificate Manager
- `modules/cloudwatch` - Monitoring and Alarms
- `modules/kms` - Encryption Keys
