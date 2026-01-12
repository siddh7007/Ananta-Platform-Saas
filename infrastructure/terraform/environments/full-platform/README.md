# Ananta Platform SaaS - Full Platform Deployment

Complete unified Terraform configuration for deploying all 47 services of the Ananta Platform SaaS across 9 Kubernetes namespaces.

## Overview

This configuration orchestrates the entire platform deployment in 6 sequential phases:

### Phase 1: Infrastructure Layer (8 services)
- PostgreSQL (Bitnami Helm) - Multi-tenant database
- Redis (Bitnami Helm) - Caching and session storage
- RabbitMQ (Bitnami Helm) - Message broker
- MinIO (Official Helm) - Object storage
- Vault (HashiCorp Helm) - Secrets management
- Keycloak (Bitnami Helm) - Identity and access management
- Temporal (Official Helm) - Workflow engine
- Network policies and ingress

### Phase 2: Data Layer (3 services)
- Supabase - App Plane database and APIs
- Directus - Admin CMS
- Novu - Notification service
- Observability stack (Prometheus, Grafana, Loki, Tempo)

### Phase 3: Migrations
- Control Plane database migrations
- App Plane database migrations (Supabase)
- Components-V2 database migrations

### Phase 4: Services (8 services)
**Control Plane:**
- Tenant Management Service
- Orchestrator Service
- Subscription Service
- Temporal Worker Service

**App Plane:**
- CNS Service (Component Normalization)
- Enrichment Service
- BOM Service
- Analytics Service

### Phase 5: Frontends (5 applications)
- Admin App (Control Plane management)
- Customer Portal (End-user BOM management)
- Backstage Portal (Developer portal)
- CNS Dashboard (Component data admin)
- Unified Dashboard (Analytics and reporting)

### Phase 6: GitOps (1 service)
- ArgoCD (Continuous delivery)

## Prerequisites

### Required Tools
- Terraform >= 1.5.0
- kubectl >= 1.26.0
- Kubernetes cluster (docker-desktop, minikube, EKS, GKE, AKS)
- Helm >= 3.12.0 (managed by Terraform)

### Kubernetes Cluster Requirements

#### Development (docker-desktop)
- CPU: 8+ cores
- Memory: 16+ GB
- Storage: 50+ GB

#### Staging
- CPU: 16+ cores
- Memory: 32+ GB
- Storage: 100+ GB
- 3+ worker nodes

#### Production
- CPU: 32+ cores
- Memory: 64+ GB
- Storage: 500+ GB
- 5+ worker nodes
- Multi-AZ/region setup
- Dedicated node pools for databases

### Storage Classes
Ensure your cluster has a default storage class or configure `storage_class` variable:
- Docker Desktop: `hostpath`
- Minikube: `standard`
- AWS EKS: `gp3`
- GCP GKE: `pd-ssd`
- Azure AKS: `managed-premium`

## Quick Start

### 1. Clone and Configure

```bash
cd infrastructure/terraform/environments/full-platform

# Copy example tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
# IMPORTANT: Change ALL passwords and secrets!
nano terraform.tfvars
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan Deployment

```bash
# Review what will be created
terraform plan -out=tfplan

# Review estimated costs (optional, requires Infracost)
infracost breakdown --path .
```

### 4. Deploy Platform

```bash
# Apply the plan
terraform apply tfplan

# This will take 10-15 minutes for all services to start
```

### 5. Monitor Deployment

```bash
# Watch all pods across namespaces
kubectl get pods --all-namespaces -w

# Check specific namespace
kubectl get pods -n control-plane
kubectl get pods -n app-plane

# Check services
kubectl get services --all-namespaces

# Check ingresses
kubectl get ingresses --all-namespaces
```

### 6. Access Services

After deployment completes, get service URLs:

```bash
# Get all outputs
terraform output

# Get specific endpoints
terraform output quick_access_urls

# Get admin credentials (sensitive)
terraform output -json admin_credentials
```

### 7. Post-Deployment Configuration

#### Import Keycloak Realm

```bash
# Get Keycloak admin credentials
KEYCLOAK_PASSWORD=$(terraform output -json admin_credentials | jq -r '.keycloak.admin_password')
KEYCLOAK_URL=$(terraform output -json infrastructure_endpoints | jq -r '.keycloak_url')

# Access Keycloak admin console
echo "Access: ${KEYCLOAK_URL}/admin"
echo "Username: admin"
echo "Password: ${KEYCLOAK_PASSWORD}"

# Import realm configuration
# Navigate to: Master realm -> Add realm -> Import
# File: infrastructure/keycloak/realm-ananta.json
```

#### Configure ArgoCD

```bash
# Get ArgoCD credentials
ARGOCD_PASSWORD=$(terraform output -json admin_credentials | jq -r '.argocd.admin_password')
ARGOCD_URL=$(terraform output -json gitops_endpoints | jq -r '.argocd_url')

# Login to ArgoCD
argocd login ${ARGOCD_URL} --username admin --password ${ARGOCD_PASSWORD} --insecure

# Sync applications
argocd app sync control-plane
argocd app sync app-plane
argocd app sync infrastructure
```

#### Access Admin App

```bash
# Get admin app URL
ADMIN_APP_URL=$(terraform output -json control_plane_endpoints | jq -r '.admin_app')

echo "Admin App: ${ADMIN_APP_URL}"
```

## Configuration Guide

### Essential Variables

#### Security (MUST CHANGE!)
```hcl
# In terraform.tfvars
postgres_password           = "strong-random-password-32-chars"
redis_password              = "strong-random-password-32-chars"
rabbitmq_password           = "strong-random-password-32-chars"
minio_secret_key            = "strong-random-password-32-chars"
vault_root_token            = "strong-random-password-32-chars"
keycloak_admin_password     = "strong-random-password-32-chars"
keycloak_client_secret      = "strong-random-password-32-chars"
keycloak_client_secret_app  = "strong-random-password-32-chars"
jwt_secret                  = "strong-random-password-32-chars"
supabase_jwt_secret         = "strong-random-password-32-chars"
directus_secret_key         = "strong-random-password-32-chars"
novu_jwt_secret             = "strong-random-password-32-chars"
grafana_admin_password      = "strong-random-password-32-chars"
argocd_admin_password       = "strong-random-password-32-chars"
```

Generate strong passwords:
```bash
# Generate 32-character random passwords
openssl rand -base64 32

# Or use this for multiple passwords
for i in {1..15}; do openssl rand -base64 32; done
```

#### Domain Configuration
```hcl
domain_name     = "platform.example.com"
enable_tls      = true
tls_secret_name = "platform-tls-cert"
```

#### Storage Configuration
```hcl
storage_class        = "gp3"              # AWS
postgres_storage_size = "100Gi"           # Production size
redis_storage_size   = "20Gi"
minio_storage_size   = "50Gi"
```

#### Scaling Configuration

**Development:**
```hcl
postgres_replica_count      = 1
redis_replica_count         = 1
tenant_management_replicas  = 1
cns_service_replicas        = 1
admin_app_replicas          = 1
```

**Production:**
```hcl
postgres_replica_count      = 3
redis_replica_count         = 3
temporal_frontend_replicas  = 3
temporal_history_replicas   = 5
tenant_management_replicas  = 3
cns_service_replicas        = 3
enrichment_service_replicas = 5
admin_app_replicas          = 2
```

## Module Dependencies

The deployment follows strict dependency ordering:

```
Phase 1 (Infrastructure)
  ├── PostgreSQL ────────┐
  ├── Redis ─────────────┤
  ├── RabbitMQ ──────────┤
  ├── MinIO ─────────────┤
  ├── Vault ─────────────┤
  ├── Keycloak ──────────┤ (depends on PostgreSQL)
  └── Temporal ──────────┘ (depends on PostgreSQL)
          │
          ▼
Phase 2 (Data Layer)
  ├── Supabase ──────────┐ (depends on PostgreSQL, MinIO)
  ├── Directus ──────────┤ (depends on PostgreSQL, MinIO)
  ├── Novu ──────────────┤ (depends on PostgreSQL, Redis)
  └── Observability ─────┘
          │
          ▼
Phase 3 (Migrations)
  └── Database Migrations (depends on all databases)
          │
          ▼
Phase 4 (Services)
  ├── Control Plane ─────┐ (depends on PostgreSQL, Redis, Keycloak, Temporal, Novu)
  └── App Plane ─────────┘ (depends on PostgreSQL, Redis, RabbitMQ, MinIO, Supabase)
          │
          ▼
Phase 5 (Frontends)
  └── Frontend Apps ───── (depends on Control Plane, App Plane services)
          │
          ▼
Phase 6 (GitOps)
  └── ArgoCD ──────────── (depends on all above)
```

## Troubleshooting

### Deployment Issues

#### Pods Not Starting
```bash
# Check pod status
kubectl get pods -n <namespace>

# Describe pod for events
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace>

# Check previous logs (if pod restarted)
kubectl logs <pod-name> -n <namespace> --previous
```

#### Database Connection Issues
```bash
# Port-forward to PostgreSQL
kubectl port-forward -n database-system svc/postgresql 5432:5432

# Test connection
psql -h localhost -U postgres -d arc_saas

# Check database exists
kubectl exec -it -n database-system postgresql-0 -- psql -U postgres -c "\l"
```

#### Storage Issues
```bash
# Check PVCs
kubectl get pvc --all-namespaces

# Check storage class
kubectl get storageclass

# Describe PVC for errors
kubectl describe pvc <pvc-name> -n <namespace>
```

#### Resource Constraints
```bash
# Check node resources
kubectl top nodes

# Check pod resources
kubectl top pods --all-namespaces

# Describe node
kubectl describe node <node-name>
```

### Terraform Issues

#### State Lock
```bash
# Force unlock (use carefully!)
terraform force-unlock <lock-id>
```

#### Dependency Errors
```bash
# Refresh state
terraform refresh

# Target specific module
terraform apply -target=module.database
```

#### Provider Issues
```bash
# Upgrade providers
terraform init -upgrade

# Validate configuration
terraform validate
```

### Network Issues

#### DNS Resolution
```bash
# Test DNS from pod
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup postgresql.database-system.svc.cluster.local

# Check CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
```

#### Network Policies
```bash
# List network policies
kubectl get networkpolicies --all-namespaces

# Temporarily disable (for debugging)
kubectl delete networkpolicy <policy-name> -n <namespace>
```

## Disaster Recovery

### Backup

#### Database Backup
```bash
# Backup PostgreSQL
kubectl exec -n database-system postgresql-0 -- pg_dumpall -U postgres > backup-$(date +%Y%m%d).sql

# Upload to S3/GCS
aws s3 cp backup-$(date +%Y%m%d).sql s3://ananta-backups/postgres/
```

#### State Backup
```bash
# Backup Terraform state
terraform state pull > terraform.tfstate.backup-$(date +%Y%m%d)

# Upload to S3
aws s3 cp terraform.tfstate.backup-$(date +%Y%m%d) s3://ananta-backups/terraform/
```

### Restore

#### Database Restore
```bash
# Restore PostgreSQL
kubectl exec -i -n database-system postgresql-0 -- psql -U postgres < backup-20240101.sql
```

#### State Restore
```bash
# Restore Terraform state
terraform state push terraform.tfstate.backup-20240101
```

## Upgrading

### Service Upgrades
```bash
# Update image version in terraform.tfvars
tenant_management_image = "ananta/tenant-management-service:v1.2.0"

# Plan and apply
terraform plan -out=tfplan
terraform apply tfplan
```

### Infrastructure Upgrades
```bash
# Update versions in terraform.tfvars
postgres_version = "15.5.0"
redis_version    = "7.2.1"

# Plan carefully - may cause downtime
terraform plan -out=tfplan

# Review breaking changes
# Apply during maintenance window
terraform apply tfplan
```

## Security Best Practices

### Secrets Management
1. Never commit `terraform.tfvars` to version control
2. Use Vault or cloud secrets manager for production
3. Rotate credentials regularly
4. Use least-privilege IAM roles

### Network Security
1. Enable network policies
2. Use TLS for all services
3. Restrict ingress rules
4. Use service mesh (Istio/Linkerd) for mTLS

### Access Control
1. Use RBAC for Kubernetes
2. Configure Keycloak roles properly
3. Enable audit logging
4. Monitor access patterns

## Performance Tuning

### Database
```hcl
postgres_cpu_limit      = "4"
postgres_memory_limit   = "8Gi"
postgres_storage_size   = "500Gi"
```

### Cache
```hcl
redis_max_memory        = "8gb"
redis_replica_count     = 5
```

### Services
```hcl
# Increase replicas for high-traffic services
tenant_management_replicas  = 5
cns_service_replicas        = 10
enrichment_service_replicas = 15
```

## Cost Optimization

### Development
- Use single replicas
- Reduce resource limits
- Use minimal storage
- Disable backups

### Production
- Right-size resource requests
- Use spot/preemptible instances
- Enable autoscaling
- Use storage lifecycle policies

## Monitoring

### Key Metrics
- Pod CPU/Memory usage
- Database connections
- API response times
- Error rates
- Queue depths

### Alerts
Configure alerts in Grafana for:
- High CPU/Memory usage (>80%)
- Pod restarts
- Database connection limits
- Disk space (>80%)
- Service downtime

## Support

### Logs
```bash
# Aggregate logs
kubectl logs -l app=tenant-management -n control-plane --tail=100

# Follow logs
kubectl logs -f -l app=cns-service -n app-plane
```

### Debug Pod
```bash
# Create debug pod
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash

# Test connectivity
curl http://tenant-management.control-plane.svc.cluster.local:14000/health
```

## References

- [Terraform Documentation](https://www.terraform.io/docs)
- [Kubernetes Documentation](https://kubernetes.io/docs)
- [Helm Documentation](https://helm.sh/docs)
- [Ananta Platform Documentation](../../docs/)
