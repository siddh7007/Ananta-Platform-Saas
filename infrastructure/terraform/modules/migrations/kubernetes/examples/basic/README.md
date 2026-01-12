# Basic Migrations Example

This example demonstrates how to use the migrations module to run all three database migrations:

1. Control Plane (LoopBack db-migrate)
2. Supabase (SQL migrations)
3. Components-V2 (SQL migrations)

## Prerequisites

- Kubernetes cluster configured
- `kubectl` configured with cluster access
- Terraform >= 1.0
- Database passwords available

## Usage

1. Copy the example tfvars file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` with your actual database credentials:
   ```hcl
   control_plane_db_password = "your-actual-password"
   supabase_db_password      = "your-actual-password"
   components_v2_db_password = "your-actual-password"
   ```

3. Initialize Terraform:
   ```bash
   terraform init
   ```

4. Review the plan:
   ```bash
   terraform plan
   ```

5. Apply the migrations:
   ```bash
   terraform apply
   ```

6. Check migration status using output commands:
   ```bash
   terraform output -json helpful_commands | jq
   ```

## What Gets Created

- **ConfigMap**: `migration-config` - Contains database connection details
- **Secret**: `migration-db-credentials` - Contains database passwords
- **Jobs**: Three Kubernetes Jobs for each migration type
  - `control-plane-migrations-XXXXX`
  - `supabase-migrations-XXXXX`
  - `components-v2-migrations-XXXXX`

## Monitoring

Check job status:
```bash
kubectl get jobs -n ananta-platform -l app.kubernetes.io/component=migrations
```

View logs for Control Plane migration:
```bash
kubectl logs -n ananta-platform -l job-name=$(terraform output -raw control_plane_job_name)
```

## Cleanup

Jobs will auto-delete after 5 minutes of completion. To manually clean up:

```bash
terraform destroy
```

Note: This only deletes the ConfigMap and Secret. Completed jobs are already cleaned up by TTL.
