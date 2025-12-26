# AWS WAF v2 Module

Comprehensive AWS WAF v2 module for Application Load Balancer protection with managed rule sets, rate limiting, IP blocking, and CloudWatch monitoring.

## Features

- **AWS Managed Rule Sets**:
  - Common Rule Set (OWASP Top 10 protection)
  - Known Bad Inputs protection
  - SQL Injection prevention
  - Amazon IP Reputation List
  - Anonymous IP List (VPNs, proxies, Tor nodes)

- **Rate Limiting**: Protects against DDoS and brute force attacks
- **IP Blocking**: Manual IP/CIDR block list
- **CloudWatch Integration**: Logging, metrics, and alarms
- **Custom Responses**: User-friendly error messages
- **Field Redaction**: Automatic redaction of sensitive headers in logs

## Usage

### Basic Example

```hcl
module "waf" {
  source = "../../modules/waf"

  name_prefix = "myapp-prod"
  alb_arn     = module.alb.alb_arn

  # Rate limiting
  rate_limit = 2000  # requests per 5 minutes per IP

  # Enable logging and alarms
  enable_logging = true
  enable_alarms  = true

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

### Advanced Example with IP Blocking

```hcl
module "waf" {
  source = "../../modules/waf"

  name_prefix = "myapp-prod"
  alb_arn     = module.alb.alb_arn

  # Block specific IPs
  blocked_ip_addresses = [
    "192.0.2.0/24",
    "198.51.100.42/32"
  ]

  # Strict rate limiting
  rate_limit = 1000

  # Logging with encryption
  enable_logging    = true
  log_retention_days = 90
  kms_key_id        = aws_kms_key.logs.arn

  # Alarms with SNS notifications
  enable_alarms               = true
  blocked_requests_threshold  = 500
  rate_limit_threshold        = 50
  alarm_actions              = [aws_sns_topic.security_alerts.arn]

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

### Multi-Environment Example

```hcl
# Development environment with relaxed rules
module "waf_dev" {
  source = "../../modules/waf"

  name_prefix = "myapp-dev"
  alb_arn     = module.alb_dev.alb_arn

  rate_limit              = 5000
  enable_logging          = false
  enable_alarms           = false

  tags = {
    Environment = "development"
  }
}

# Production environment with strict rules
module "waf_prod" {
  source = "../../modules/waf"

  name_prefix = "myapp-prod"
  alb_arn     = module.alb_prod.alb_arn

  rate_limit              = 1000
  enable_logging          = true
  log_retention_days      = 90
  enable_alarms           = true
  alarm_actions          = [aws_sns_topic.security.arn]

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| name_prefix | Name prefix for WAF resources | `string` | n/a | yes |
| alb_arn | ARN of the Application Load Balancer | `string` | n/a | yes |
| rate_limit | Max requests per IP per 5 minutes | `number` | `2000` | no |
| blocked_ip_addresses | List of IPs/CIDRs to block | `list(string)` | `[]` | no |
| enable_logging | Enable CloudWatch logging | `bool` | `true` | no |
| log_retention_days | Log retention period in days | `number` | `30` | no |
| kms_key_id | KMS key for log encryption | `string` | `null` | no |
| enable_alarms | Enable CloudWatch alarms | `bool` | `true` | no |
| blocked_requests_threshold | Alarm threshold for blocked requests (5 min) | `number` | `1000` | no |
| rate_limit_threshold | Alarm threshold for rate limiting (1 min) | `number` | `100` | no |
| alarm_actions | List of ARNs to notify on alarms | `list(string)` | `[]` | no |
| tags | Tags to apply to resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| web_acl_id | ID of the WAF Web ACL |
| web_acl_arn | ARN of the WAF Web ACL |
| web_acl_name | Name of the WAF Web ACL |
| web_acl_capacity | Capacity units used by the WAF |
| ip_set_id | ID of the blocked IP set (if created) |
| ip_set_arn | ARN of the blocked IP set (if created) |
| log_group_name | CloudWatch log group name (if enabled) |
| log_group_arn | CloudWatch log group ARN (if enabled) |
| alarm_arns | Map of alarm names to ARNs |
| cloudwatch_metrics | Map of metric names for monitoring |
| dashboard_url | URL to WAF metrics in AWS console |
| security_features | Summary of enabled security features |

## WAF Rules

The module implements the following rules in priority order:

1. **Priority 0**: Blocked IPs (if configured)
2. **Priority 1**: AWS Managed Common Rule Set
3. **Priority 2**: AWS Managed Known Bad Inputs
4. **Priority 3**: AWS Managed SQL Injection Protection
5. **Priority 4**: Rate Limiting (customizable threshold)
6. **Priority 5**: Amazon IP Reputation List
7. **Priority 6**: Anonymous IP List

## Cost Optimization

WAF costs include:
- **Web ACL**: $5/month per Web ACL
- **Rules**: $1/month per rule
- **Requests**: $0.60 per million requests
- **Logs**: CloudWatch Logs storage costs

To optimize costs:
- Set `enable_logging = false` in non-production environments
- Adjust `log_retention_days` based on compliance requirements
- Use `blocked_ip_addresses` sparingly (each IP set costs $1/month)

## Monitoring

### CloudWatch Metrics

The module creates metrics in the `AWS/WAFV2` namespace:

- `AllowedRequests` - Requests matching allow rules
- `BlockedRequests` - Requests blocked by WAF
- `CountedRequests` - Requests matching count rules
- `PassedRequests` - Requests not matching any rules

Metrics are available per Web ACL and per Rule.

### CloudWatch Alarms

When `enable_alarms = true`, the module creates:

1. **Blocked Requests High**: Triggers when total blocked requests exceed threshold in 5 minutes
2. **Rate Limit Exceeded**: Triggers when rate limiting blocks exceed threshold in 1 minute

### CloudWatch Logs

When `enable_logging = true`, the module creates a log group with:
- Configurable retention period
- Optional KMS encryption
- Automatic redaction of sensitive headers (Authorization, Cookie)

## Security Best Practices

1. **Enable Logging**: Set `enable_logging = true` for audit trails
2. **Enable Alarms**: Set `enable_alarms = true` and configure `alarm_actions` for incident response
3. **Encrypt Logs**: Provide `kms_key_id` to encrypt WAF logs
4. **Tune Rate Limiting**: Adjust `rate_limit` based on legitimate traffic patterns
5. **Monitor Metrics**: Review CloudWatch metrics regularly to detect attack patterns
6. **Update Blocked IPs**: Keep `blocked_ip_addresses` updated based on threat intelligence
7. **Test Rules**: Use AWS WAF testing tools before deploying to production

## Compliance

This module helps meet the following compliance requirements:

- **PCI DSS 6.6**: Web application firewall protection
- **NIST 800-53**: SC-5 (Denial of Service Protection), SC-7 (Boundary Protection)
- **SOC 2**: Security monitoring and logging
- **GDPR**: Data protection through request filtering

## Troubleshooting

### False Positives

If legitimate requests are being blocked:

1. Review WAF logs in CloudWatch
2. Identify the blocking rule
3. Add exclusions using `excluded_rules` variable (to be implemented)
4. Adjust rate limiting threshold if needed

### High Costs

If WAF costs are too high:

1. Disable logging in non-production: `enable_logging = false`
2. Reduce log retention: `log_retention_days = 7`
3. Remove unused IP sets: `blocked_ip_addresses = []`

### Performance Impact

WAF adds minimal latency (typically < 1ms). If experiencing issues:

1. Review Web ACL capacity (should be well under the 5000 WCU limit)
2. Simplify custom rules
3. Contact AWS support for capacity optimization

## Examples

See the `examples/` directory for complete working examples:

- `examples/basic/` - Minimal WAF configuration
- `examples/advanced/` - Full-featured configuration with all options
- `examples/multi-env/` - Multi-environment setup

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.6.0 |
| aws | >= 5.0 |

## License

Copyright (c) 2025 Ananta Platform SaaS

## Authors

Module managed by Terraform Engineering Team

## References

- [AWS WAF Developer Guide](https://docs.aws.amazon.com/waf/latest/developerguide/)
- [AWS Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups.html)
- [WAF Best Practices](https://aws.amazon.com/blogs/security/category/security-identity-compliance/aws-waf/)
