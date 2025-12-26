# AWS Cloud Map Service Discovery Module

This module creates AWS Cloud Map service discovery for ECS services, enabling DNS-based service-to-service communication within the VPC.

## Features

- **Private DNS Namespace**: Creates a Route 53 private hosted zone for service discovery
- **Automatic Service Registration**: ECS tasks automatically register/deregister on start/stop
- **Health Monitoring**: Integrates with ECS container health checks
- **Low Latency**: DNS-based discovery with configurable TTL (default: 10 seconds)
- **Multi-Instance Support**: MULTIVALUE routing policy for load distribution

## Usage

```hcl
module "service_discovery" {
  source = "./modules/service-discovery"

  name_prefix = "ananta-dev"
  vpc_id      = module.network.vpc_id

  # HTTP services with ALB endpoints
  services = {
    "tenant-management-service" = {
      port              = 14000
      health_check_path = "/health"
    }
    "cns-service" = {
      port              = 27200
      health_check_path = "/health"
    }
    "keycloak" = {
      port              = 8080
      health_check_path = "/health"
    }
  }

  # Internal services (gRPC, TCP)
  internal_services = {
    "temporal" = {
      port     = 7233
      protocol = "grpc"
    }
  }

  tags = local.common_tags
}
```

## Service Discovery Endpoints

After deployment, services can communicate using DNS names:

```bash
# From any ECS task in the same VPC:
curl http://tenant-management-service.ananta-dev.local:14000/health
curl http://keycloak.ananta-dev.local:8080/auth/realms/master

# Temporal worker connection:
TEMPORAL_ADDRESS=temporal.ananta-dev.local:7233
```

## ECS Service Registration

To register an ECS service with Cloud Map, add `service_registries` to the service definition:

```hcl
resource "aws_ecs_service" "tenant_mgmt" {
  name            = "tenant-management-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.tenant_mgmt.arn

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.ecs_security_group_id]
  }

  # Service Discovery Registration
  service_registries {
    registry_arn   = module.service_discovery.service_arns["tenant-management-service"]
    container_name = "tenant-management-service"  # Must match container name in task definition
    container_port = 14000
  }
}
```

## DNS Resolution Behavior

- **TTL**: 10 seconds (configurable) - balances failover speed vs DNS query load
- **Routing Policy**: MULTIVALUE - returns all healthy instance IPs
- **Health Checks**: ECS task health status determines DNS record registration
- **Automatic Cleanup**: Unhealthy/stopped tasks are removed from DNS within 1 failure threshold

## Architecture Benefits

### Before (ALB-only):
```
Service A → ALB → Service B
  - Extra hop through ALB
  - ALB costs for internal traffic
  - Path-based routing complexity
```

### After (Cloud Map):
```
Service A → DNS lookup → Service B (direct)
  - Direct container-to-container communication
  - No ALB costs for internal traffic
  - Simple service name resolution
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| name_prefix | Prefix for namespace (e.g., 'ananta-dev') | string | - | yes |
| vpc_id | VPC ID for private DNS namespace | string | - | yes |
| services | Map of HTTP services with health checks | map(object) | {} | no |
| internal_services | Map of internal TCP/gRPC services | map(object) | {} | no |
| dns_ttl | DNS record TTL in seconds | number | 10 | no |
| health_check_failure_threshold | Health check failures before unhealthy | number | 1 | no |
| tags | Resource tags | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| namespace_id | Cloud Map namespace ID |
| namespace_name | DNS namespace (e.g., 'ananta-dev.local') |
| service_arns | Map of service names to ARNs (for ECS registration) |
| service_discovery_endpoints | Map of service names to DNS endpoints |
| temporal_address | Temporal server address (host:port) |
| keycloak_internal_url | Keycloak internal URL |

## Common Service Configurations

### Control Plane Services
- tenant-management-service: 14000 (HTTP)
- orchestrator-service: 14001 (HTTP)
- subscription-service: 14002 (HTTP)
- temporal-worker-service: N/A (worker only, no HTTP)

### App Plane Services
- cns-service: 27200 (HTTP)

### Infrastructure Services
- keycloak: 8080 (HTTP)
- temporal: 7233 (gRPC)
- temporal-ui: 8080 (HTTP)

### Frontend Services
- admin-app: 80 (HTTP)
- customer-portal: 80 (HTTP)
- cns-dashboard: 80 (HTTP)

### Notification Services
- novu: 3000 (HTTP)

## Security Considerations

1. **VPC Isolation**: Service discovery DNS is only accessible within the VPC
2. **Security Groups**: Still required for network-level access control
3. **TLS**: Consider using mTLS for service-to-service encryption
4. **Service Mesh**: For advanced features (circuit breaking, retries), consider AWS App Mesh

## Troubleshooting

### Service not discoverable
```bash
# Check namespace exists
aws servicediscovery list-namespaces

# Check service registration
aws servicediscovery list-services --filters Name=NAMESPACE_ID,Values=<namespace-id>

# Verify DNS resolution from ECS task
aws ecs execute-command --cluster <cluster> --task <task-id> \
  --command "nslookup tenant-management-service.ananta-dev.local"
```

### Health check failures
- Verify container health check passes in task definition
- Check ECS service health status in console
- Review CloudWatch logs for container failures

## Future Enhancements

- [ ] AWS App Mesh integration for service mesh capabilities
- [ ] Multi-region service discovery with Route 53 health checks
- [ ] Custom health check endpoints per service
- [ ] Service discovery metrics (query rate, health status)

## References

- [AWS Cloud Map Documentation](https://docs.aws.amazon.com/cloud-map/)
- [ECS Service Discovery](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-discovery.html)
- [DNS-based Service Discovery Best Practices](https://aws.amazon.com/blogs/compute/service-discovery-via-consul-with-amazon-ecs/)
