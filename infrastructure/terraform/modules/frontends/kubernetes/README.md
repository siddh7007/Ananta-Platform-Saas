# Kubernetes Frontend Applications Module

This Terraform module deploys all 5 frontend applications for the Ananta Platform on Kubernetes:

1. **admin-app** - React app (Control Plane admin portal) - Port 27555
2. **customer-portal** - React app (Customer facing) - Port 27100
3. **cns-dashboard** - React Admin (CNS Admin UI) - Port 27250
4. **backstage-portal** - Backstage (Admin portal) - Port 27150
5. **dashboard** - Next.js (Unified dashboard) - Port 27400

## Features

- **Conditional Deployment**: Deploy only the frontends you need via `deploy_*` flags
- **Shared Configuration**: Centralized ConfigMap for API URLs, Keycloak, and feature flags
- **Health Probes**: Liveness and readiness probes for all applications
- **Resource Management**: Configurable CPU/memory requests and limits
- **Ingress Support**: Optional Ingress with TLS for external access
- **Multiple Replicas**: Configurable replica counts for high availability
- **Standard Labels**: Kubernetes recommended labels for all resources

## Usage

### Basic Example

```hcl
module "frontends" {
  source = "../../modules/frontends/kubernetes"

  name_prefix = "ananta"
  environment = "dev"
  namespace   = "frontends"

  # API URLs
  control_plane_api_url = "http://tenant-mgmt.control-plane.svc.cluster.local:14000"
  cns_api_url           = "http://cns-service.app-plane.svc.cluster.local:27200"
  supabase_url          = "http://supabase-api.app-plane.svc.cluster.local:27810"
  supabase_anon_key     = var.supabase_anon_key

  # Keycloak
  keycloak_url       = "http://keycloak.auth.svc.cluster.local:8080"
  keycloak_realm     = "ananta"
  keycloak_client_id = "ananta-admin-app"

  # Feature flags
  enable_billing    = true
  enable_workflows  = true
  enable_monitoring = true

  # Docker images
  admin_app_image        = "ananta/admin-app:v1.0.0"
  customer_portal_image  = "ananta/customer-portal:v1.0.0"
  cns_dashboard_image    = "ananta/cns-dashboard:v1.0.0"
  dashboard_image        = "ananta/dashboard:v1.0.0"
}
```

### Deploy Specific Frontends

```hcl
module "frontends" {
  source = "../../modules/frontends/kubernetes"

  name_prefix = "ananta"
  environment = "prod"

  # Deploy only admin-app and customer-portal
  deploy_admin_app        = true
  deploy_customer_portal  = true
  deploy_cns_dashboard    = false
  deploy_backstage_portal = false
  deploy_dashboard        = false

  # ... other configuration ...
}
```

### With Ingress

```hcl
module "frontends" {
  source = "../../modules/frontends/kubernetes"

  name_prefix = "ananta"
  environment = "prod"

  # Enable Ingress
  create_ingress     = true
  ingress_class      = "nginx"
  ingress_tls_enabled = true
  ingress_tls_secret  = "ananta-tls"

  # Custom hostnames
  admin_app_hostname       = "admin.ananta.com"
  customer_portal_hostname = "portal.ananta.com"
  cns_dashboard_hostname   = "cns.ananta.com"
  dashboard_hostname       = "dashboard.ananta.com"

  ingress_hosts = [
    "admin.ananta.com",
    "portal.ananta.com",
    "cns.ananta.com",
    "dashboard.ananta.com"
  ]

  ingress_annotations = {
    "cert-manager.io/cluster-issuer" = "letsencrypt-prod"
    "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
  }

  # ... other configuration ...
}
```

### High Availability Setup

```hcl
module "frontends" {
  source = "../../modules/frontends/kubernetes"

  name_prefix = "ananta"
  environment = "prod"

  # Multiple replicas for HA
  admin_app_replicas       = 3
  customer_portal_replicas = 5
  cns_dashboard_replicas   = 2
  dashboard_replicas       = 3

  # Increased resources for production
  admin_app_cpu_limit    = "1000m"
  admin_app_memory_limit = "1Gi"

  customer_portal_cpu_limit    = "1000m"
  customer_portal_memory_limit = "1Gi"

  # ... other configuration ...
}
```

## Variables

### Required Variables

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `name_prefix` | Prefix for resource names | `string` | - |

### Kubernetes Configuration

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `namespace` | Kubernetes namespace | `string` | `"frontends"` |
| `create_namespace` | Create namespace if it doesn't exist | `bool` | `true` |
| `environment` | Environment name (dev, staging, prod) | `string` | `"dev"` |
| `labels` | Additional labels for all resources | `map(string)` | `{}` |

### API URLs

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `api_url` | Base API URL | `string` | `"http://localhost:14000"` |
| `control_plane_api_url` | Control Plane API URL | `string` | `"http://localhost:14000"` |
| `cns_api_url` | CNS API URL | `string` | `"http://localhost:27200"` |
| `supabase_url` | Supabase API URL | `string` | `"http://localhost:27810"` |
| `supabase_anon_key` | Supabase anonymous key | `string` | `""` |

### Keycloak Configuration

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `keycloak_url` | Keycloak server URL | `string` | `"http://localhost:8180"` |
| `keycloak_realm` | Keycloak realm name | `string` | `"ananta"` |
| `keycloak_client_id` | Keycloak client ID | `string` | `"ananta-admin-app"` |

### Feature Flags

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `enable_billing` | Enable billing features | `bool` | `true` |
| `enable_workflows` | Enable workflow features | `bool` | `true` |
| `enable_monitoring` | Enable monitoring features | `bool` | `true` |
| `enable_audit_logs` | Enable audit log features | `bool` | `true` |

### Frontend-Specific Variables

Each frontend (admin-app, customer-portal, cns-dashboard, backstage-portal, dashboard) has the following variables:

| Name Pattern | Description | Type | Default |
|--------------|-------------|------|---------|
| `deploy_<frontend>` | Deploy this frontend | `bool` | Varies |
| `<frontend>_image` | Docker image | `string` | `"ananta/<frontend>:latest"` |
| `<frontend>_replicas` | Number of replicas | `number` | 1-2 |
| `<frontend>_port` | Service port | `number` | See above |
| `<frontend>_cpu_request` | CPU request | `string` | `"100m"` |
| `<frontend>_cpu_limit` | CPU limit | `string` | `"500m"` |
| `<frontend>_memory_request` | Memory request | `string` | `"128Mi"` |
| `<frontend>_memory_limit` | Memory limit | `string` | `"512Mi"` |
| `<frontend>_hostname` | Ingress hostname | `string` | `"<frontend>.ananta.local"` |

### Ingress Configuration

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `create_ingress` | Create Ingress resource | `bool` | `false` |
| `ingress_class` | Ingress class (nginx, traefik) | `string` | `"nginx"` |
| `ingress_annotations` | Additional Ingress annotations | `map(string)` | `{}` |
| `ingress_tls_enabled` | Enable TLS | `bool` | `false` |
| `ingress_tls_secret` | TLS secret name | `string` | `"frontends-tls"` |
| `ingress_hosts` | List of hostnames for TLS | `list(string)` | `[]` |

## Outputs

### Service Endpoints

| Name | Description |
|------|-------------|
| `admin_app_endpoint` | Admin app internal endpoint |
| `customer_portal_endpoint` | Customer portal internal endpoint |
| `cns_dashboard_endpoint` | CNS dashboard internal endpoint |
| `backstage_portal_endpoint` | Backstage portal internal endpoint |
| `dashboard_endpoint` | Dashboard internal endpoint |

### External URLs (if Ingress enabled)

| Name | Description |
|------|-------------|
| `admin_app_url` | Admin app external URL |
| `customer_portal_url` | Customer portal external URL |
| `cns_dashboard_url` | CNS dashboard external URL |
| `backstage_portal_url` | Backstage portal external URL |
| `dashboard_url` | Dashboard external URL |

### Summary Outputs

| Name | Description |
|------|-------------|
| `deployed_applications` | List of deployed frontend names |
| `total_replicas` | Total number of replicas |
| `service_endpoints` | Map of all service endpoints |
| `external_urls` | Map of all external URLs (if ingress enabled) |
| `config_map_name` | Shared ConfigMap name |

## Architecture

### Container Ports

Each frontend exposes a different internal container port:

| Frontend | Container Port | Service Port | Notes |
|----------|---------------|--------------|-------|
| admin-app | 80 | 27555 | Nginx serving React build |
| customer-portal | 80 | 27100 | Nginx serving React build |
| cns-dashboard | 80 | 27250 | Nginx serving React build |
| backstage-portal | 7007 | 27150 | Backstage native port |
| dashboard | 3000 | 27400 | Next.js native port |

### Health Probes

All frontends include:
- **Liveness Probe**: HTTP GET to root path (except Backstage uses `/healthcheck`)
- **Readiness Probe**: HTTP GET to root path
- Configurable initial delays, timeouts, and thresholds

### Environment Variables

Each frontend receives environment variables via:
1. **ConfigMap** (shared): API URLs, Keycloak, feature flags
2. **Deployment** (per-app): App-specific overrides

Example for admin-app:
```yaml
env:
  - name: VITE_API_URL
    value: "http://tenant-mgmt.control-plane.svc.cluster.local:14000"
  - name: VITE_KEYCLOAK_URL
    value: "http://keycloak.auth.svc.cluster.local:8080"
```

### Labels

All resources follow Kubernetes recommended labels:
- `app.kubernetes.io/name`: Application name (e.g., "admin-app")
- `app.kubernetes.io/instance`: Unique instance name
- `app.kubernetes.io/component`: Component type (e.g., "control-plane-ui")
- `app.kubernetes.io/managed-by`: "terraform"
- `app.kubernetes.io/part-of`: "ananta-platform"
- `environment`: Environment name

## Resource Requirements

### Default Resource Limits

| Frontend | CPU Request | CPU Limit | Memory Request | Memory Limit |
|----------|-------------|-----------|----------------|--------------|
| admin-app | 100m | 500m | 128Mi | 512Mi |
| customer-portal | 100m | 500m | 128Mi | 512Mi |
| cns-dashboard | 100m | 500m | 128Mi | 512Mi |
| backstage-portal | 250m | 1000m | 512Mi | 2Gi |
| dashboard | 100m | 500m | 256Mi | 1Gi |

### Recommended Production Settings

For production workloads with 2-3 replicas:
- **CPU Limit**: 1000m (1 core)
- **Memory Limit**: 1Gi
- **Replicas**: 3 (for HA across availability zones)

## Integration with Other Modules

### With Database Module

```hcl
module "database" {
  source = "../../modules/database/kubernetes"
  # ... database configuration ...
}

module "frontends" {
  source = "../../modules/frontends/kubernetes"

  control_plane_api_url = "http://tenant-mgmt.${module.database.namespace}.svc.cluster.local:14000"
  # ... other configuration ...
}
```

### With Ingress Controller

Requires an Ingress controller (nginx, traefik) to be installed:

```bash
# Install nginx-ingress
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

Then enable ingress in the module:

```hcl
module "frontends" {
  source = "../../modules/frontends/kubernetes"

  create_ingress = true
  ingress_class  = "nginx"
  # ... other configuration ...
}
```

## Troubleshooting

### Pods Not Starting

1. Check pod status:
   ```bash
   kubectl get pods -n frontends
   kubectl describe pod <pod-name> -n frontends
   ```

2. Check logs:
   ```bash
   kubectl logs <pod-name> -n frontends
   ```

3. Common issues:
   - Image pull errors: Verify image names and registry access
   - ConfigMap missing: Ensure module created ConfigMap successfully
   - Resource limits: Increase CPU/memory if pods are OOMKilled

### Service Not Accessible

1. Check service endpoints:
   ```bash
   kubectl get svc -n frontends
   kubectl get endpoints -n frontends
   ```

2. Test internal connectivity:
   ```bash
   kubectl run test -it --rm --image=busybox -- wget -O- http://ananta-admin-app.frontends.svc.cluster.local:27555
   ```

### Ingress Not Working

1. Check Ingress resource:
   ```bash
   kubectl get ingress -n frontends
   kubectl describe ingress ananta-frontends -n frontends
   ```

2. Verify Ingress controller is installed:
   ```bash
   kubectl get pods -n ingress-nginx
   ```

3. Check DNS resolution for hostnames

## Security Considerations

- **Secrets**: Use Kubernetes Secrets for sensitive data (Supabase keys, API tokens)
- **RBAC**: Apply appropriate ServiceAccounts and RBAC policies
- **Network Policies**: Restrict pod-to-pod communication
- **TLS**: Always enable TLS in production (set `ingress_tls_enabled = true`)
- **Image Security**: Use specific image tags, not `latest`

## Examples

See `examples/` directory for complete examples:
- Local development setup
- Production HA deployment
- Multi-environment configuration

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| kubernetes | >= 2.20 |

## License

Proprietary - Ananta Platform
