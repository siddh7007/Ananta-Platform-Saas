# Monitoring Module

Terraform module for AWS CloudWatch monitoring, SNS alert topics, and Lambda-based alert forwarding to PagerDuty and Slack.

## Features

- **SNS Topics** for different alert severities (critical, warning, SLO violations, infrastructure)
- **CloudWatch Alarms** for RDS, ElastiCache, and ECS services
- **Lambda Functions** for alert forwarding to PagerDuty and Slack
- **KMS Encryption** for SNS topics (optional)
- **Email Notifications** via SNS subscriptions

## Usage

```hcl
module "monitoring" {
  source = "./modules/monitoring"

  name_prefix        = "ananta-dev"
  ecs_cluster_name   = module.ecs.cluster_name

  # Database IDs
  control_plane_db_id = module.control_plane_database.db_instance_id
  app_plane_db_id     = module.app_plane_database.db_instance_id
  redis_cluster_id    = module.elasticache.cluster_id

  # ECS Services to monitor
  ecs_services = {
    "tenant-mgmt" = "tenant-management-service"
    "cns"         = "cns-service"
  }

  # Alert thresholds
  db_cpu_threshold       = 80
  ecs_cpu_threshold      = 80
  ecs_memory_threshold   = 85

  # Integrations
  enable_pagerduty          = true
  pagerduty_integration_key = var.pagerduty_key

  enable_slack       = true
  slack_webhook_url  = var.slack_webhook

  alert_email_addresses = [
    "oncall@ananta.io",
    "sre-team@ananta.io"
  ]

  tags = local.common_tags
}
```

## CloudWatch Alarms

### RDS Database Alarms

| Alarm | Threshold | Severity | Description |
|-------|-----------|----------|-------------|
| CPU High | 80% | Critical | Database CPU utilization too high |
| Storage Low | 10 GB | Critical | Free storage space running low |
| Connections High | 80 | Warning | Connection count approaching limit |

### ElastiCache (Redis) Alarms

| Alarm | Threshold | Severity | Description |
|-------|-----------|----------|-------------|
| CPU High | 75% | Warning | Redis CPU utilization high |
| Memory High | 85% | Critical | Redis memory usage high (evictions will occur) |
| Evictions | 100/5min | Warning | Cache items being evicted |

### ECS Service Alarms

| Alarm | Threshold | Severity | Description |
|-------|-----------|----------|-------------|
| CPU High | 80% | Warning | Service CPU utilization high |
| Memory High | 85% | Warning | Service memory utilization high |

## SNS Topics

### Critical Alerts Topic
- **Purpose**: Life-threatening production issues
- **Integrations**: PagerDuty, email
- **Repeat Interval**: 1 hour

### Warning Alerts Topic
- **Purpose**: Issues requiring attention but not critical
- **Integrations**: Slack, email
- **Repeat Interval**: 6 hours

### SLO Violations Topic
- **Purpose**: SLO/error budget alerts
- **Integrations**: Email, Slack
- **Repeat Interval**: 4 hours

### Infrastructure Alerts Topic
- **Purpose**: Infrastructure component issues
- **Integrations**: Email, Slack
- **Repeat Interval**: 4 hours

## Lambda Functions

### PagerDuty Forwarder
- **Runtime**: Python 3.11
- **Trigger**: SNS (critical_alerts topic)
- **Function**: Forwards CloudWatch alarms to PagerDuty Events API v2
- **Configuration**: Requires `PAGERDUTY_INTEGRATION_KEY` environment variable

### Slack Forwarder
- **Runtime**: Python 3.11
- **Trigger**: SNS (warning_alerts topic)
- **Function**: Sends formatted alert messages to Slack
- **Configuration**: Requires `SLACK_WEBHOOK_URL` environment variable

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| name_prefix | Prefix for resource names | `string` | - | yes |
| control_plane_db_id | RDS instance ID for Control Plane | `string` | `""` | no |
| app_plane_db_id | RDS instance ID for App Plane | `string` | `""` | no |
| redis_cluster_id | ElastiCache cluster ID | `string` | `""` | no |
| ecs_cluster_name | ECS cluster name | `string` | `""` | no |
| ecs_services | Map of ECS services to monitor | `map(string)` | `{}` | no |
| db_cpu_threshold | RDS CPU threshold (%) | `number` | `80` | no |
| ecs_cpu_threshold | ECS CPU threshold (%) | `number` | `80` | no |
| enable_pagerduty | Enable PagerDuty integration | `bool` | `false` | no |
| pagerduty_integration_key | PagerDuty integration key | `string` | `""` | no |
| enable_slack | Enable Slack integration | `bool` | `false` | no |
| slack_webhook_url | Slack webhook URL | `string` | `""` | no |
| alert_email_addresses | Email addresses for alerts | `list(string)` | `[]` | no |

## Outputs

| Name | Description |
|------|-------------|
| critical_alerts_topic_arn | ARN of critical alerts SNS topic |
| warning_alerts_topic_arn | ARN of warning alerts SNS topic |
| slo_violations_topic_arn | ARN of SLO violations SNS topic |
| pagerduty_lambda_arn | ARN of PagerDuty forwarder Lambda |
| slack_lambda_arn | ARN of Slack forwarder Lambda |
| cloudwatch_alarms | Map of CloudWatch alarm ARNs |

## Configuration Example

### Environment Variables

```bash
# PagerDuty
export TF_VAR_pagerduty_key="your-integration-key"

# Slack
export TF_VAR_slack_webhook="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Email
export TF_VAR_alert_emails='["oncall@ananta.io","sre@ananta.io"]'
```

### Terraform Variables File

```hcl
# environments/prod/terraform.tfvars

enable_pagerduty = true
enable_slack     = true

alert_email_addresses = [
  "oncall@ananta.io",
  "sre-team@ananta.io"
]

# Alert thresholds (stricter for production)
db_cpu_threshold     = 75
ecs_cpu_threshold    = 75
ecs_memory_threshold = 80
```

## Testing Alarms

### Trigger a Test Alarm

```bash
# Set alarm to ALARM state
aws cloudwatch set-alarm-state \
  --alarm-name "ananta-dev-control-plane-db-cpu-high" \
  --state-value ALARM \
  --state-reason "Testing alarm notifications"

# Set alarm back to OK
aws cloudwatch set-alarm-state \
  --alarm-name "ananta-dev-control-plane-db-cpu-high" \
  --state-value OK \
  --state-reason "Test complete"
```

### Test Lambda Functions Locally

```bash
# Test PagerDuty forwarder
cd lambda
python3 -c "import pagerduty_forwarder; print(pagerduty_forwarder.handler({...}, {}))"

# Test Slack forwarder
python3 -c "import slack_forwarder; print(slack_forwarder.handler({...}, {}))"
```

## Integration with Prometheus/AlertManager

This module creates AWS-native monitoring. To integrate with Prometheus:

1. **Configure AlertManager webhook receiver** to send to SNS topics
2. **Use AWS SNS exporter** to expose SNS metrics to Prometheus
3. **Create Grafana dashboard** showing CloudWatch alarm states

See `shared-monitoring/README.md` for Prometheus/AlertManager setup.

## Security Considerations

- **KMS Encryption**: Enable `enable_encryption = true` for production
- **Secrets Management**: Store PagerDuty/Slack credentials in AWS Secrets Manager
- **IAM Policies**: Lambda functions have minimal permissions (logs + SNS)
- **SNS Access**: Restricted to CloudWatch and Lambda services

## Troubleshooting

### Alarms Not Triggering
1. Check CloudWatch alarm state in AWS Console
2. Verify metric data is being collected
3. Review alarm threshold configuration

### PagerDuty Not Receiving Alerts
1. Check Lambda CloudWatch logs: `/aws/lambda/{name}-pagerduty-forwarder`
2. Verify integration key is correct
3. Test PagerDuty Events API manually

### Slack Messages Not Appearing
1. Check Lambda CloudWatch logs: `/aws/lambda/{name}-slack-forwarder`
2. Verify webhook URL is valid
3. Check Slack app permissions

## Cost Estimation

For a typical production environment:

| Resource | Monthly Cost |
|----------|--------------|
| CloudWatch Alarms (20) | $2.00 |
| SNS Topics (4) | $0.50 |
| Lambda Invocations (1000) | $0.20 |
| CloudWatch Logs (1 GB) | $0.50 |
| **Total** | **~$3.20/month** |

## References

- [AWS CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [SRE Error Budget Policy](https://sre.google/workbook/error-budget-policy/)
