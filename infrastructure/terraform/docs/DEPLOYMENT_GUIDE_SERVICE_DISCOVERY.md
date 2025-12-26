# Service Discovery Deployment Guide

## Overview

This guide walks through deploying AWS Cloud Map service discovery for the Ananta Platform SaaS infrastructure.

## Prerequisites

- [x] Terraform >= 1.5.0
- [x] AWS CLI configured with appropriate credentials
- [x] Existing VPC and ECS infrastructure deployed
- [x] S3 backend configured for Terraform state

## Pre-Deployment Checklist

### 1. Review Current Architecture
```bash
# Check current ECS services
aws ecs list-services --cluster ananta-dev-cluster

# Check current ALB target groups
aws elbv2 describe-target-groups --region us-east-1
```

### 2. Verify Security Groups
Ensure ECS security group allows internal communication:
```bash
# Check ECS security group rules
aws ec2 describe-security-groups \
  --group-ids <ecs-security-group-id> \
  --query 'SecurityGroups[0].IpPermissions'
```

Required rule:
```hcl
# ECS tasks can communicate with each other
ingress {
  from_port   = 0
  to_port     = 65535
  protocol    = "tcp"
  self        = true  # Allow traffic from same security group
}
```

### 3. Backup Current State
```bash
# Download current Terraform state
terraform state pull > backup-state-$(date +%Y%m%d).json

# List current resources
terraform state list > backup-resources-$(date +%Y%m%d).txt
```

## Deployment Steps

### Step 1: Review Service Discovery Configuration

Edit `main.tf` to verify service configuration:

```hcl
module "service_discovery" {
  source = "./modules/service-discovery"

  name_prefix = local.name_prefix
  vpc_id      = module.network.vpc_id

  # HTTP services exposed via ALB
  services = {
    "tenant-management-service" = {
      port              = 14000
      health_check_path = "/health"
    }
    "cns-service" = {
      port              = 27200
      health_check_path = "/health"
    }
    # ... other services ...
  }

  # Internal services (gRPC, TCP - no ALB)
  internal_services = {
    "temporal" = {
      port     = 7233
      protocol = "grpc"
    }
  }

  dns_ttl                        = 10
  health_check_failure_threshold = 1

  tags = local.common_tags
}
```

### Step 2: Initialize Terraform

```bash
cd infrastructure/terraform

# Initialize with backend configuration
terraform init -backend-config="bucket=ananta-terraform-state" \
               -backend-config="key=dev/terraform.tfstate" \
               -backend-config="region=us-east-1"

# Select workspace
terraform workspace select dev
```

### Step 3: Plan Deployment

```bash
# Generate and review plan
terraform plan -var-file="environments/dev/terraform.tfvars" -out=tfplan

# Expected new resources:
# + aws_service_discovery_private_dns_namespace.main
# + aws_service_discovery_service.services["tenant-management-service"]
# + aws_service_discovery_service.services["cns-service"]
# + aws_service_discovery_service.services["keycloak"]
# + aws_service_discovery_service.services["temporal-ui"]
# + aws_service_discovery_service.services["novu"]
# + aws_service_discovery_service.internal_services["temporal"]
# ~ aws_ecs_service.tenant_mgmt (updated with service_registries)
# ~ aws_ecs_service.cns_service (updated with service_registries)
# ~ aws_ecs_service.keycloak (updated with service_registries)
# ~ aws_ecs_service.temporal (updated with service_registries)
```

### Step 4: Deploy Service Discovery (Staged Approach)

#### Stage 1: Create Namespace and Services (Non-Breaking)
```bash
# Apply only service discovery module
terraform apply -target=module.service_discovery \
                -var-file="environments/dev/terraform.tfvars"
```

Verify:
```bash
# Check namespace created
aws servicediscovery list-namespaces

# Expected output:
# {
#   "Namespaces": [
#     {
#       "Id": "ns-xxxxx",
#       "Arn": "arn:aws:servicediscovery:...",
#       "Name": "dev-ananta.local",
#       "Type": "DNS_PRIVATE"
#     }
#   ]
# }

# Check services created
aws servicediscovery list-services
```

#### Stage 2: Register ECS Services
```bash
# Apply full configuration to register ECS services
terraform apply -var-file="environments/dev/terraform.tfvars"
```

### Step 5: Verify Service Registration

```bash
# List instances registered to tenant-management-service
SERVICE_ID=$(aws servicediscovery list-services \
  --filters Name=NAMESPACE_ID,Values=<namespace-id> \
  --query "Services[?Name=='tenant-management-service'].Id" \
  --output text)

aws servicediscovery list-instances --service-id $SERVICE_ID

# Expected output:
# {
#   "Instances": [
#     {
#       "Id": "task-id-xxxxx",
#       "Attributes": {
#         "AWS_INSTANCE_IPV4": "10.0.11.45",
#         "AWS_INSTANCE_PORT": "14000"
#       }
#     }
#   ]
# }
```

### Step 6: Test DNS Resolution

Connect to a running ECS task:
```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks --cluster ananta-dev-cluster \
  --service-name ananta-dev-tenant-management \
  --query 'taskArns[0]' --output text)

# Enable ECS Exec (if not already enabled)
aws ecs update-service \
  --cluster ananta-dev-cluster \
  --service ananta-dev-tenant-management \
  --enable-execute-command

# Connect to task
aws ecs execute-command \
  --cluster ananta-dev-cluster \
  --task $TASK_ARN \
  --container tenant-management-service \
  --interactive \
  --command "/bin/sh"
```

Inside the container, test DNS:
```bash
# Test Keycloak discovery
nslookup keycloak.dev-ananta.local
# Should return one or more IP addresses

# Test HTTP connectivity
curl http://keycloak.dev-ananta.local:8080/health
# Should return 200 OK

# Test Temporal discovery
nslookup temporal.dev-ananta.local
# Should return Temporal server IP

# Test CNS service
curl http://cns-service.dev-ananta.local:27200/health
```

### Step 7: Update Application Configuration

Update environment variables in ECS task definitions to use service discovery:

**Before:**
```json
{
  "environment": [
    { "name": "KEYCLOAK_URL", "value": "https://alb-dns-name/auth" },
    { "name": "TEMPORAL_ADDRESS", "value": "temporal-alb:7233" }
  ]
}
```

**After:**
```json
{
  "environment": [
    { "name": "KEYCLOAK_URL", "value": "http://keycloak.dev-ananta.local:8080" },
    { "name": "TEMPORAL_ADDRESS", "value": "temporal.dev-ananta.local:7233" }
  ]
}
```

You can use Terraform outputs to automatically populate these:
```hcl
environment = [
  {
    name  = "KEYCLOAK_URL"
    value = module.service_discovery.keycloak_internal_url
  },
  {
    name  = "TEMPORAL_ADDRESS"
    value = module.service_discovery.temporal_address
  }
]
```

### Step 8: Monitor Health

```bash
# Check ECS service health
aws ecs describe-services \
  --cluster ananta-dev-cluster \
  --services ananta-dev-tenant-management

# Check CloudWatch Logs for service discovery events
aws logs tail /aws/ecs/ananta-dev/tenant-management --follow
```

## Post-Deployment Validation

### 1. Verify All Services Registered
```bash
# Get namespace ID
NAMESPACE_ID=$(terraform output -raw service_discovery_namespace_id)

# List all registered services
aws servicediscovery list-services \
  --filters Name=NAMESPACE_ID,Values=$NAMESPACE_ID
```

Expected services:
- tenant-management-service
- cns-service
- orchestrator-service
- subscription-service
- keycloak
- temporal
- temporal-ui
- novu

### 2. Test Inter-Service Communication
```bash
# From tenant-management service, call CNS service
curl -X GET \
  http://cns-service.dev-ananta.local:27200/health \
  -H "Content-Type: application/json"

# From any service, validate token with Keycloak
curl -X POST \
  http://keycloak.dev-ananta.local:8080/auth/realms/master/protocol/openid-connect/token \
  -d "grant_type=client_credentials" \
  -d "client_id=test-client" \
  -d "client_secret=secret"
```

### 3. Verify Temporal Worker Connection
Check temporal worker logs:
```bash
aws logs tail /aws/ecs/ananta-dev/temporal-worker --follow --format short
```

Look for:
```
Successfully connected to Temporal server at temporal.dev-ananta.local:7233
Worker started for task queue: tenant-provisioning
```

### 4. Performance Testing
Compare latency before and after:
```bash
# From ECS task, test latency
time curl http://keycloak.dev-ananta.local:8080/health
# Expected: ~1-5ms (direct)

# Compare to ALB (for reference)
time curl https://alb-dns-name/auth/health
# Previous: ~10-50ms (extra hop)
```

## Rollback Procedure

If issues occur, follow this rollback plan:

### Quick Rollback (Disable Registration)
```bash
# 1. Disable service discovery in tfvars
echo 'enable_service_discovery = false' >> environments/dev/terraform.tfvars

# 2. Apply changes (removes service_registries from ECS services)
terraform apply -var-file="environments/dev/terraform.tfvars"
```

### Full Rollback (Remove Service Discovery)
```bash
# 1. Revert application environment variables to ALB URLs
# Update task definitions to use ALB endpoints

# 2. Redeploy ECS services with updated task definitions
aws ecs update-service \
  --cluster ananta-dev-cluster \
  --service ananta-dev-tenant-management \
  --force-new-deployment

# 3. Remove service discovery resources
terraform destroy -target=module.service_discovery \
                  -var-file="environments/dev/terraform.tfvars"
```

## Troubleshooting

### Issue: DNS Resolution Fails

**Symptoms:**
```bash
$ nslookup keycloak.dev-ananta.local
** server can't find keycloak.dev-ananta.local: NXDOMAIN
```

**Solutions:**
1. Check namespace exists:
   ```bash
   aws servicediscovery list-namespaces
   ```

2. Verify service registered:
   ```bash
   aws servicediscovery list-services
   ```

3. Check ECS task health:
   ```bash
   aws ecs describe-tasks --cluster ananta-dev-cluster --tasks <task-id>
   # Look for healthStatus: "HEALTHY"
   ```

### Issue: Connection Refused After DNS Lookup

**Symptoms:**
```bash
$ curl http://keycloak.dev-ananta.local:8080/health
curl: (7) Failed to connect to keycloak.dev-ananta.local port 8080: Connection refused
```

**Solutions:**
1. Check security group rules:
   ```bash
   aws ec2 describe-security-groups --group-ids <ecs-sg-id>
   ```

2. Verify container port mapping:
   ```bash
   aws ecs describe-task-definition --task-definition ananta-dev-keycloak
   # Check portMappings.containerPort = 8080
   ```

3. Check service is actually listening:
   ```bash
   # Inside container
   netstat -tuln | grep 8080
   ```

### Issue: Some Instances Not Registered

**Symptoms:**
Only 1 out of 2 tasks appears in DNS results.

**Solutions:**
1. Check task health status:
   ```bash
   aws ecs list-tasks --cluster ananta-dev-cluster \
     --service-name ananta-dev-keycloak

   aws ecs describe-tasks --cluster ananta-dev-cluster \
     --tasks <task-id-1> <task-id-2>
   ```

2. Review health check configuration:
   ```hcl
   healthCheck = {
     command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
     interval    = 30
     timeout     = 5
     retries     = 3
     startPeriod = 60
   }
   ```

3. Check CloudWatch Logs for health check failures:
   ```bash
   aws logs tail /aws/ecs/ananta-dev/keycloak --follow
   ```

## Monitoring & Alerts

### CloudWatch Alarms

Create alarms for service discovery health:

```hcl
resource "aws_cloudwatch_metric_alarm" "service_discovery_unhealthy" {
  alarm_name          = "service-discovery-unhealthy-instances"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthyInstanceCount"
  namespace           = "AWS/ServiceDiscovery"
  period              = "60"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Alert when no healthy instances available"

  dimensions = {
    ServiceId = aws_service_discovery_service.services["tenant-management-service"].id
  }
}
```

### CloudWatch Dashboard

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ServiceDiscovery", "HealthyInstanceCount", { "stat": "Average" }]
        ],
        "period": 60,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Service Discovery - Healthy Instances"
      }
    }
  ]
}
```

## Cost Tracking

Monitor Cloud Map costs:
```bash
# Check monthly costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter file://cost-filter.json

# cost-filter.json:
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["AWS Cloud Map"]
  }
}
```

## Next Steps

After successful deployment:

1. **Update Application Code**: Migrate all services to use service discovery endpoints
2. **Performance Monitoring**: Track latency improvements
3. **Cost Analysis**: Measure ALB cost savings
4. **Consider App Mesh**: Evaluate AWS App Mesh for advanced service mesh features
5. **Multi-Region**: Plan for cross-region service discovery

## References

- [Service Discovery Module README](../modules/service-discovery/README.md)
- [AWS Cloud Map Documentation](https://docs.aws.amazon.com/cloud-map/)
- [ECS Service Discovery](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-discovery.html)
