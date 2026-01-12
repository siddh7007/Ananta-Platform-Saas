# Ananta Platform SaaS - Full Platform Deployment Index

## Quick Navigation

### Getting Started
1. **[QUICKSTART.md](QUICKSTART.md)** - 15-minute deployment guide
2. **[README.md](README.md)** - Complete documentation
3. **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - Architecture overview

### Configuration Files
| File | Purpose | Lines | Size |
|------|---------|-------|------|
| [main.tf](main.tf) | Master orchestration - deploys all 47 services | 982 | 35KB |
| [variables.tf](variables.tf) | All configuration variables | 1389 | 31KB |
| [outputs.tf](outputs.tf) | Service endpoints and credentials | 610 | 23KB |
| [versions.tf](versions.tf) | Provider version constraints | 63 | 1.2KB |
| [terraform.tfvars.example](terraform.tfvars.example) | Example configuration with documentation | - | 15KB |

### Helper Files
| File | Purpose |
|------|---------|
| [Makefile](Makefile) | 30+ convenience commands (`make help` to see all) |
| [.gitignore](.gitignore) | Git ignore rules (prevents committing secrets) |

## File Purposes at a Glance

### main.tf - The Orchestrator
Deploys infrastructure in 6 sequential phases:
1. Phase 1: Infrastructure (PostgreSQL, Redis, RabbitMQ, MinIO, Vault, Keycloak, Temporal)
2. Phase 2: Data Layer (Supabase, Directus, Novu, Observability)
3. Phase 3: Migrations (Database schemas)
4. Phase 4: Services (Control Plane + App Plane microservices)
5. Phase 5: Frontends (5 web applications)
6. Phase 6: GitOps (ArgoCD)

Key features:
- Automatic dependency management via `depends_on`
- 9 namespaces created
- 200+ Kubernetes resources
- ~60-80 pods deployed

### variables.tf - The Configuration
Defines 100+ variables across categories:
- Environment & cluster settings
- Database credentials (7 databases)
- Service images and replicas
- Resource limits (CPU/memory)
- Security settings (passwords, secrets)
- Feature flags
- Scaling parameters

All variables are documented with:
- Description
- Type constraint
- Default value (where applicable)
- Validation rules (for enums)

### outputs.tf - The Results
Provides 10 categories of outputs:
1. Platform status and summary
2. Infrastructure endpoints (PostgreSQL, Redis, etc.)
3. Data layer endpoints (Supabase, Directus, Novu)
4. Control Plane endpoints (APIs + Admin App)
5. App Plane endpoints (Services + Customer Portal)
6. Observability endpoints (Prometheus, Grafana, Loki, Tempo)
7. GitOps endpoints (ArgoCD)
8. Admin credentials (SENSITIVE)
9. Connection strings (SENSITIVE)
10. Quick access URLs

Access via:
```bash
terraform output                   # All outputs
terraform output quick_access_urls # Just the URLs
terraform output -json | jq        # JSON format
```

### terraform.tfvars.example - The Template
Example configuration with:
- All required variables
- Secure password placeholders
- Environment-specific examples (dev/staging/prod)
- Inline documentation
- Security checklist
- Resource scaling guidelines

**IMPORTANT:** Copy to `terraform.tfvars` and change ALL passwords!

```bash
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Change passwords!
```

## Documentation Hierarchy

```
INDEX.md (you are here)
    │
    ├─► QUICKSTART.md (start here!)
    │   └─► 5-step deployment in 15 minutes
    │
    ├─► DEPLOYMENT_SUMMARY.md
    │   └─► Architecture, components, timeline, resources
    │
    └─► README.md (comprehensive reference)
        ├─► Prerequisites
        ├─► Configuration guide
        ├─► Troubleshooting
        ├─► Security best practices
        ├─► Performance tuning
        ├─► Disaster recovery
        └─► Production checklist
```

## Common Workflows

### First-Time Deployment
```bash
# 1. Copy and configure
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Update passwords and settings

# 2. Initialize
make init

# 3. Plan
make plan

# 4. Deploy
make apply

# 5. Verify
make check-health
make quick-access
```

### Daily Operations
```bash
# View service status
make status

# View endpoints
make endpoints

# Check logs
make logs SERVICE=tenant-management NS=control-plane

# Port-forward to service
make port-forward SERVICE=postgresql NS=database-system PORT=5432
```

### Updating Configuration
```bash
# 1. Update terraform.tfvars
nano terraform.tfvars

# 2. Plan changes
make plan

# 3. Review changes carefully
# 4. Apply
make apply
```

### Disaster Recovery
```bash
# Backup state
make backup-state

# Restore from backup
terraform state push backups/terraform.tfstate.backup-20240108-120000
```

## Module Architecture

This configuration orchestrates 15+ modules:

```
full-platform (this directory)
    │
    ├─► modules/network
    ├─► modules/database/kubernetes (PostgreSQL)
    ├─► modules/cache/kubernetes (Redis)
    ├─► modules/rabbitmq/kubernetes
    ├─► modules/minio/kubernetes
    ├─► modules/vault/kubernetes
    ├─► modules/keycloak/kubernetes
    ├─► modules/temporal/kubernetes
    ├─► modules/supabase/kubernetes
    ├─► modules/directus/kubernetes
    ├─► modules/novu/kubernetes
    ├─► modules/observability/kubernetes
    ├─► modules/migrations/kubernetes
    ├─► modules/control-plane/kubernetes
    ├─► modules/app-plane/kubernetes
    ├─► modules/frontends/kubernetes
    └─► modules/argocd/kubernetes
```

Each module is self-contained with:
- `main.tf` - Resources
- `variables.tf` - Inputs
- `outputs.tf` - Outputs
- `versions.tf` - Provider constraints
- `README.md` - Documentation

## Deployment Phases Explained

### Phase 1: Infrastructure (0-6 minutes)
Creates the foundation:
- PostgreSQL cluster (7 databases)
- Redis Sentinel cluster
- RabbitMQ cluster
- MinIO distributed storage
- HashiCorp Vault
- Keycloak SSO
- Temporal workflow engine

All services in this phase are production-ready with HA.

### Phase 2: Data Layer (6-8 minutes)
Adds data services:
- Supabase (PostgREST, GoTrue, Storage, Studio)
- Directus CMS
- Novu notifications
- Observability stack (Prometheus, Grafana, Loki, Tempo)

### Phase 3: Migrations (8-9 minutes)
Runs database migrations:
- Control Plane schema (arc_saas)
- App Plane schema (postgres/Supabase)
- Components V2 schema (components_v2)

Creates ~100+ tables across 3 databases.

### Phase 4: Services (9-10 minutes)
Deploys microservices:
- Control Plane: 4 services (Tenant, Orchestrator, Subscription, Worker)
- App Plane: 4+ services (CNS, Enrichment, BOM, Analytics)

All services connect to databases, cache, and Keycloak.

### Phase 5: Frontends (10-12 minutes)
Deploys web applications:
- Admin App (Tenant management)
- Customer Portal (BOM management)
- Backstage Portal (Developer portal)
- CNS Dashboard (Component admin)
- Unified Dashboard (Analytics)

All frontends use Keycloak for authentication.

### Phase 6: GitOps (12-15 minutes)
Deploys ArgoCD:
- Server, repo-server, application-controller
- Connects to git repository
- Creates applications for continuous delivery

## Resource Sizing

### Development (Local)
```hcl
# Minimal replicas
postgres_replica_count = 1
redis_replica_count = 1
tenant_management_replicas = 1

# Reduced limits
postgres_memory_limit = "2Gi"
redis_memory_limit = "1Gi"
```

**Result:** ~40-50 pods, 8GB RAM usage

### Staging
```hcl
# Some HA
postgres_replica_count = 2
redis_replica_count = 2
tenant_management_replicas = 2

# Moderate limits
postgres_memory_limit = "4Gi"
redis_memory_limit = "2Gi"
```

**Result:** ~60-80 pods, 16GB RAM usage

### Production
```hcl
# Full HA
postgres_replica_count = 3
redis_replica_count = 3
tenant_management_replicas = 3
enrichment_service_replicas = 10

# Production limits
postgres_memory_limit = "8Gi"
redis_memory_limit = "4Gi"
```

**Result:** ~150-200 pods, 64GB+ RAM usage

## Security Checklist

Before production deployment:

**Secrets:**
- [ ] All passwords changed from defaults
- [ ] JWT secrets are 32+ characters
- [ ] API keys are randomly generated
- [ ] Vault root token is secure
- [ ] Keycloak admin password is strong

**State:**
- [ ] Remote backend configured (S3/GCS/Azure)
- [ ] State locking enabled
- [ ] State encryption enabled
- [ ] Backup schedule configured

**Network:**
- [ ] TLS enabled for all services
- [ ] Network policies enabled
- [ ] Ingress rules configured
- [ ] Internal-only services isolated

**Access:**
- [ ] RBAC configured in Kubernetes
- [ ] Keycloak roles configured
- [ ] Admin access restricted
- [ ] Audit logging enabled

Use `make prod-check` for interactive checklist.

## Troubleshooting Quick Reference

### Pods Not Starting
```bash
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

### Database Issues
```bash
make port-forward SERVICE=postgresql NS=database-system PORT=5432
psql -h localhost -U postgres -d arc_saas
```

### Service Not Accessible
```bash
kubectl get svc -n <namespace>
kubectl get ingress -n <namespace>
make port-forward SERVICE=<service> NS=<namespace> PORT=<port>
```

### Out of Resources
```bash
kubectl top nodes
kubectl top pods --all-namespaces
kubectl describe node <node-name>
```

### Terraform Errors
```bash
terraform validate
terraform refresh
terraform state list
make clean && make init
```

## Cost Management

### Estimate Before Deploying
```bash
# Install Infracost (one-time)
curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh

# Estimate costs
make cost

# Compare with current
make plan
make cost-diff
```

### Optimize Costs
1. Right-size resource requests
2. Use spot/preemptible instances
3. Enable autoscaling
4. Use storage lifecycle policies
5. Review replica counts
6. Disable unused features

## Monitoring & Observability

After deployment, access:

**Grafana Dashboards:**
- URL: `terraform output -json observability_endpoints | jq -r '.grafana_url'`
- Login: admin / (see `make credentials`)

**Prometheus Metrics:**
- URL: `terraform output -json observability_endpoints | jq -r '.prometheus_url'`

**Loki Logs:**
- Access via Grafana → Explore → Loki

**Temporal UI:**
- URL: `terraform output -json infrastructure_endpoints | jq -r '.temporal_ui'`

**ArgoCD:**
- URL: `terraform output -json gitops_endpoints | jq -r '.argocd_url'`
- Login: admin / (see `make credentials`)

## Support

**Documentation:**
- Quick Start: [QUICKSTART.md](QUICKSTART.md)
- Full Guide: [README.md](README.md)
- Architecture: [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)

**Commands:**
- Help: `make help`
- Status: `make status`
- Endpoints: `make endpoints`
- Health: `make check-health`

**External Resources:**
- Terraform Docs: https://www.terraform.io/docs
- Kubernetes Docs: https://kubernetes.io/docs
- Helm Docs: https://helm.sh/docs

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-08 | Initial complete configuration |

---

**Total Configuration Size:** 4,655 lines across 9 files
**Estimated Deployment Time:** 10-15 minutes
**Managed Resources:** 200+ Kubernetes objects
**Deployed Services:** 47 services across 9 namespaces
