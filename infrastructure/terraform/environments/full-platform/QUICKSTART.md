# Ananta Platform SaaS - Quick Start Guide

Get the entire platform (47 services) running in 15 minutes.

## Prerequisites

- Kubernetes cluster running (docker-desktop, minikube, or cloud)
- kubectl configured
- Terraform >= 1.5.0 installed
- 16GB+ RAM available for development

## 5-Step Deployment

### Step 1: Configure (2 minutes)

```bash
cd infrastructure/terraform/environments/full-platform

# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Generate secure passwords
for i in {1..15}; do openssl rand -base64 32; done > passwords.txt

# Edit terraform.tfvars and paste passwords
nano terraform.tfvars
```

**Required changes in terraform.tfvars:**
```hcl
# CHANGE THESE (use passwords from passwords.txt)
postgres_password           = "paste-password-1-here"
redis_password              = "paste-password-2-here"
rabbitmq_password           = "paste-password-3-here"
minio_secret_key            = "paste-password-4-here"
keycloak_admin_password     = "paste-password-5-here"
keycloak_client_secret      = "paste-password-6-here"
jwt_secret                  = "paste-password-7-here"
supabase_jwt_secret         = "paste-password-8-here"
grafana_admin_password      = "paste-password-9-here"
argocd_admin_password       = "paste-password-10-here"

# Update domain (or leave as localhost for dev)
domain_name = "ananta-platform.local"

# Update git repo for ArgoCD
argocd_git_repo_url = "https://github.com/your-org/ananta-platform-saas.git"
```

### Step 2: Initialize (1 minute)

```bash
# Using Makefile
make init

# Or directly
terraform init
```

### Step 3: Plan (2 minutes)

```bash
# Review what will be created
make plan

# Or directly
terraform plan -out=tfplan
```

**Expected output:** ~200+ resources to create across 6 phases

### Step 4: Deploy (10 minutes)

```bash
# Deploy everything
make apply

# Or directly
terraform apply tfplan
```

**Timeline:**
- 0-2 min: Namespaces and network policies
- 2-5 min: Databases, Redis, RabbitMQ, MinIO start
- 5-7 min: Keycloak, Temporal, Vault initialize
- 7-9 min: Services start (Control Plane, App Plane)
- 9-10 min: Frontends deploy
- 10 min: ArgoCD ready

### Step 5: Verify (1 minute)

```bash
# Check all pods are running
make check-health

# Get service URLs
make quick-access

# Get admin credentials
make credentials
```

## Post-Deployment Setup

### 1. Import Keycloak Realm

```bash
# Get Keycloak URL and credentials
KEYCLOAK_URL=$(terraform output -json infrastructure_endpoints | jq -r '.keycloak_url')
KEYCLOAK_PASS=$(terraform output -json admin_credentials | jq -r '.keycloak.admin_password')

echo "Access Keycloak: ${KEYCLOAK_URL}/admin"
echo "Username: admin"
echo "Password: ${KEYCLOAK_PASS}"
```

Navigate to Keycloak admin console:
1. Login with admin credentials
2. Select "Master" realm dropdown → Add realm
3. Click "Import" → Select `infrastructure/keycloak/realm-ananta.json`
4. Click "Create"

### 2. Access Admin App

```bash
# Get Admin App URL
terraform output -json control_plane_endpoints | jq -r '.admin_app'

# Open in browser
# Login with Keycloak user (create one first in Keycloak)
```

### 3. Access Customer Portal

```bash
# Get Customer Portal URL
terraform output -json app_plane_endpoints | jq -r '.customer_portal'

# Open in browser
```

### 4. Configure ArgoCD (Optional)

```bash
# Get ArgoCD credentials
ARGOCD_URL=$(terraform output -json gitops_endpoints | jq -r '.argocd_url')
ARGOCD_PASS=$(terraform output -json admin_credentials | jq -r '.argocd.admin_password')

# Login via CLI
argocd login ${ARGOCD_URL} --username admin --password ${ARGOCD_PASS} --insecure

# Sync applications
argocd app sync control-plane
argocd app sync app-plane
```

## Quick Access URLs

After deployment, access these services:

| Service | URL | Purpose |
|---------|-----|---------|
| Admin App | http://localhost:27555 | Tenant management |
| Customer Portal | http://localhost:27100 | BOM management |
| Keycloak Admin | http://localhost:8180/admin | Identity management |
| Temporal UI | http://localhost:27021 | Workflow monitoring |
| Grafana | http://localhost:3000 | Metrics & dashboards |
| ArgoCD | http://localhost:8080 | GitOps deployments |
| MinIO Console | http://localhost:27041 | Object storage |
| Supabase Studio | http://localhost:27800 | Database admin |

**Note:** Exact ports depend on your ingress/LoadBalancer configuration. Use `make quick-access` to see actual URLs.

## Common Commands

```bash
# View all service endpoints
make endpoints

# Watch deployment progress
make watch-pods

# View logs for a service
make logs SERVICE=tenant-management NS=control-plane

# Port-forward to a service
make port-forward SERVICE=postgresql NS=database-system PORT=5432

# Check platform health
make check-health

# Destroy everything (careful!)
make destroy
```

## Troubleshooting

### Pods not starting?

```bash
# Check pod status
kubectl get pods --all-namespaces

# Describe problematic pod
kubectl describe pod <pod-name> -n <namespace>

# View logs
kubectl logs <pod-name> -n <namespace>
```

### Database connection issues?

```bash
# Port-forward to PostgreSQL
kubectl port-forward -n database-system svc/postgresql 5432:5432

# Connect from your machine
psql -h localhost -U postgres -d arc_saas
```

### Out of resources?

**Docker Desktop users:**
1. Open Docker Desktop → Settings → Resources
2. Increase CPUs to 8
3. Increase Memory to 16GB
4. Increase Disk to 50GB
5. Click "Apply & Restart"

### Still having issues?

```bash
# Check Terraform state
terraform state list

# Refresh state
terraform refresh

# Validate configuration
terraform validate

# See full documentation
cat README.md
```

## Environment-Specific Tips

### Development (Docker Desktop)

```hcl
# In terraform.tfvars
postgres_replica_count = 1
redis_replica_count    = 1
temporal_frontend_replicas = 1
tenant_management_replicas = 1
```

### Staging

```hcl
postgres_replica_count = 2
redis_replica_count    = 2
temporal_frontend_replicas = 2
tenant_management_replicas = 2
enable_network_policies = true
postgres_enable_backup = true
```

### Production

```hcl
postgres_replica_count = 3
redis_replica_count    = 3
temporal_frontend_replicas = 3
temporal_history_replicas = 5
tenant_management_replicas = 3
cns_service_replicas = 5
enrichment_service_replicas = 10
enable_network_policies = true
postgres_enable_backup = true
enable_tls = true
```

## Next Steps

1. **Configure Keycloak**: Import realm, create users, assign roles
2. **Create First Tenant**: Use Admin App to create a tenant
3. **Upload BOMs**: Use Customer Portal to upload and enrich BOMs
4. **Monitor**: Check Grafana dashboards for metrics
5. **Set Up CI/CD**: Configure ArgoCD for continuous deployment
6. **Production Hardening**: See README.md security section

## Cost Estimation

Development (local):
- Infrastructure: Free (local Kubernetes)
- Services: CPU/Memory usage only

Cloud (AWS/GCP/Azure):
- Small (dev): $100-200/month
- Medium (staging): $500-1000/month
- Large (production): $2000-5000/month

Use `make cost` (requires [Infracost](https://www.infracost.io/)) for detailed estimates.

## Support

- Full documentation: [README.md](README.md)
- Troubleshooting: [README.md#troubleshooting](README.md#troubleshooting)
- Architecture: [../../docs/PLATFORM_INTEGRATION_PLAN.md](../../docs/PLATFORM_INTEGRATION_PLAN.md)
- Module docs: [../../modules/](../../modules/)
