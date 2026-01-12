# Helm Conversion Plan for Ananta Platform

## Overview

This document outlines the plan to convert Terraform deployments from native Kubernetes resources to Helm charts where appropriate.

## Current State Analysis

### Modules Using Native Kubernetes Resources (Need Helm Conversion)

| Module | Current Approach | Recommended Helm Chart | Priority |
|--------|-----------------|----------------------|----------|
| `database/kubernetes` | Native K8s | `cloudnative-pg/cloudnative-pg` or `bitnami/postgresql` | HIGH |
| `cache/kubernetes` | Native K8s | `bitnami/redis` | HIGH |
| `keycloak/kubernetes` | Native K8s | `bitnami/keycloak` | HIGH |
| `temporal/kubernetes` | Native K8s | `temporalio/temporal` | HIGH |
| `vault/kubernetes` | Native K8s | `hashicorp/vault` | MEDIUM |
| `app-plane/kubernetes` (RabbitMQ) | Native K8s | `bitnami/rabbitmq` | HIGH |
| `app-plane/kubernetes` (MinIO) | Native K8s | `minio/minio` | MEDIUM |
| `app-plane/kubernetes` (Novu) | Native K8s | Custom (no official chart) | LOW |
| `app-plane/kubernetes` (Observability) | Native K8s | `kube-prometheus-stack` + `jaeger` | HIGH |

### Modules That Should Stay Native Kubernetes

| Module | Reason |
|--------|--------|
| `app-plane/kubernetes` (CNS Service) | Custom application - no Helm chart |
| `app-plane/kubernetes` (Customer Portal) | Custom application - no Helm chart |
| `control-plane/kubernetes` | Custom application services |
| AWS modules (ecr, ecs, etc.) | Not K8s - use Terraform AWS provider |

## When to Use Helm vs Native Kubernetes

### Use Helm For:
- **Third-party infrastructure** (databases, caches, message brokers)
- **Complex stateful applications** (Temporal, Keycloak, Vault)
- **Observability stack** (Prometheus, Grafana, Jaeger)
- **Services with official Helm charts** from vendors
- **Applications requiring RBAC, ServiceAccounts, CRDs**

### Use Native Kubernetes For:
- **Custom applications** (your own services like CNS, Customer Portal)
- **Simple deployments** without complex configuration
- **When you need fine-grained control** over every resource
- **When no quality Helm chart exists**

## Benefits of Helm

1. **Production-tested configurations** - Charts are battle-tested
2. **Proper security defaults** - RBAC, ServiceAccounts, NetworkPolicies
3. **Easy upgrades** - `helm upgrade` handles complex updates
4. **Consistent configuration** - Values files are declarative
5. **Community maintenance** - Security patches, bug fixes
6. **Pre-built dashboards** - Grafana dashboards, alerting rules

## Conversion Priority

### Phase 1 (High Priority) - Infrastructure Services

```hcl
# 1. PostgreSQL - Use CloudNative-PG operator or Bitnami chart
module "database" {
  source = "../../modules/database/kubernetes-helm"
  # Uses: cloudnative-pg/cloudnative-pg
}

# 2. Redis - Use Bitnami chart
module "cache" {
  source = "../../modules/cache/kubernetes-helm"
  # Uses: bitnami/redis
}

# 3. RabbitMQ - Use Bitnami chart
# In app-plane module, use helm_release for RabbitMQ
resource "helm_release" "rabbitmq" {
  chart      = "rabbitmq"
  repository = "https://charts.bitnami.com/bitnami"
  version    = "12.5.0"
}
```

### Phase 2 (High Priority) - Platform Services

```hcl
# 4. Keycloak - Use Bitnami chart
module "keycloak" {
  source = "../../modules/keycloak/kubernetes-helm"
  # Uses: bitnami/keycloak
}

# 5. Temporal - Use official Temporal chart
module "temporal" {
  source = "../../modules/temporal/kubernetes-helm"
  # Uses: temporalio/temporal
}

# 6. Observability - Use kube-prometheus-stack
module "observability" {
  source = "../../modules/observability/kubernetes"
  # Uses: prometheus-community/kube-prometheus-stack
  # Uses: jaegertracing/jaeger
}
```

### Phase 3 (Medium Priority) - Storage & Secrets

```hcl
# 7. Vault - Use HashiCorp chart
module "vault" {
  source = "../../modules/vault/kubernetes-helm"
  # Uses: hashicorp/vault
}

# 8. MinIO - Use official MinIO chart
# In app-plane module
resource "helm_release" "minio" {
  chart      = "minio"
  repository = "https://charts.min.io/"
  version    = "5.0.15"
}
```

## Recommended Helm Chart Versions

| Service | Helm Chart | Repository | Version |
|---------|------------|------------|---------|
| PostgreSQL | `bitnami/postgresql` | https://charts.bitnami.com/bitnami | 14.0.0 |
| PostgreSQL (HA) | `cloudnative-pg/cloudnative-pg` | https://cloudnative-pg.github.io/charts | 0.20.0 |
| Redis | `bitnami/redis` | https://charts.bitnami.com/bitnami | 18.6.0 |
| RabbitMQ | `bitnami/rabbitmq` | https://charts.bitnami.com/bitnami | 12.5.0 |
| Keycloak | `bitnami/keycloak` | https://charts.bitnami.com/bitnami | 18.4.0 |
| Temporal | `temporalio/temporal` | https://go.temporal.io/helm-charts | 0.31.0 |
| Vault | `hashicorp/vault` | https://helm.releases.hashicorp.com | 0.27.0 |
| MinIO | `minio/minio` | https://charts.min.io/ | 5.0.15 |
| Prometheus Stack | `kube-prometheus-stack` | https://prometheus-community.github.io/helm-charts | 55.5.0 |
| Jaeger | `jaeger` | https://jaegertracing.github.io/helm-charts | 0.71.11 |
| Loki | `loki-stack` | https://grafana.github.io/helm-charts | 2.9.11 |

## Implementation Steps

### Step 1: Add Helm Provider to Modules

```hcl
terraform {
  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.12"
    }
  }
}
```

### Step 2: Create Helm-Based Module

Example for PostgreSQL:

```hcl
resource "helm_release" "postgresql" {
  name             = var.name_prefix
  namespace        = var.namespace
  create_namespace = var.create_namespace
  repository       = "https://charts.bitnami.com/bitnami"
  chart            = "postgresql"
  version          = var.chart_version

  values = [yamlencode({
    auth = {
      postgresPassword = var.postgres_password
      database         = var.database_name
    }
    primary = {
      persistence = {
        enabled          = true
        storageClass     = var.storage_class
        size             = var.storage_size
      }
      resources = var.resources
    }
    metrics = {
      enabled = var.enable_metrics
    }
  })]
}
```

### Step 3: Update Environment Configuration

```hcl
# environments/local/main.tf
module "database" {
  source = "../../modules/database/kubernetes-helm"  # Changed from kubernetes

  namespace      = kubernetes_namespace.namespaces["database"].metadata[0].name
  name_prefix    = local.name_prefix
  chart_version  = "14.0.0"
  # ... rest of config
}
```

## Migration Notes

### Database Migration Considerations
- Export data before switching
- Use same PostgreSQL major version
- Test connection strings after migration
- Helm charts may use different service names

### Downtime Expectations
- **PostgreSQL**: Brief downtime during switchover
- **Redis**: Minimal if using persistent storage
- **RabbitMQ**: Messages may be lost if not persistent
- **Keycloak**: Brief downtime, sessions will be lost

### Rollback Plan
- Keep native K8s module available
- Use feature flag to switch between approaches
- Document exact rollback steps

## Files to Create/Modify

### New Files (Helm-based modules)

```
infrastructure/terraform/modules/
├── database/kubernetes-helm/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── cache/kubernetes-helm/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── keycloak/kubernetes-helm/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── temporal/kubernetes-helm/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
└── observability/kubernetes/  # Already created
    ├── main.tf
    ├── variables.tf
    └── outputs.tf
```

### Modified Files

- `environments/local/main.tf` - Update module sources
- `environments/local/variables.tf` - Add chart version variables
- `app-plane/kubernetes/main.tf` - Convert RabbitMQ, MinIO to Helm

## Next Steps

1. ✅ **Observability module** - Already converted to Helm (this PR)
2. 🔲 **Database module** - High priority, affects all services
3. 🔲 **Cache module** - High priority, simple conversion
4. 🔲 **RabbitMQ in app-plane** - Replace native with Helm
5. 🔲 **Keycloak module** - Complex, needs realm import handling
6. 🔲 **Temporal module** - Complex, needs namespace creation
7. 🔲 **Vault module** - Medium priority
8. 🔲 **MinIO in app-plane** - Lower priority

## Testing Checklist

- [ ] All pods reach Running state
- [ ] Service endpoints are accessible
- [ ] Persistent storage works correctly
- [ ] Migrations run successfully
- [ ] Health checks pass
- [ ] Connections between services work
- [ ] Metrics are exposed (if enabled)
- [ ] Logs are accessible
