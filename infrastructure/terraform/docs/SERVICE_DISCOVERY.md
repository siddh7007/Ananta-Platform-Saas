# AWS Cloud Map Service Discovery Implementation

## Overview

This document describes the AWS Cloud Map service discovery implementation for the Ananta Platform SaaS infrastructure, enabling DNS-based service-to-service communication within the VPC.

## Architecture

### Service Discovery Namespace

A private DNS namespace is created in Route 53:
```
<environment>-ananta.local
```

Examples:
- `dev-ananta.local`
- `staging-ananta.local`
- `prod-ananta.local`

### Registered Services

#### HTTP Services (ALB + Service Discovery)
| Service | DNS Name | Port | Health Check |
|---------|----------|------|--------------|
| Tenant Management | `tenant-management-service.dev-ananta.local` | 14000 | `/health` |
| CNS Service | `cns-service.dev-ananta.local` | 27200 | `/health` |
| Orchestrator | `orchestrator-service.dev-ananta.local` | 14001 | `/health` |
| Subscription | `subscription-service.dev-ananta.local` | 14002 | `/health` |
| Keycloak | `keycloak.dev-ananta.local` | 8080 | `/health` |
| Temporal UI | `temporal-ui.dev-ananta.local` | 8080 | `/` |
| Novu | `novu.dev-ananta.local` | 3000 | `/v1/health-check` |

#### Internal Services (Service Discovery Only)
| Service | DNS Name | Port | Protocol |
|---------|----------|------|----------|
| Temporal Server | `temporal.dev-ananta.local` | 7233 | gRPC |

## Benefits

### 1. Direct Service-to-Service Communication
```
Before (ALB-only):
Service A → ALB → Service B
  - Extra hop adds latency (10-50ms)
  - ALB costs for internal traffic
  - Complex path-based routing

After (Cloud Map):
Service A → DNS lookup → Service B (direct)
  - Direct container-to-container (1-5ms)
  - No ALB costs for internal calls
  - Simple DNS resolution
```

### 2. Automatic Service Registration
- ECS tasks automatically register on start
- Unhealthy tasks removed from DNS immediately
- No manual configuration required

### 3. Load Distribution
- MULTIVALUE routing policy returns all healthy IPs
- Client-side load balancing
- Failover within 10 seconds (configurable TTL)

### 4. Cost Optimization
- Internal traffic bypasses ALB (saves $0.008/GB)
- Reduced ALB processing costs
- Only DNS query costs ($0.40/million queries)

## Implementation Details

### Module Structure
```
modules/service-discovery/
├── main.tf          # Cloud Map resources
├── variables.tf     # Input variables
├── outputs.tf       # Service endpoints
└── README.md        # Module documentation
```

### Service Registration in ECS

Each ECS service includes a dynamic `service_registries` block:

```hcl
resource "aws_ecs_service" "tenant_mgmt" {
  name            = "${var.name_prefix}-tenant-management"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.tenant_mgmt.arn

  # ... network configuration ...

  # Service Discovery Registration
  dynamic "service_registries" {
    for_each = var.enable_service_discovery && contains(keys(var.service_discovery_arns), "tenant-management-service") ? [1] : []
    content {
      registry_arn   = var.service_discovery_arns["tenant-management-service"]
      container_name = "tenant-management-service"
      container_port = 14000
    }
  }
}
```

### Configuration

#### Enable/Disable Service Discovery
```hcl
# In terraform.tfvars
enable_service_discovery = true  # Default
```

#### DNS Configuration
```hcl
# In modules/service-discovery/variables.tf
dns_ttl = 10  # seconds (faster failover, more DNS queries)
health_check_failure_threshold = 1  # failures before unhealthy
```

## Usage Examples

### Backend Service to Keycloak
```typescript
// Before (via ALB)
const keycloakUrl = 'https://alb-dns-name/auth';

// After (via Service Discovery)
const keycloakUrl = 'http://keycloak.dev-ananta.local:8080';
```

### Temporal Worker Connection
```typescript
// Before (hardcoded IP or ALB)
const temporalAddress = 'temporal-alb:7233';

// After (via Service Discovery)
const temporalAddress = 'temporal.dev-ananta.local:7233';
```

### Environment Variables for Services
```bash
# In ECS task definition environment variables
KEYCLOAK_INTERNAL_URL=http://keycloak.dev-ananta.local:8080
TEMPORAL_ADDRESS=temporal.dev-ananta.local:7233
TENANT_MGMT_API=http://tenant-management-service.dev-ananta.local:14000
CNS_API=http://cns-service.dev-ananta.local:27200
```

## Health Checks

### Container Health Checks
Service discovery relies on ECS container health checks:

```hcl
healthCheck = {
  command     = ["CMD-SHELL", "curl -f http://localhost:14000/health || exit 1"]
  interval    = 30
  timeout     = 5
  retries     = 3
  startPeriod = 60
}
```

### Health Check Behavior
1. **Container starts**: Not registered until first successful health check
2. **Health check passes**: IP added to DNS within 10 seconds (TTL)
3. **Health check fails**: IP removed from DNS after 1 failure (configurable)
4. **Container stops**: IP removed immediately

## DNS Resolution Behavior

### TTL (Time to Live): 10 seconds
- **Lower TTL (5s)**: Faster failover, higher DNS query volume
- **Higher TTL (60s)**: Lower DNS query costs, slower failover

### Routing Policy: MULTIVALUE
```bash
# DNS query returns all healthy IPs
$ nslookup tenant-management-service.dev-ananta.local

Name:    tenant-management-service.dev-ananta.local
Address: 10.0.3.45
Address: 10.0.4.67
Address: 10.0.5.89
```

Clients distribute requests across all returned IPs.

## Security Considerations

### VPC Isolation
- DNS namespace is VPC-private only
- Not resolvable from public internet
- Only accessible from ECS tasks in the same VPC

### Security Groups
Security groups still enforce network access:
```hcl
# ECS tasks can communicate on application ports
resource "aws_security_group_rule" "ecs_to_ecs" {
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  security_group_id = aws_security_group.ecs.id
}
```

### TLS Recommendations
For production, consider:
1. **mTLS**: Mutual TLS for service-to-service encryption
2. **AWS App Mesh**: Service mesh with automatic mTLS
3. **Certificate Management**: AWS Certificate Manager Private CA

## Monitoring & Debugging

### Check Service Registration
```bash
# List all services in namespace
aws servicediscovery list-services \
  --filters Name=NAMESPACE_ID,Values=<namespace-id>

# List instances registered to a service
aws servicediscovery list-instances \
  --service-id <service-id>
```

### Test DNS Resolution from ECS Task
```bash
# Connect to running task
aws ecs execute-command \
  --cluster ananta-dev-cluster \
  --task <task-id> \
  --container tenant-management-service \
  --interactive \
  --command "/bin/sh"

# Inside container
nslookup keycloak.dev-ananta.local
curl http://keycloak.dev-ananta.local:8080/health
```

### CloudWatch Metrics
Monitor via CloudWatch:
- `AWS/ServiceDiscovery/HealthCheckStatus`
- `AWS/ServiceDiscovery/InstanceCount`

### Common Issues

#### Service not discoverable
1. Check ECS service has `service_registries` block
2. Verify container health check passes
3. Confirm namespace exists in Route 53
4. Check DNS resolution from task

#### DNS returns no results
1. Verify at least one task is healthy
2. Check health check configuration
3. Review ECS task health status
4. Check CloudWatch Logs for health check failures

#### Connection refused after DNS lookup
1. Verify security group rules allow traffic
2. Check container is listening on correct port
3. Confirm port mapping in task definition
4. Review application logs

## Cost Analysis

### Cloud Map Pricing (US East 1)
- **Hosted Zone**: $0.50/month per namespace
- **Service Discovery**: Included
- **Health Checks**: $0.50/health check/month (custom config = free)
- **DNS Queries**: $0.40/million queries

### Example Monthly Cost (Dev Environment)
```
1 namespace                     = $0.50
8 services                      = $0.00 (custom health checks)
Estimated 10M DNS queries/month = $4.00
-------------------------------------------
Total                           ≈ $4.50/month
```

### Cost Savings vs ALB-only
```
ALB data processing: $0.008/GB
Internal traffic: ~100GB/month
Savings: $100/month - $4.50 = $95.50/month
```

## Migration Guide

### Phase 1: Deploy Service Discovery (Non-Breaking)
```bash
cd infrastructure/terraform
terraform apply -target=module.service_discovery
```

### Phase 2: Update Application Code
Update service URLs to use service discovery DNS names:
```diff
- KEYCLOAK_URL=https://alb-dns-name/auth
+ KEYCLOAK_URL=http://keycloak.dev-ananta.local:8080
```

### Phase 3: Enable ECS Registration
```bash
terraform apply  # Applies service_registries blocks
```

### Rollback Plan
If issues occur, disable service discovery:
```hcl
# In terraform.tfvars
enable_service_discovery = false
```

Then revert application environment variables to ALB URLs.

## Future Enhancements

### AWS App Mesh Integration
For advanced service mesh capabilities:
- Automatic mTLS encryption
- Circuit breaking patterns
- Retry policies
- Traffic shaping (canary, blue/green)
- Distributed tracing integration

Configuration example:
```hcl
module "app_mesh" {
  source = "./modules/app-mesh"

  mesh_name             = "${var.name_prefix}-mesh"
  service_discovery_arn = module.service_discovery.namespace_arn

  services = {
    tenant-management-service = {
      port              = 14000
      protocol          = "http"
      enable_mtls       = true
      circuit_breaker   = true
      retry_policy      = "5xx,timeout"
    }
  }
}
```

### Multi-Region Service Discovery
For cross-region deployments:
- Route 53 health checks for regional failover
- Global Accelerator for low-latency routing
- Cross-region DNS namespace peering

## References

- [AWS Cloud Map Documentation](https://docs.aws.amazon.com/cloud-map/)
- [ECS Service Discovery Guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-discovery.html)
- [Service Discovery Best Practices](https://aws.amazon.com/blogs/compute/service-discovery-via-consul-with-amazon-ecs/)
- [AWS App Mesh](https://aws.amazon.com/app-mesh/)
- [DNS for ECS Tasks](https://aws.amazon.com/blogs/compute/task-networking-in-aws-fargate/)

## Support

For issues or questions:
1. Check CloudWatch Logs: `/aws/ecs/<service-name>`
2. Review ECS service events in console
3. Test DNS resolution from running tasks
4. Check security group rules
5. Verify health check configurations
