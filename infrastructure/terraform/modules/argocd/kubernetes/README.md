# ArgoCD Kubernetes Terraform Module

Terraform module for deploying ArgoCD with GitOps configuration, including Projects and ApplicationSets for multi-environment deployments.

## Features

- Helm-based ArgoCD installation with configurable version
- High availability (HA) mode with multiple replicas and Redis HA
- ArgoCD Project creation with RBAC and resource policies
- ApplicationSet for multi-environment deployments (dev, staging, prod)
- Git repository credentials management (HTTPS and SSH)
- Ingress configuration with optional TLS
- Prometheus metrics and ServiceMonitor support
- Automated sync with prune and self-heal policies
- Additional application definitions support
- Comprehensive outputs for integration

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| helm | ~> 2.12 |
| kubernetes | ~> 2.25 |
| random | ~> 3.6 |
| time | ~> 0.10 |

## Providers

- **helm** - For installing ArgoCD Helm chart
- **kubernetes** - For creating ArgoCD Projects, ApplicationSets, and secrets
- **random** - For generating admin password if not provided
- **time** - For waiting on CRD readiness

## Usage

### Basic Deployment (ClusterIP)

```hcl
module "argocd" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  argocd_version = "5.51.6"

  # Git repository configuration
  git_repo_url = "https://github.com/your-org/infrastructure"
  git_username = var.git_username
  git_password = var.git_password

  # Basic configuration
  service_type = "ClusterIP"
}
```

### Production Deployment with HA and Ingress

```hcl
module "argocd" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  argocd_version = "5.51.6"

  # High availability
  ha_enabled = true

  # Git repository configuration
  git_repo_url = "https://github.com/your-org/infrastructure"
  git_username = var.git_username
  git_password = var.git_password

  # Ingress configuration
  create_ingress      = true
  ingress_host        = "argocd.example.com"
  ingress_tls_enabled = true
  ingress_annotations = {
    "kubernetes.io/ingress.class"                = "nginx"
    "cert-manager.io/cluster-issuer"             = "letsencrypt-prod"
    "nginx.ingress.kubernetes.io/ssl-passthrough" = "true"
    "nginx.ingress.kubernetes.io/backend-protocol" = "HTTPS"
  }

  # Custom admin password
  admin_password = var.argocd_admin_password

  # Enable all components
  enable_metrics        = true
  enable_applicationset = true
  enable_notifications  = true
}
```

### Multi-Environment ApplicationSet

```hcl
module "argocd" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  git_repo_url   = "https://github.com/your-org/infrastructure"
  git_username   = var.git_username
  git_password   = var.git_password

  # Project configuration
  create_project       = true
  project_name         = "ananta-platform"
  project_description  = "Ananta Platform multi-tenant SaaS"

  # ApplicationSet configuration
  create_applicationset = true
  applicationset_name   = "ananta-platform"

  environments = [
    {
      name       = "dev"
      namespace  = "ananta-dev"
      git_branch = "develop"
      repo_path  = "infrastructure/kubernetes/dev"
    },
    {
      name       = "staging"
      namespace  = "ananta-staging"
      git_branch = "main"
      repo_path  = "infrastructure/kubernetes/staging"
    },
    {
      name       = "prod"
      namespace  = "ananta-prod"
      git_branch = "main"
      repo_path  = "infrastructure/kubernetes/prod"
    }
  ]

  # Sync policy
  sync_policy_automated = true
  sync_policy_prune     = true
  sync_policy_self_heal = true

  sync_options = [
    "CreateNamespace=true",
    "PruneLast=true",
    "PruneWhenPropagationStatusIsUnknown=true"
  ]
}
```

### SSH Authentication

```hcl
module "argocd" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  git_repo_url   = "git@github.com:your-org/infrastructure.git"

  # SSH authentication
  git_ssh_private_key = file("~/.ssh/argocd_deploy_key")
}
```

### Additional Applications

```hcl
module "argocd" {
  source = "./modules/argocd/kubernetes"

  namespace      = "argocd"
  git_repo_url   = "https://github.com/your-org/infrastructure"
  git_username   = var.git_username
  git_password   = var.git_password

  additional_applications = {
    "monitoring-stack" = {
      source = {
        path = "infrastructure/monitoring"
      }
      destination = {
        namespace = "monitoring"
      }
    }
    "ingress-nginx" = {
      source = {
        path = "infrastructure/ingress-nginx"
      }
      destination = {
        namespace = "ingress-nginx"
      }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| namespace | Kubernetes namespace for ArgoCD | string | `"argocd"` | no |
| create_namespace | Create namespace if it doesn't exist | bool | `true` | no |
| argocd_version | ArgoCD Helm chart version | string | `"5.51.6"` | no |
| service_type | Service type (LoadBalancer/NodePort/ClusterIP) | string | `"ClusterIP"` | no |
| admin_password | Admin password (leave empty to auto-generate) | string | `""` | no |
| ha_enabled | Enable high availability mode | bool | `false` | no |
| create_ingress | Create Ingress resource | bool | `false` | no |
| ingress_host | Hostname for Ingress | string | `"argocd.local"` | no |
| ingress_tls_enabled | Enable TLS for Ingress | bool | `false` | no |
| git_repo_url | Git repository URL | string | - | **yes** |
| git_branch | Default Git branch | string | `"main"` | no |
| git_username | Git username for HTTPS auth | string | `""` | no |
| git_password | Git password/token for HTTPS auth | string | `""` | no |
| git_ssh_private_key | SSH private key for SSH auth | string | `""` | no |
| create_project | Create ArgoCD project | bool | `true` | no |
| project_name | Project name | string | `"ananta-platform"` | no |
| create_applicationset | Create ApplicationSet | bool | `true` | no |
| environments | List of environments for ApplicationSet | list(object) | See variables.tf | no |
| sync_policy_automated | Enable automated sync | bool | `true` | no |
| sync_policy_prune | Enable pruning during sync | bool | `true` | no |
| sync_policy_self_heal | Enable self-healing | bool | `true` | no |
| enable_metrics | Enable Prometheus metrics | bool | `true` | no |
| additional_applications | Additional applications to create | map(object) | `{}` | no |

See [variables.tf](./variables.tf) for complete list of inputs.

## Outputs

| Name | Description |
|------|-------------|
| argocd_server_url | ArgoCD server URL |
| argocd_initial_admin_password | Initial admin password (sensitive) |
| argocd_project_name | ArgoCD project name |
| applicationset_name | ApplicationSet name |
| applicationset_environments | Configured environments |
| quick_start_commands | Quick start commands for accessing ArgoCD |

See [outputs.tf](./outputs.tf) for complete list of outputs.

## Post-Deployment

### Access ArgoCD UI

**Port-forward (ClusterIP/NodePort):**
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

**Get admin password:**
```bash
terraform output -raw argocd_initial_admin_password
# or from Kubernetes secret:
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d
```

**Login via CLI:**
```bash
argocd login localhost:8080 --username admin --password <password> --insecure
```

**Access UI:**
- Port-forward: https://localhost:8080
- Ingress: https://argocd.example.com

### Verify ArgoCD Project

```bash
kubectl get appproject -n argocd
kubectl describe appproject ananta-platform -n argocd
```

### Verify ApplicationSet

```bash
kubectl get applicationset -n argocd
kubectl get applications -n argocd
```

### Sync Applications

```bash
# Via CLI
argocd app sync ananta-platform-dev
argocd app sync ananta-platform-staging
argocd app sync ananta-platform-prod

# Via UI
# Navigate to Applications and click "Sync"
```

## Architecture

### Components

1. **ArgoCD Server** - Web UI and API server
2. **Application Controller** - Monitors applications and reconciles state
3. **Repository Server** - Clones Git repositories and generates manifests
4. **Redis** - Caching and session storage (HA mode uses Redis Sentinel)
5. **Dex** (optional) - SSO integration
6. **ApplicationSet Controller** - Generates applications from templates
7. **Notifications Controller** (optional) - Sends notifications

### High Availability

When `ha_enabled = true`:
- Controller: 3 replicas
- Server: 3 replicas
- Repository Server: 3 replicas
- ApplicationSet Controller: 2 replicas
- Redis HA with Sentinel (3 nodes)

### ArgoCD Project

Defines:
- Source repositories allowed
- Destination clusters and namespaces
- Resource whitelists (cluster-scoped and namespace-scoped)
- RBAC roles and policies
- Sync windows (maintenance windows)

### ApplicationSet

Uses **List Generator** to create applications for multiple environments:
- Reads environment list from `environments` variable
- Generates Application CR for each environment
- Applies templated values (environment, namespace, branch, path)
- Configures automated sync with prune and self-heal

## Security Considerations

1. **Admin Password**: Always set a strong admin password or use auto-generated one
2. **Git Credentials**: Store in secure secret management (Vault, AWS Secrets Manager)
3. **TLS**: Enable Ingress TLS for production deployments
4. **RBAC**: Configure project roles and policies for least privilege
5. **Network Policies**: Restrict network access to ArgoCD components
6. **SSO**: Enable Dex for centralized authentication

## Troubleshooting

### ArgoCD pods not starting

```bash
kubectl get pods -n argocd
kubectl logs <pod-name> -n argocd
kubectl describe pod <pod-name> -n argocd
```

### Applications not syncing

```bash
kubectl get applications -n argocd
argocd app get ananta-platform-dev
argocd app logs ananta-platform-dev
```

### Git repository credentials issues

```bash
kubectl get secrets -n argocd | grep repo-creds
kubectl describe secret <secret-name> -n argocd
```

### CRDs not ready

Wait 30 seconds after Helm installation for CRDs to be ready, or manually check:
```bash
kubectl get crd | grep argoproj.io
```

## Examples

See [examples/](./examples/) directory for:
- `basic/` - Basic ArgoCD deployment
- `ha-production/` - Production HA deployment
- `multi-cluster/` - Multi-cluster deployment
- `helm-apps/` - Using Helm as source type

## References

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [ArgoCD Helm Chart](https://github.com/argoproj/argo-helm/tree/main/charts/argo-cd)
- [ApplicationSet Documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/application-set/)
- [ArgoCD Best Practices](https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/)

## License

MIT

## Authors

Ananta Platform Team
