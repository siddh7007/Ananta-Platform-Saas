# Database Migrations Kubernetes Module

Terraform module for running database migrations in Kubernetes using Jobs. Supports three migration types:

1. **Control Plane Migrations** - LoopBack db-migrate for tenant-management-service
2. **Supabase Migrations** - SQL migrations for App Plane Supabase database
3. **Components-V2 Migrations** - SQL migrations for Components-V2 database

## Features

- **Idempotent Jobs** - Uses random suffixes for unique job names on each run
- **Database Readiness Checks** - Init containers wait for PostgreSQL before running migrations
- **Secure Secret Management** - Database credentials stored in Kubernetes Secrets
- **Resource Limits** - Configurable CPU/memory limits to prevent resource exhaustion
- **Backoff Retries** - Automatic retry with backoff on failure (max 3 attempts)
- **Auto-Cleanup** - Jobs auto-delete 5 minutes after completion
- **Security Context** - Runs as non-root with dropped capabilities
- **Istio Compatible** - Disables sidecar injection for migration jobs

## Usage

### Basic Example

```hcl
module "migrations" {
  source = "../../modules/migrations/kubernetes"

  namespace = "ananta-platform"

  # Control Plane database
  control_plane_db_host     = "postgres-service"
  control_plane_db_port     = 5432
  control_plane_db_name     = "arc_saas"
  control_plane_db_user     = "postgres"
  control_plane_db_password = var.db_password

  # Supabase database
  supabase_db_host     = "app-plane-supabase-db"
  supabase_db_port     = 27432
  supabase_db_name     = "postgres"
  supabase_db_user     = "postgres"
  supabase_db_password = var.supabase_password

  # Components-V2 database
  components_v2_db_host     = "app-plane-components-v2-postgres"
  components_v2_db_port     = 27010
  components_v2_db_name     = "components_v2"
  components_v2_db_user     = "postgres"
  components_v2_db_password = var.components_password

  # Migration images
  control_plane_migration_image = "ananta/tenant-management-service:1.0.0"
  supabase_migration_image      = "ananta/supabase-migrations:1.0.0"
  components_v2_migration_image = "ananta/components-v2-migrations:1.0.0"
}
```

### Selective Migrations

Run only specific migrations:

```hcl
module "migrations" {
  source = "../../modules/migrations/kubernetes"

  # Enable only Control Plane migrations
  run_control_plane_migrations  = true
  run_supabase_migrations       = false
  run_components_v2_migrations  = false

  # ... database configuration ...
}
```

### Custom Resource Limits

```hcl
module "migrations" {
  source = "../../modules/migrations/kubernetes"

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

  # ... database configuration ...
}
```

### Do Not Wait for Completion

By default, Terraform waits for jobs to complete. To apply without waiting:

```hcl
module "migrations" {
  source = "../../modules/migrations/kubernetes"

  wait_for_completion = false

  # ... database configuration ...
}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| kubernetes | ~> 2.23 |
| random | ~> 3.5 |

## Providers

| Name | Version |
|------|---------|
| kubernetes | ~> 2.23 |
| random | ~> 3.5 |

## Resources

| Type | Name | Description |
|------|------|-------------|
| kubernetes_config_map | migration_config | Non-sensitive configuration (hosts, ports, database names) |
| kubernetes_secret | migration_db_credentials | Sensitive credentials (usernames, passwords) |
| kubernetes_job | control_plane_migrations | Job for Control Plane LoopBack migrations |
| kubernetes_job | supabase_migrations | Job for Supabase SQL migrations |
| kubernetes_job | components_v2_migrations | Job for Components-V2 SQL migrations |
| random_id | *_job_suffix | Unique suffixes for job names |

## Inputs

### Required Inputs

| Name | Description | Type |
|------|-------------|------|
| control_plane_db_host | Control Plane PostgreSQL host | string |
| control_plane_db_user | Control Plane database user | string (sensitive) |
| control_plane_db_password | Control Plane database password | string (sensitive) |
| supabase_db_host | Supabase PostgreSQL host | string |
| supabase_db_user | Supabase database user | string (sensitive) |
| supabase_db_password | Supabase database password | string (sensitive) |
| components_v2_db_host | Components-V2 PostgreSQL host | string |
| components_v2_db_user | Components-V2 database user | string (sensitive) |
| components_v2_db_password | Components-V2 database password | string (sensitive) |

### Optional Inputs

| Name | Description | Type | Default |
|------|-------------|------|---------|
| namespace | Kubernetes namespace | string | "default" |
| service_account_name | Service account for jobs | string | "default" |
| run_control_plane_migrations | Enable Control Plane migrations | bool | true |
| run_supabase_migrations | Enable Supabase migrations | bool | true |
| run_components_v2_migrations | Enable Components-V2 migrations | bool | true |
| control_plane_db_port | Control Plane PostgreSQL port | number | 5432 |
| control_plane_db_name | Control Plane database name | string | "arc_saas" |
| control_plane_db_schema | Control Plane database schema | string | "tenant_management" |
| supabase_db_port | Supabase PostgreSQL port | number | 27432 |
| supabase_db_name | Supabase database name | string | "postgres" |
| components_v2_db_port | Components-V2 PostgreSQL port | number | 27010 |
| components_v2_db_name | Components-V2 database name | string | "components_v2" |
| control_plane_migration_image | Control Plane migration image | string | "ananta/tenant-management-service:latest" |
| supabase_migration_image | Supabase migration image | string | "postgres:15-alpine" |
| components_v2_migration_image | Components-V2 migration image | string | "postgres:15-alpine" |
| postgres_wait_image | PostgreSQL readiness check image | string | "postgres:15-alpine" |
| migration_timeout | Timeout for job creation | string | "10m" |
| wait_for_completion | Wait for jobs to complete | bool | true |
| labels | Additional labels | map(string) | {} |

## Outputs

| Name | Description |
|------|-------------|
| control_plane_job_name | Name of Control Plane migration job |
| control_plane_job_namespace | Namespace of Control Plane migration job |
| supabase_job_name | Name of Supabase migration job |
| supabase_job_namespace | Namespace of Supabase migration job |
| components_v2_job_name | Name of Components-V2 migration job |
| components_v2_job_namespace | Namespace of Components-V2 migration job |
| migration_jobs_summary | Summary of all migration jobs |
| helpful_commands | Kubectl commands for checking status |

## Migration Image Requirements

### Control Plane Image

The Control Plane migration image must:
- Be a LoopBack application with db-migrate installed
- Have migrations in `migrations/pg/` directory
- Support `npm run migrate` command
- Use these environment variables:
  - `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_SCHEMA`
  - `NODE_ENV=production`

### Supabase/Components-V2 Images

These migration images must:
- Have `psql` installed (postgres:15-alpine works)
- Have migration SQL files in `/migrations/` directory
- Files must be named `*.sql` and ordered for sequential execution

Example Dockerfile:

```dockerfile
FROM postgres:15-alpine

# Copy migration files
COPY database/migrations/*.sql /migrations/

# psql is already available in postgres image
```

## Checking Migration Status

After applying, use the output commands to check status:

```bash
# Get migration job status
terraform output -json helpful_commands | jq -r '.list_jobs'

# View Control Plane migration logs
terraform output -json helpful_commands | jq -r '.control_plane_logs'

# View Supabase migration logs
terraform output -json helpful_commands | jq -r '.supabase_logs'

# View Components-V2 migration logs
terraform output -json helpful_commands | jq -r '.components_v2_logs'
```

Or directly with kubectl:

```bash
# List all migration jobs
kubectl get jobs -n ananta-platform -l app.kubernetes.io/component=migrations

# Check specific job
kubectl get job control-plane-migrations-abc123 -n ananta-platform

# View job logs
kubectl logs -n ananta-platform -l job-name=control-plane-migrations-abc123

# Describe job for troubleshooting
kubectl describe job control-plane-migrations-abc123 -n ananta-platform
```

## Job Behavior

### Lifecycle

1. **Creation** - Job created with unique name using random suffix
2. **Init Container** - Waits for PostgreSQL readiness (pg_isready)
3. **Main Container** - Runs migrations
4. **Completion** - Job marked as complete or failed
5. **Cleanup** - Job auto-deleted after 5 minutes (TTL)

### Retry Logic

- **Backoff Limit**: 3 attempts
- **Restart Policy**: Never (failed pods are not restarted)
- **Retry Behavior**: Kubernetes creates new pods for each retry

### Idempotency

Each `terraform apply` creates new jobs with unique names. Old jobs are cleaned up automatically after TTL expires. Migrations should be idempotent (safe to run multiple times).

## Security

- **Non-Root**: Containers run as non-root users (UID 1000/999)
- **Capabilities**: All capabilities dropped
- **Secrets**: Database passwords stored in Kubernetes Secrets
- **Network**: No Istio sidecar injection (migrations should complete quickly)

## Troubleshooting

### Job Never Completes

Check init container logs:
```bash
kubectl logs -n ananta-platform -l job-name=<job-name> -c wait-for-postgres
```

If database is unreachable, verify:
- Database service name and port
- Network policies allow traffic
- Database is actually running

### Migration Fails

Check main container logs:
```bash
kubectl logs -n ananta-platform -l job-name=<job-name> -c run-migrations
```

Common issues:
- **Missing migration files** - Verify image contains migrations
- **Permission denied** - Check database user permissions
- **Schema conflicts** - Ensure migrations are idempotent
- **Timeout** - Increase `migration_timeout` variable

### Job Stuck in Pending

Describe the job:
```bash
kubectl describe job <job-name> -n ananta-platform
```

Check for:
- **Insufficient resources** - Reduce resource requests
- **Image pull errors** - Verify image exists and credentials are correct
- **Node selector issues** - Ensure nodes match job requirements

## License

Proprietary - Ananta Platform SaaS
