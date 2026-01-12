# Example: Basic database migrations setup
# This example shows how to run all three migrations (Control Plane, Supabase, Components-V2)

terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# Configure Kubernetes provider
provider "kubernetes" {
  config_path = "~/.kube/config"
}

# Database migration module
module "migrations" {
  source = "../../"

  namespace            = "ananta-platform"
  service_account_name = "migration-runner"

  # Control Plane database configuration
  control_plane_db_host     = "arc-saas-postgres"
  control_plane_db_port     = 5432
  control_plane_db_name     = "arc_saas"
  control_plane_db_user     = var.control_plane_db_user
  control_plane_db_password = var.control_plane_db_password
  control_plane_db_schema   = "tenant_management"

  # Supabase database configuration
  supabase_db_host     = "app-plane-supabase-db"
  supabase_db_port     = 27432
  supabase_db_name     = "postgres"
  supabase_db_user     = var.supabase_db_user
  supabase_db_password = var.supabase_db_password

  # Components-V2 database configuration
  components_v2_db_host     = "app-plane-components-v2-postgres"
  components_v2_db_port     = 27010
  components_v2_db_name     = "components_v2"
  components_v2_db_user     = var.components_v2_db_user
  components_v2_db_password = var.components_v2_db_password

  # Migration images (customize these for your registry)
  control_plane_migration_image = "ananta/tenant-management-service:1.0.0"
  supabase_migration_image      = "ananta/supabase-migrations:1.0.0"
  components_v2_migration_image = "ananta/components-v2-migrations:1.0.0"

  # Enable all migrations
  run_control_plane_migrations = true
  run_supabase_migrations      = true
  run_components_v2_migrations = true

  # Resource limits
  migration_resources = {
    requests = {
      cpu    = "100m"
      memory = "256Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "512Mi"
    }
  }

  # Wait for migrations to complete before marking apply as done
  wait_for_completion = true

  # Additional labels
  labels = {
    "environment" = "production"
    "managed-by"  = "terraform"
  }
}

# Outputs
output "migration_summary" {
  description = "Summary of all migration jobs"
  value       = module.migrations.migration_jobs_summary
}

output "helpful_commands" {
  description = "Kubectl commands for checking migration status"
  value       = module.migrations.helpful_commands
}
