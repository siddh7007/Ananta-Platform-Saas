# ArgoCD GitOps Configuration - Fixed

This directory contains the corrected ArgoCD GitOps configuration for the Ananta Platform SaaS.

## Critical Fixes Applied

### 1. Fixed Invalid Helm Template Syntax in ApplicationSets

**Issue**: ApplicationSets used Handlebars syntax `{{#eq}}` instead of Go templates.

**Fixed**:
```yaml
# BEFORE (WRONG - Handlebars):
targetRevision: '{{#eq environment "prod"}}main{{/eq}}{{#eq environment "staging"}}staging{{/eq}}'

# AFTER (CORRECT - Go templates):
targetRevision: '{{targetRevision}}'
# With targetRevision defined in the generator elements
```

### 2. Fixed Boolean String Issue in autoSync

**Issue**: Boolean values were quoted as strings, causing ArgoCD to fail parsing.

**Fixed**:
```yaml
# BEFORE (WRONG):
prune: '{{autoSync}}'
selfHeal: '{{autoSync}}'

# AFTER (CORRECT):
prune: {{autoSync}}
selfHeal: {{autoSync}}
```

### 3. Fixed Invalid YAML Conditional in infrastructure-apps.yaml

**Issue**: Lines 106-110 had Handlebars-style conditionals that are not valid in ArgoCD ApplicationSet templates.

**Fixed**:
```yaml
# BEFORE (WRONG):
{{#if chartName}}
chart: '{{chartName}}'
{{else}}
path: '{{chartPath}}'
{{/if}}

# AFTER (CORRECT - using Go template conditionals):
{{- if eq .sourceType "helm"}}
chart: '{{chartName}}'
targetRevision: '{{chartVersion}}'
{{- else}}
path: '{{chartPath}}'
targetRevision: '{{targetRevision}}'
{{- end}}
```

### 4. Fixed Placeholder repoURL

**Issue**: All files had `your-org` placeholder instead of actual organization name.

**Fixed**: Replaced `https://github.com/your-org/ananta-platform-saas.git` with `https://github.com/ananta-platform/ananta-platform-saas.git`

### 5. Removed ResourceQuota/LimitRange Blacklist

**Issue**: Project had ResourceQuota and LimitRange in `namespaceResourceBlacklist`, preventing their creation.

**Fixed**: Removed lines 82-86 from `projects/ananta-platform.yaml`. These resources are now allowed.

### 6. Added Missing Infrastructure Applications

**Created**:
- `applications/infrastructure/postgresql.yaml` - PostgreSQL database
- `applications/infrastructure/ingress-nginx.yaml` - NGINX ingress controller
- `applications/infrastructure/cert-manager.yaml` - Certificate management
- `applications/infrastructure/novu.yaml` - Notification service
- `applications/infrastructure/supabase.yaml` - Backend-as-a-Service platform

### 7. Added Missing Namespace Destinations

**Added to project** (`projects/ananta-platform.yaml`):
```yaml
# Infrastructure services
- namespace: keycloak-system
- namespace: temporal-system
- namespace: rabbitmq-system
- namespace: cache-system
- namespace: novu-system
- namespace: database-system
```

## Directory Structure

```
argocd/
├── README.md                           # This file
├── projects/
│   └── ananta-platform.yaml            # AppProject definition (FIXED)
├── applicationsets/
│   ├── control-plane-apps.yaml         # Control plane services (FIXED)
│   ├── app-plane-apps.yaml             # App plane services (FIXED)
│   └── infrastructure-apps.yaml        # Infrastructure services (FIXED)
└── applications/
    ├── infrastructure/                 # Individual infrastructure apps
    │   ├── keycloak.yaml               # (Deprecated - use ApplicationSet)
    │   ├── temporal.yaml               # (Deprecated - use ApplicationSet)
    │   ├── rabbitmq.yaml               # (Deprecated - use ApplicationSet)
    │   ├── redis.yaml                  # (Deprecated - use ApplicationSet)
    │   ├── postgresql.yaml             # NEW - Standalone PostgreSQL
    │   ├── ingress-nginx.yaml          # NEW - Standalone NGINX ingress
    │   ├── cert-manager.yaml           # NEW - Standalone cert-manager
    │   ├── novu.yaml                   # NEW - Standalone Novu
    │   └── supabase.yaml               # NEW - Standalone Supabase
    ├── control-plane/                  # Control plane individual apps
    │   ├── tenant-management-service.yaml  # (Deprecated - use ApplicationSet)
    │   ├── temporal-worker-service.yaml    # (Deprecated - use ApplicationSet)
    │   ├── subscription-service.yaml       # (Deprecated - use ApplicationSet)
    │   ├── orchestrator-service.yaml       # (Deprecated - use ApplicationSet)
    │   └── admin-app.yaml                  # (Deprecated - use ApplicationSet)
    └── app-plane/                      # App plane individual apps
        ├── cns-service.yaml            # (Deprecated - use ApplicationSet)
        ├── cns-dashboard.yaml          # (Deprecated - use ApplicationSet)
        ├── customer-portal.yaml        # (Deprecated - use ApplicationSet)
        ├── backstage-portal.yaml       # (Deprecated - use ApplicationSet)
        ├── audit-logger.yaml           # (Deprecated - use ApplicationSet)
        ├── middleware-api.yaml         # (Deprecated - use ApplicationSet)
        └── novu-consumer.yaml          # (Deprecated - use ApplicationSet)
```

## Recommended Usage

### ApplicationSets (Recommended)

ApplicationSets automatically generate Application resources for each environment. This is the recommended approach for consistency.

**Deploy all control plane services**:
```bash
kubectl apply -f applicationsets/control-plane-apps.yaml
```

**Deploy all app plane services**:
```bash
kubectl apply -f applicationsets/app-plane-apps.yaml
```

**Deploy all infrastructure services**:
```bash
kubectl apply -f applicationsets/infrastructure-apps.yaml
```

### Individual Applications (For specific use cases)

Use individual application manifests when you need:
- Environment-specific configuration that differs significantly
- Manual control over specific services
- Testing or development scenarios

**Deploy a single infrastructure service**:
```bash
kubectl apply -f applications/infrastructure/postgresql.yaml
```

## Individual Application Files Note

The existing individual application files in `applications/control-plane/`, `applications/app-plane/`, and some in `applications/infrastructure/` contain invalid Helm template syntax:

```yaml
# INVALID - These are Kubernetes CRDs, NOT Helm charts
environment: '{{.Values.environment}}'
values-{{.Values.environment}}.yaml
```

**Options**:

1. **Delete them** - ApplicationSets will generate applications automatically
2. **Create environment-specific versions**:
   - `tenant-management-service-dev.yaml`
   - `tenant-management-service-staging.yaml`
   - `tenant-management-service-prod.yaml`
3. **Convert to static manifests** - Remove all `{{.Values.*}}` syntax

## Deployment Strategy

### Development Environment

```bash
# 1. Deploy infrastructure first
kubectl apply -f applications/infrastructure/postgresql.yaml
kubectl apply -f applications/infrastructure/cert-manager.yaml
kubectl apply -f applications/infrastructure/ingress-nginx.yaml

# Wait for infrastructure to be healthy
kubectl wait --for=condition=available --timeout=600s deployment -n database-system postgresql
kubectl wait --for=condition=available --timeout=600s deployment -n cert-manager cert-manager

# 2. Deploy control plane services
kubectl apply -f applicationsets/control-plane-apps.yaml

# 3. Deploy app plane services
kubectl apply -f applicationsets/app-plane-apps.yaml
```

### Staging/Production Environments

For staging and production, use ApplicationSets exclusively to ensure consistency:

```bash
# Deploy all ApplicationSets
kubectl apply -f projects/ananta-platform.yaml
kubectl apply -f applicationsets/infrastructure-apps.yaml
kubectl apply -f applicationsets/control-plane-apps.yaml
kubectl apply -f applicationsets/app-plane-apps.yaml
```

## ApplicationSet Behavior

Each ApplicationSet generates applications for ALL environments defined in the generator:

```yaml
# From control-plane-apps.yaml
- environment: dev
  autoSync: true
  targetRevision: develop

- environment: staging
  autoSync: true
  targetRevision: staging

- environment: prod
  autoSync: false
  targetRevision: main
```

This creates:
- `tenant-management-service-dev`
- `tenant-management-service-staging`
- `tenant-management-service-prod`

## Sync Policies

### Development
- **Auto-sync**: Enabled
- **Auto-prune**: Enabled
- **Auto-heal**: Enabled
- **Branch**: `develop`

### Staging
- **Auto-sync**: Enabled
- **Auto-prune**: Enabled
- **Auto-heal**: Enabled
- **Branch**: `staging`

### Production
- **Auto-sync**: Disabled (manual sync required)
- **Auto-prune**: Disabled
- **Auto-heal**: Disabled
- **Branch**: `main`

## Sync Windows

Production has restricted sync windows (defined in `projects/ananta-platform.yaml`):

- **Allowed**: Saturdays 2 AM - 6 AM (maintenance window)
- **Denied**: Weekdays 9 AM - 5 PM (peak hours)

## Verification

After applying, verify ApplicationSets are working:

```bash
# Check ApplicationSets
kubectl get applicationsets -n argocd

# Check generated Applications
kubectl get applications -n argocd

# Check sync status
kubectl get applications -n argocd -o wide
```

## Troubleshooting

### Application won't sync

**Check sync policy**:
```bash
kubectl get application <app-name> -n argocd -o yaml | grep -A 5 syncPolicy
```

**Manual sync**:
```bash
argocd app sync <app-name>
```

### ApplicationSet not generating applications

**Check generators**:
```bash
kubectl get applicationset <name> -n argocd -o yaml | grep -A 20 generators
```

**Check ArgoCD logs**:
```bash
kubectl logs -n argocd deployment/argocd-applicationset-controller
```

### Template syntax errors

**Validate YAML**:
```bash
kubectl apply --dry-run=client -f applicationsets/control-plane-apps.yaml
```

**Check for Handlebars syntax** (should be zero results):
```bash
grep -r "{{#" applicationsets/
grep -r "{{/" applicationsets/
```

## Best Practices

1. **Use ApplicationSets for consistency** across environments
2. **Pin versions** in production (use specific chart versions, not `latest`)
3. **Test in dev first**, promote to staging, then production
4. **Use sync waves** to control deployment order (0 → 5 → 10 → 15 → 20)
5. **Enable metrics** (ServiceMonitor) for all services
6. **Set resource limits** to prevent resource exhaustion
7. **Use secrets management** (ExternalSecrets, SealedSecrets, or Vault)

## Next Steps

1. Review and validate all Helm charts in `infrastructure/kubernetes/helm/`
2. Create Sealed Secrets or External Secrets for sensitive data
3. Set up monitoring dashboards (Grafana) for ArgoCD applications
4. Configure notifications (Slack, email) for sync failures
5. Document environment-specific configurations in each service's Helm values

## References

- [ArgoCD ApplicationSets](https://argo-cd.readthedocs.io/en/stable/user-guide/application-set/)
- [Go Template Syntax](https://pkg.go.dev/text/template)
- [ArgoCD Sync Options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/)
- [Kubernetes Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
