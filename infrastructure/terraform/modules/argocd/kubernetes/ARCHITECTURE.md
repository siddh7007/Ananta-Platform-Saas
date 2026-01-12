# ArgoCD Kubernetes Module - Architecture

## Overview

This Terraform module provides a complete GitOps solution for Kubernetes using ArgoCD. It automates the deployment and configuration of ArgoCD with enterprise-grade features including high availability, multi-environment support, and automated synchronization.

## Module Structure

```
argocd/kubernetes/
├── main.tf              # Core resources (Helm, Projects, ApplicationSets)
├── variables.tf         # Input variables (90+ configurable options)
├── outputs.tf           # Module outputs (deployment info, credentials)
├── versions.tf          # Provider version constraints
├── examples.tf          # Usage examples (7 scenarios)
├── README.md            # User documentation
└── ARCHITECTURE.md      # This file
```

## Resource Hierarchy

```
ArgoCD Module
│
├── Namespace (kubernetes_namespace)
│   └── argocd namespace creation (optional)
│
├── Helm Release (helm_release)
│   └── ArgoCD chart installation
│       ├── Controller (application reconciliation)
│       ├── Server (API + UI)
│       ├── Repo Server (Git operations)
│       ├── Redis (caching/session)
│       ├── ApplicationSet Controller
│       ├── Notifications Controller (optional)
│       └── Dex (SSO, optional)
│
├── Random Password (random_password)
│   └── Admin password generation
│
├── Time Sleep (time_sleep)
│   └── CRD readiness wait
│
├── AppProject (kubernetes_manifest)
│   └── Project definition
│       ├── Source repositories whitelist
│       ├── Destination clusters/namespaces
│       ├── Resource whitelists
│       ├── RBAC roles
│       └── Sync windows
│
├── Repository Secrets (kubernetes_secret)
│   ├── HTTPS credentials
│   └── SSH private key
│
├── ApplicationSet (kubernetes_manifest)
│   └── Multi-environment generator
│       └── Application CRs (per environment)
│
└── Additional Applications (kubernetes_manifest)
    └── Standalone Application CRs
```

## Core Components

### 1. Helm Release - ArgoCD Installation

**Purpose**: Deploys ArgoCD using official Helm chart

**Key Features**:
- Configurable chart version (default: 5.51.6)
- HA mode with replica scaling
- Resource requests/limits per component
- Prometheus metrics integration
- Custom server configuration
- Plugin support

**HA Mode Resources**:
```
Component           | Standalone | HA Mode
--------------------|------------|--------
Controller          | 1 replica  | 3 replicas
Server              | 1 replica  | 3 replicas
Repo Server         | 1 replica  | 3 replicas
ApplicationSet      | 1 replica  | 2 replicas
Redis               | Single     | Redis Sentinel (3 nodes)
```

**Resource Allocations**:
```
Component           | CPU Request | Memory Request | CPU Limit | Memory Limit
--------------------|-------------|----------------|-----------|-------------
Controller          | 250m        | 512Mi          | 1000m     | 2Gi
Server              | 100m        | 256Mi          | 500m      | 1Gi
Repo Server         | 250m        | 512Mi          | 1000m     | 2Gi
```

### 2. AppProject - Multi-Tenant Isolation

**Purpose**: Defines RBAC boundaries and resource policies

**Configuration**:
```hcl
spec:
  sourceRepos:
    - https://github.com/org/repo      # Git repo whitelist
    - https://charts.bitnami.com/bitnami

  destinations:
    - namespace: ananta-*              # Namespace patterns
      server: https://kubernetes.default.svc

  clusterResourceWhitelist:
    - group: "*"                       # All cluster resources
      kind: "*"

  namespaceResourceWhitelist:
    - group: "*"                       # All namespace resources
      kind: "*"

  roles:
    - name: developer
      policies:
        - p, proj:ananta:developer, applications, get, *, allow
```

### 3. ApplicationSet - Multi-Environment Automation

**Purpose**: Generates Application CRs for multiple environments from a single template

**Generator Type**: List Generator

**Workflow**:
```
1. Read environments list from variable
2. For each environment:
   - Generate Application CR with environment-specific values
   - Configure source (repo, branch, path)
   - Configure destination (cluster, namespace)
   - Apply sync policy (automated, prune, self-heal)
3. ArgoCD Controller detects Applications and syncs them
```

**Template Variables**:
- `{{environment}}` - Environment name (dev, staging, prod)
- `{{namespace}}` - Target namespace
- `{{branch}}` - Git branch
- `{{repoPath}}` - Path within Git repo
- `{{values}}` - Helm values (if using Helm source)

### 4. Repository Credentials

**Purpose**: Secure Git authentication

**Supported Methods**:
1. **HTTPS**: Username + Password/Token
   - Stored in Kubernetes secret
   - Label: `argocd.argoproj.io/secret-type: repository`

2. **SSH**: Private key
   - Stored in Kubernetes secret
   - Used for private repositories

**Secret Structure**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: repo-creds-https
  labels:
    argocd.argoproj.io/secret-type: repository
data:
  type: git
  url: <repo-url>
  username: <base64>
  password: <base64>
```

## Deployment Flow

### 1. Initial Deployment

```
Terraform Apply
    ↓
Create Namespace (if enabled)
    ↓
Generate Admin Password (if not provided)
    ↓
Install ArgoCD via Helm
    ↓
Wait 30s for CRDs
    ↓
Create Repository Credentials
    ↓
Create AppProject
    ↓
Create ApplicationSet
    ↓
ApplicationSet generates Applications
    ↓
ArgoCD syncs Applications from Git
```

### 2. Sync Process (per Application)

```
Application CR Created
    ↓
Controller detects Application
    ↓
Repo Server clones Git repo
    ↓
Generate manifests (Kustomize/Helm/plain YAML)
    ↓
Compare desired state vs cluster state
    ↓
If automated sync enabled:
    ↓
Apply changes to cluster
    ↓
Prune removed resources (if enabled)
    ↓
Monitor health status
    ↓
Self-heal on drift (if enabled)
```

## Sync Policies

### Automated Sync

**Enabled by default**: `sync_policy_automated = true`

```hcl
syncPolicy:
  automated:
    prune: true        # Delete resources removed from Git
    selfHeal: true     # Revert manual changes
    allowEmpty: false  # Prevent empty syncs
```

### Sync Options

```hcl
syncOptions:
  - CreateNamespace=true                          # Auto-create namespaces
  - PruneLast=true                                # Delete resources last
  - PruneWhenPropagationStatusIsUnknown=true      # Handle race conditions
  - RespectIgnoreDifferences=true                 # Honor ignore rules
```

### Retry Policy

**Exponential backoff** on sync failures:

```
Attempt 1: Wait 5s
Attempt 2: Wait 10s (5s × 2)
Attempt 3: Wait 20s (10s × 2)
Attempt 4: Wait 40s (20s × 2)
Attempt 5: Wait 60s (max 3m)
```

Configuration:
```hcl
sync_retry_limit                = 5
sync_retry_backoff_duration     = "5s"
sync_retry_backoff_factor       = 2
sync_retry_backoff_max_duration = "3m"
```

## Security Architecture

### Authentication

1. **Admin User**:
   - Username: `admin`
   - Password: Auto-generated (32 chars) or custom
   - Stored in Kubernetes secret

2. **SSO (optional)**:
   - Dex integration
   - OIDC/SAML/LDAP connectors
   - Keycloak integration ready

### Authorization (RBAC)

**Project-level roles**:
```
project_roles = [
  {
    name = "developer"
    policies = [
      "p, proj:ananta:developer, applications, get, *, allow",
      "p, proj:ananta:developer, applications, list, *, allow"
    ]
  },
  {
    name = "deployer"
    policies = [
      "p, proj:ananta:deployer, applications, *, *, allow"
    ]
  }
]
```

**Policy Format**: `p, subject, resource, action, object, effect`

### Secret Management

1. **Git Credentials**: Kubernetes secrets with ArgoCD labels
2. **Admin Password**: bcrypt hashed in Helm values
3. **Sensitive Outputs**: Marked as `sensitive = true`
4. **External Integration**: Vault/AWS Secrets Manager ready

## Network Architecture

### Service Types

1. **ClusterIP** (default, local dev):
   - Internal access only
   - Requires port-forward
   - No external IP

2. **NodePort** (bare-metal):
   - Access via node IP + port
   - Port range: 30000-32767

3. **LoadBalancer** (cloud):
   - Cloud provider allocates external IP
   - Direct internet access (secure with firewall)

### Ingress (recommended for production)

```hcl
create_ingress = true
ingress_host   = "argocd.example.com"
ingress_tls_enabled = true

ingress_annotations = {
  "kubernetes.io/ingress.class"            = "nginx"
  "cert-manager.io/cluster-issuer"         = "letsencrypt-prod"
  "nginx.ingress.kubernetes.io/ssl-passthrough" = "true"
}
```

**Ingress Flow**:
```
User → DNS → Load Balancer → Ingress Controller → ArgoCD Server
```

## Monitoring & Observability

### Prometheus Metrics

**Enabled by default**: `enable_metrics = true`

**Exposed Metrics**:
- `argocd_app_sync_total` - Sync operations
- `argocd_app_reconcile_count` - Reconciliation loops
- `argocd_app_health_status` - Application health
- `argocd_git_request_duration_seconds` - Git operation latency

**ServiceMonitor CRDs** created for Prometheus Operator

### Monitoring Targets

```
Component           | Port | Path
--------------------|------|-------
Controller          | 8082 | /metrics
Server              | 8083 | /metrics
Repo Server         | 8084 | /metrics
ApplicationSet      | 8081 | /metrics
```

## Disaster Recovery

### Backup Strategy

**What to backup**:
1. ArgoCD namespace resources (Projects, Applications)
2. Repository credentials secrets
3. Custom RBAC policies
4. Helm values/configuration

**Backup Tools**:
- Velero (Kubernetes backup)
- `kubectl get -o yaml` for manifests
- Git as source of truth

### Recovery Process

1. **Application Recovery**:
   - ArgoCD automatically re-syncs from Git
   - No manual intervention needed
   - Applications are declarative

2. **ArgoCD Recovery**:
   ```bash
   # Reinstall ArgoCD via Terraform
   terraform apply

   # Applications auto-sync from Git
   # No data loss if Git is source of truth
   ```

## Performance Tuning

### Repository Server Scaling

For large repos:
```hcl
helm_set_values = {
  "repoServer.resources.requests.cpu"    = "500m"
  "repoServer.resources.requests.memory" = "1Gi"
  "repoServer.resources.limits.cpu"      = "2000m"
  "repoServer.resources.limits.memory"   = "4Gi"
}
```

### Reconciliation Timeout

Adjust based on cluster size:
```hcl
reconciliation_timeout = "300s"  # 5 minutes for large clusters
```

### Application Sharding

For 100+ applications, enable controller sharding:
```hcl
helm_set_values = {
  "controller.sharding.enabled"  = "true"
  "controller.sharding.replicas" = "3"
}
```

## Upgrade Strategy

### Module Version Upgrade

```bash
# 1. Check changelog
git log --oneline modules/argocd/kubernetes/

# 2. Update module version in environment
module "argocd" {
  source = "./modules/argocd/kubernetes?ref=v1.2.0"
}

# 3. Plan changes
terraform plan

# 4. Apply during maintenance window
terraform apply
```

### ArgoCD Version Upgrade

```hcl
# Update chart version
argocd_version = "5.52.0"  # New version

# Terraform will upgrade via Helm
terraform apply
```

**Upgrade Process**:
1. Helm downloads new chart
2. Performs rolling update
3. Zero-downtime for applications
4. Controller maintains sync state

## Troubleshooting

### Common Issues

**1. CRDs not found**
```
Error: kubernetes_manifest failed: CRD not found
Solution: Increase wait time or run terraform apply again
```

**2. Sync failures**
```
Check: Application logs in ArgoCD UI
Command: argocd app logs <app-name>
```

**3. Git authentication**
```
Check: Repository credentials secret
Command: kubectl get secret -n argocd | grep repo-creds
```

**4. High memory usage**
```
Solution: Increase repo server resources
```

### Debug Commands

```bash
# Check ArgoCD pods
kubectl get pods -n argocd

# Check Application status
kubectl get applications -n argocd

# Check AppProject
kubectl describe appproject ananta-platform -n argocd

# ArgoCD CLI
argocd app list
argocd app get <app-name>
argocd app sync <app-name>
```

## Best Practices

1. **Use Git as Single Source of Truth**: Store all manifests in Git
2. **Enable Automated Sync**: Let ArgoCD manage deployments
3. **Use Projects**: Isolate teams/applications with RBAC
4. **Monitor Metrics**: Track sync health and performance
5. **Backup Regularly**: Velero or native Kubernetes backups
6. **Use HA in Production**: Enable `ha_enabled = true`
7. **Secure Git Credentials**: Use SSH keys or rotating tokens
8. **Enable TLS**: Always use Ingress with TLS in production
9. **Apply Sync Windows**: Control production deployments
10. **Version Everything**: Pin chart versions, use semantic versioning

## References

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Helm Chart Values](https://github.com/argoproj/argo-helm/tree/main/charts/argo-cd)
- [ApplicationSet Generators](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/)
- [Sync Options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/)
