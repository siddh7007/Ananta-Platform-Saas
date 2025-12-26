# AWS X-Ray Terraform Module

Production-ready distributed tracing infrastructure with AWS X-Ray integration.

## Features

- **Intelligent Sampling Rules**: Different sampling rates for critical APIs, health checks, and default traffic
- **KMS Encryption**: Encrypt traces at rest with AWS KMS
- **X-Ray Groups**: Filter and analyze traces by service type, errors, latency, and tenant operations
- **CloudWatch Integration**: Alarms for high error rates and latency
- **IAM Policies**: Pre-configured policies for ECS tasks to write traces

## Architecture

```
┌─────────────────┐
│  ECS Tasks      │
│  (with X-Ray    │
│   SDK or OTEL)  │
└────────┬────────┘
         │ UDP 2000 (X-Ray Daemon)
         │ or gRPC 4317 (OTLP)
         ▼
┌─────────────────┐      ┌──────────────┐
│ X-Ray Daemon    │─────▶│  AWS X-Ray   │
│ (Sidecar)       │      │  Service     │
└─────────────────┘      └──────────────┘
         │
         │ (Alternative)
         ▼
┌─────────────────┐      ┌──────────────┐      ┌──────────────┐
│ OTel Collector  │─────▶│  AWS X-Ray   │      │   Jaeger     │
│                 │      │  (awsxray    │      │   (local)    │
│                 │─────▶│   exporter)  │      └──────────────┘
└─────────────────┘      └──────────────┘
```

## Usage

### Basic Setup

```hcl
module "xray" {
  source = "./modules/xray"

  name_prefix = "ananta-prod"

  # Sampling configuration
  default_sampling_rate    = 0.1  # 10% sampling
  default_reservoir_size   = 1

  # Enable encryption
  enable_kms_encryption = true
  kms_key_id            = ""  # Creates new key if empty

  # Enable X-Ray Insights
  enable_insights               = true
  enable_insights_notifications = false

  # CloudWatch alarms (requires SNS topic)
  alarm_sns_topic_arn   = aws_sns_topic.critical_alerts.arn
  error_rate_threshold  = 5.0   # 5% error rate
  latency_threshold_ms  = 1000  # 1 second

  tags = local.common_tags
}
```

### Attach X-Ray Policy to ECS Task Role

```hcl
resource "aws_iam_role_policy_attachment" "ecs_task_xray" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = module.xray.xray_write_policy_arn
}
```

### Add X-Ray Daemon Sidecar to ECS Task Definition

```hcl
container_definitions = jsonencode([
  {
    name  = "app"
    image = var.app_image
    # ... app config ...
    environment = [
      { name = "AWS_XRAY_DAEMON_ADDRESS", value = "xray-daemon:2000" }
    ]
  },
  {
    name      = "xray-daemon"
    image     = "public.ecr.aws/xray/aws-xray-daemon:latest"
    cpu       = 32
    memory    = 256
    essential = true
    portMappings = [{
      containerPort = 2000
      protocol      = "udp"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/aws/ecs/xray"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "xray-daemon"
      }
    }
  }
])
```

## Sampling Rules

The module creates the following sampling rules (priority order):

1. **Critical APIs** (priority 100): 100% sampling for POST /api/tenants*
2. **Auth APIs** (priority 200): 50% sampling for /auth/* endpoints
3. **Health Checks** (priority 300): 1% sampling for /health* endpoints
4. **Default** (priority 1000): Configurable sampling rate (default 10%)

### Customizing Sampling

To add custom sampling rules:

```hcl
resource "aws_xray_sampling_rule" "custom_api" {
  rule_name      = "${var.name_prefix}-custom-api"
  priority       = 150
  version        = 1
  reservoir_size = 5
  fixed_rate     = 0.8  # 80% sampling
  url_path       = "/api/custom/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"
}
```

## X-Ray Groups

Pre-configured trace groups for filtering:

- **api-services**: Traces from tenant-management-service and cns-service
- **workflows**: Traces from temporal-worker-service
- **errors**: All traces with errors or faults
- **slow-requests**: Requests taking > 1 second
- **tenant-operations**: Tenant provisioning and deletion operations

### Using Groups in X-Ray Console

```bash
# View traces in a specific group
https://console.aws.amazon.com/xray/home?region=us-east-1#/groups/ananta-prod-errors

# Filter by tenant ID (if annotated)
annotation.tenant_id = "tenant-123"

# Filter by error type
http.status = 500 OR http.status = 503
```

## Application Instrumentation

### Node.js (tenant-management-service)

```typescript
import AWSXRay from 'aws-xray-sdk-core';

// Instrument AWS SDK
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

// Instrument HTTP clients
const http = AWSXRay.captureHTTPs(require('http'));

// Add custom annotations
AWSXRay.getSegment().addAnnotation('tenant_id', tenantId);
AWSXRay.getSegment().addMetadata('user_data', userData);
```

### Python (CNS Service) with OpenTelemetry

```python
from app.observability.tracing import init_tracing, trace_function

# Initialize tracing (points to OTel Collector)
init_tracing(
    service_name="cns-service",
    otlp_endpoint="http://otel-collector:4317"
)

# Use decorator for automatic tracing
@trace_function(name="enrich_component")
async def enrich_component(mpn: str):
    # Function is automatically traced
    pass
```

## Monitoring and Alerts

### CloudWatch Alarms

The module creates alarms for:

- **High Error Rate**: Triggers when fault rate > threshold (default 5%)
- **High Latency**: Triggers when avg response time > threshold (default 1000ms)

Alarms send notifications to the provided SNS topic.

### X-Ray Insights

When enabled, X-Ray Insights automatically detects:

- Anomalous error rates
- Latency spikes
- Service degradations
- Root causes of issues

Access insights in X-Ray Console → Insights.

## Cost Optimization

### Reduce Tracing Costs

1. **Adjust sampling rates**:
   ```hcl
   default_sampling_rate = 0.05  # 5% instead of 10%
   ```

2. **Exclude health checks** (already configured at 1%)

3. **Use reservoir wisely**: Reserve traces for critical requests

4. **Set data retention**: X-Ray retains traces for 30 days (not configurable via Terraform)

### Estimated Costs

For 1M requests/month with 10% sampling:

- X-Ray traces: 100,000 traces/month = ~$5/month
- KMS: $1/month
- **Total: ~$6/month**

## Outputs

```hcl
module.xray.xray_write_policy_arn      # IAM policy for ECS tasks
module.xray.xray_kms_key_id            # KMS key for encryption
module.xray.xray_groups                # Map of group IDs
module.xray.sampling_rules             # Map of sampling rule ARNs
module.xray.xray_console_urls          # Quick links to X-Ray console
```

## Production Checklist

- [ ] Sampling rates optimized for traffic volume
- [ ] KMS encryption enabled
- [ ] X-Ray Insights enabled
- [ ] CloudWatch alarms configured with SNS topic
- [ ] ECS task roles have X-Ray write policy attached
- [ ] X-Ray daemon sidecar added to task definitions
- [ ] Application code instrumented with X-Ray SDK or OTLP
- [ ] Custom annotations added for tenant_id, user_id, etc.
- [ ] Service map reviewed in X-Ray console
- [ ] Runbook created for X-Ray alarm response

## Troubleshooting

### No traces appearing in X-Ray

1. Check ECS task role has X-Ray write permissions
2. Verify X-Ray daemon is running (check container logs)
3. Check application is sending traces (SDK configured correctly)
4. Verify sampling rules allow traces (check reservoir/fixed_rate)

### High costs

1. Review sampling rates - reduce for high-traffic endpoints
2. Check health check sampling (should be ~1%)
3. Verify no runaway trace generation
4. Consider using X-Ray Groups to filter expensive traces

### Missing annotations

1. Add annotations in application code:
   ```typescript
   AWSXRay.getSegment().addAnnotation('tenant_id', tenantId);
   ```
2. Verify annotations appear in X-Ray console trace details
3. Update X-Ray Groups filter expressions to use annotations

## References

- [AWS X-Ray Documentation](https://docs.aws.amazon.com/xray/)
- [X-Ray Sampling Rules](https://docs.aws.amazon.com/xray/latest/devguide/xray-console-sampling.html)
- [X-Ray SDK for Node.js](https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-nodejs.html)
- [OpenTelemetry AWS X-Ray Exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/awsxrayexporter)
