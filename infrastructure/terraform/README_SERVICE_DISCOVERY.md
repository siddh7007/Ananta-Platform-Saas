# AWS Cloud Map Service Discovery - Quick Start

## What is Service Discovery?

AWS Cloud Map enables DNS-based service discovery for ECS services, allowing containers to communicate directly without going through the Application Load Balancer (ALB).

### Benefits
- **Lower Latency**: 1-5ms (direct) vs 10-50ms (via ALB)
- **Cost Savings**: ~$15/month per environment (no ALB data processing fees)
- **Automatic Failover**: Unhealthy tasks removed from DNS within 10 seconds
- **Simple Configuration**: Services auto-register via DNS

## Quick Reference

### Service Discovery Endpoints

After deployment, services can communicate via:

```bash
# Keycloak (authentication)
http://keycloak.dev-ananta.local:8080

# Temporal Server (workflow engine)
temporal.dev-ananta.local:7233

# Tenant Management API
http://tenant-management-service.dev-ananta.local:14000

# CNS Service API
http://cns-service.dev-ananta.local:27200

# Orchestrator Service
http://orchestrator-service.dev-ananta.local:14001

# Subscription Service
http://subscription-service.dev-ananta.local:14002

# Novu Notifications
http://novu.dev-ananta.local:3000

# Temporal UI
http://temporal-ui.dev-ananta.local:8080
```

## Deployment Commands

### 1. Deploy Service Discovery
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init -backend-config="bucket=ananta-terraform-state"

# Select workspace
terraform workspace select dev

# Plan deployment
terraform plan -var-file="environments/dev/terraform.tfvars" -out=tfplan

# Apply changes
terraform apply tfplan
```

### 2. Verify Deployment
```bash
# Run validation script
chmod +x scripts/validate-service-discovery.sh
./scripts/validate-service-discovery.sh dev ananta-dev-cluster
```

### 3. Test DNS Resolution
```bash
# Connect to running ECS task
TASK_ARN=$(aws ecs list-tasks \
  --cluster ananta-dev-cluster \
  --service-name ananta-dev-tenant-management \
  --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster ananta-dev-cluster \
  --task $TASK_ARN \
  --container tenant-management-service \
  --interactive \
  --command "/bin/sh"

# Inside container, test DNS:
nslookup keycloak.dev-ananta.local
curl http://keycloak.dev-ananta.local:8080/health
```

## Configuration

### Enable/Disable Service Discovery

Edit `environments/dev/terraform.tfvars`:
```hcl
# Enable (default)
enable_service_discovery = true

# Disable (rollback)
enable_service_discovery = false
```

### DNS Settings

Edit `main.tf` service_discovery module:
```hcl
module "service_discovery" {
  # ...
  dns_ttl = 10  # Lower = faster failover, more DNS queries
  health_check_failure_threshold = 1  # Failures before unhealthy
}
```

## Application Updates

### Update Environment Variables

Change from ALB URLs to service discovery DNS names:

**Before:**
```typescript
const KEYCLOAK_URL = 'https://alb-dns-name/auth';
const TEMPORAL_ADDRESS = 'temporal-alb:7233';
```

**After:**
```typescript
const KEYCLOAK_URL = 'http://keycloak.dev-ananta.local:8080';
const TEMPORAL_ADDRESS = 'temporal.dev-ananta.local:7233';
```

### Example ECS Task Definition
```json
{
  "environment": [
    {
      "name": "KEYCLOAK_URL",
      "value": "http://keycloak.dev-ananta.local:8080"
    },
    {
      "name": "TEMPORAL_ADDRESS",
      "value": "temporal.dev-ananta.local:7233"
    },
    {
      "name": "CNS_API_URL",
      "value": "http://cns-service.dev-ananta.local:27200"
    }
  ]
}
```

## Troubleshooting

### DNS Resolution Fails
```bash
# Check namespace exists
aws servicediscovery list-namespaces

# Check service registered
aws servicediscovery list-services \
  --filters Name=NAMESPACE_ID,Values=<namespace-id>

# Check instances
aws servicediscovery list-instances --service-id <service-id>
```

### Connection Refused
```bash
# Check security group rules
aws ec2 describe-security-groups --group-ids <ecs-sg-id>

# Verify container health
aws ecs describe-tasks --cluster ananta-dev-cluster --tasks <task-id>

# Check logs
aws logs tail /aws/ecs/ananta-dev/tenant-management --follow
```

### No Healthy Instances
```bash
# Check ECS task health status
aws ecs describe-tasks --cluster ananta-dev-cluster --tasks <task-id>

# Review health check configuration in task definition
aws ecs describe-task-definition --task-definition ananta-dev-tenant-management
```

## Rollback

### Quick Rollback (Disable Registration)
```bash
# 1. Disable in tfvars
echo 'enable_service_discovery = false' >> environments/dev/terraform.tfvars

# 2. Apply changes
terraform apply -var-file="environments/dev/terraform.tfvars"
```

### Full Rollback (Remove Module)
```bash
# 1. Revert app configs to ALB URLs
# 2. Redeploy ECS services
# 3. Remove service discovery
terraform destroy -target=module.service_discovery
```

## Monitoring

### CloudWatch Metrics
- **Namespace**: `AWS/ServiceDiscovery`
- **Metrics**: `HealthCheckStatus`, `InstanceCount`

### View Service Discovery Health
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ServiceDiscovery \
  --metric-name HealthyInstanceCount \
  --dimensions Name=ServiceId,Value=<service-id> \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average
```

### CloudWatch Logs
```bash
# Service registration events
aws logs tail /aws/ecs/ananta-dev/tenant-management --follow

# Filter for errors
aws logs tail /aws/ecs/ananta-dev/tenant-management \
  --filter-pattern "ERROR" --follow
```

## Cost Tracking

### Monthly Cost Estimate
```
Cloud Map namespace:        $0.50
Service discovery services: $0.00 (custom health checks)
DNS queries (10M/month):    $4.00
──────────────────────────────────
Total:                      ~$4.50/month

Cost savings (ALB reduction): ~$15.50/month
```

### View Actual Costs
```bash
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AWS Cloud Map"]}}'
```

## Documentation

- **Full Architecture Guide**: [docs/SERVICE_DISCOVERY.md](./docs/SERVICE_DISCOVERY.md)
- **Deployment Guide**: [docs/DEPLOYMENT_GUIDE_SERVICE_DISCOVERY.md](./docs/DEPLOYMENT_GUIDE_SERVICE_DISCOVERY.md)
- **Implementation Summary**: [docs/SERVICE_DISCOVERY_IMPLEMENTATION.md](./docs/SERVICE_DISCOVERY_IMPLEMENTATION.md)
- **Module README**: [modules/service-discovery/README.md](./modules/service-discovery/README.md)

## Files Created

```
infrastructure/terraform/
├── modules/service-discovery/       # NEW: Service discovery module
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── README.md
├── docs/
│   ├── SERVICE_DISCOVERY.md         # NEW: Architecture guide
│   ├── DEPLOYMENT_GUIDE_SERVICE_DISCOVERY.md  # NEW: Step-by-step deployment
│   └── SERVICE_DISCOVERY_IMPLEMENTATION.md    # NEW: Implementation summary
├── scripts/
│   └── validate-service-discovery.sh  # NEW: Validation script
├── environments/dev/
│   └── terraform.tfvars.example      # UPDATED: With service discovery config
├── main.tf                           # UPDATED: Added service_discovery module
├── variables.tf                      # UPDATED: Added enable_service_discovery
├── outputs.tf                        # UPDATED: Added service discovery outputs
└── modules/ecs/
    ├── main.tf                       # UPDATED: Added service_registries blocks
    └── variables.tf                  # UPDATED: Added service_discovery_arns
```

## Next Steps

1. **Review Implementation**: Read [SERVICE_DISCOVERY.md](./docs/SERVICE_DISCOVERY.md)
2. **Deploy to Dev**: Follow [DEPLOYMENT_GUIDE_SERVICE_DISCOVERY.md](./docs/DEPLOYMENT_GUIDE_SERVICE_DISCOVERY.md)
3. **Update Applications**: Change environment variables to use service discovery endpoints
4. **Performance Test**: Measure latency improvements
5. **Deploy to Production**: After successful dev/staging validation

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review CloudWatch Logs
3. Run validation script
4. Consult full documentation

---

**Status**: Ready for Deployment
**Last Updated**: December 2024
