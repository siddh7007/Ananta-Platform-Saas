# Migrations Module - Quick Reference

One-page cheat sheet for the database migrations Terraform module.

## Minimal Usage

```hcl
module "migrations" {
  source = "./modules/migrations/kubernetes"

  namespace = "ananta-platform"

  # Control Plane
  control_plane_db_host     = "postgres-svc"
  control_plane_db_user     = "postgres"
  control_plane_db_password = var.db_password

  # Supabase
  supabase_db_host     = "supabase-db"
  supabase_db_user     = "postgres"
  supabase_db_password = var.supabase_password

  # Components-V2
  components_v2_db_host     = "components-db"
  components_v2_db_user     = "postgres"
  components_v2_db_password = var.components_password
}
```

## Common Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `namespace` | "default" | Kubernetes namespace |
| `run_control_plane_migrations` | true | Enable Control Plane |
| `run_supabase_migrations` | true | Enable Supabase |
| `run_components_v2_migrations` | true | Enable Components-V2 |
| `wait_for_completion` | true | Wait for jobs to finish |
| `migration_timeout` | "10m" | Job timeout |

## Essential Commands

### Apply Migrations
```bash
terraform apply -target=module.migrations
```

### Check Status
```bash
kubectl get jobs -n ananta-platform -l app.kubernetes.io/component=migrations
```

### View Logs
```bash
# Control Plane
kubectl logs -n ananta-platform -l app.kubernetes.io/name=control-plane-migrations

# Supabase
kubectl logs -n ananta-platform -l app.kubernetes.io/name=supabase-migrations

# Components-V2
kubectl logs -n ananta-platform -l app.kubernetes.io/name=components-v2-migrations
```

### Describe Job
```bash
kubectl describe job <job-name> -n ananta-platform
```

### Delete Failed Job
```bash
kubectl delete job <job-name> -n ananta-platform
```

## Selective Migrations

Run only Control Plane:
```hcl
run_control_plane_migrations = true
run_supabase_migrations      = false
run_components_v2_migrations = false
```

Run only App Plane (Supabase + Components):
```hcl
run_control_plane_migrations = false
run_supabase_migrations      = true
run_components_v2_migrations = true
```

## Custom Images

```hcl
control_plane_migration_image = "ananta/tenant-management:1.2.3"
supabase_migration_image      = "ananta/supabase-migrations:1.2.3"
components_v2_migration_image = "ananta/components-migrations:1.2.3"
```

## Resource Limits

```hcl
migration_resources = {
  requests = {
    cpu    = "200m"
    memory = "512Mi"
  }
  limits = {
    cpu    = "1000m"
    memory = "1Gi"
  }
}
```

## Database Ports

| Database | Default Port | Variable |
|----------|--------------|----------|
| Control Plane | 5432 | `control_plane_db_port` |
| Supabase | 27432 | `supabase_db_port` |
| Components-V2 | 27010 | `components_v2_db_port` |

## Environment Variables (Job Containers)

### Control Plane Job
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`
- `DB_USER`, `DB_PASSWORD`, `DB_SCHEMA`
- `NODE_ENV=production`

### Supabase/Components Jobs
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`
- `POSTGRES_USER`, `PGPASSWORD`

## Outputs

Get migration summary:
```bash
terraform output migration_jobs_summary
```

Get helpful kubectl commands:
```bash
terraform output helpful_commands
```

## Troubleshooting

### Job Stuck in Pending
```bash
kubectl describe job <job-name> -n ananta-platform
# Check: Events section for errors
```

### Init Container Failing
```bash
kubectl logs <pod-name> -c wait-for-postgres -n ananta-platform
# Check: Database connectivity
```

### Migration Script Failing
```bash
kubectl logs <pod-name> -c run-migrations -n ananta-platform
# Check: Migration file errors
```

### Image Pull Error
```bash
kubectl get pods -n ananta-platform
kubectl describe pod <pod-name> -n ananta-platform
# Verify: Image exists and credentials
```

## Job Lifecycle

```
1. Create job with random suffix
2. Init container waits for database (pg_isready)
3. Main container runs migrations
4. Job completes (success/failure)
5. Auto-cleanup after 5 minutes
```

## Best Practices Checklist

- [ ] Use versioned images (not :latest)
- [ ] Test migrations in dev first
- [ ] Make migrations idempotent
- [ ] Set appropriate resource limits
- [ ] Use external secret management
- [ ] Monitor job completion
- [ ] Review logs after apply
- [ ] Document migration changes

## Common Patterns

### Fresh Deploy
```bash
terraform apply -target=module.database
terraform apply -target=module.migrations
terraform apply
```

### Update Migrations
```bash
# Build new image
docker build -t ananta/tenant-management:1.1.0 .
docker push ananta/tenant-management:1.1.0

# Update Terraform
# Edit main.tf: control_plane_migration_image = "...1.1.0"

terraform apply -target=module.migrations
```

### Rollback
```bash
# Connect to database and run rollback SQL manually
kubectl exec -it postgres-pod -n ananta-platform -- psql -U postgres -d arc_saas
# Then run: DROP TABLE ... or DELETE FROM migrations WHERE ...
```

## Integration Example

```hcl
module "database" {
  source = "./modules/database/kubernetes"
  # ... database config ...
}

module "migrations" {
  source = "./modules/migrations/kubernetes"

  depends_on = [module.database]

  control_plane_db_host = module.database.control_plane_host
  # ... rest of config ...
}

module "services" {
  source = "./modules/services/kubernetes"

  depends_on = [module.migrations]
  # ... services config ...
}
```

## Files Reference

| File | Purpose |
|------|---------|
| [README.md](./README.md) | Full documentation |
| [USAGE.md](./USAGE.md) | Detailed usage guide |
| [MODULE_SUMMARY.md](./MODULE_SUMMARY.md) | Complete overview |
| [examples/basic/](./examples/basic/) | Working example |

## Support

- Check logs: `kubectl logs -n <namespace> -l app.kubernetes.io/component=migrations`
- Describe jobs: `kubectl describe job <job-name> -n <namespace>`
- Review docs: README.md, USAGE.md
- Check examples: examples/basic/

---

**Module Path**: `infrastructure/terraform/modules/migrations/kubernetes`
**Version**: 1.0.0
**Status**: Production-ready
