# Terraform outputs for database migrations module

# Control Plane migration outputs
output "control_plane_job_name" {
  description = "Name of the Control Plane migration job"
  value       = var.run_control_plane_migrations ? kubernetes_job.control_plane_migrations[0].metadata[0].name : null
}

output "control_plane_job_namespace" {
  description = "Namespace of the Control Plane migration job"
  value       = var.run_control_plane_migrations ? kubernetes_job.control_plane_migrations[0].metadata[0].namespace : null
}

output "control_plane_job_uid" {
  description = "UID of the Control Plane migration job"
  value       = var.run_control_plane_migrations ? kubernetes_job.control_plane_migrations[0].metadata[0].uid : null
}

output "control_plane_job_status" {
  description = "Status reference for Control Plane migration job (check with kubectl)"
  value = var.run_control_plane_migrations ? {
    name      = kubernetes_job.control_plane_migrations[0].metadata[0].name
    namespace = kubernetes_job.control_plane_migrations[0].metadata[0].namespace
    command   = "kubectl get job ${kubernetes_job.control_plane_migrations[0].metadata[0].name} -n ${kubernetes_job.control_plane_migrations[0].metadata[0].namespace} -o jsonpath='{.status}'"
  } : null
}

# Supabase migration outputs
output "supabase_job_name" {
  description = "Name of the Supabase migration job"
  value       = var.run_supabase_migrations ? kubernetes_job.supabase_migrations[0].metadata[0].name : null
}

output "supabase_job_namespace" {
  description = "Namespace of the Supabase migration job"
  value       = var.run_supabase_migrations ? kubernetes_job.supabase_migrations[0].metadata[0].namespace : null
}

output "supabase_job_uid" {
  description = "UID of the Supabase migration job"
  value       = var.run_supabase_migrations ? kubernetes_job.supabase_migrations[0].metadata[0].uid : null
}

output "supabase_job_status" {
  description = "Status reference for Supabase migration job (check with kubectl)"
  value = var.run_supabase_migrations ? {
    name      = kubernetes_job.supabase_migrations[0].metadata[0].name
    namespace = kubernetes_job.supabase_migrations[0].metadata[0].namespace
    command   = "kubectl get job ${kubernetes_job.supabase_migrations[0].metadata[0].name} -n ${kubernetes_job.supabase_migrations[0].metadata[0].namespace} -o jsonpath='{.status}'"
  } : null
}

# Components-V2 migration outputs
output "components_v2_job_name" {
  description = "Name of the Components-V2 migration job"
  value       = var.run_components_v2_migrations ? kubernetes_job.components_v2_migrations[0].metadata[0].name : null
}

output "components_v2_job_namespace" {
  description = "Namespace of the Components-V2 migration job"
  value       = var.run_components_v2_migrations ? kubernetes_job.components_v2_migrations[0].metadata[0].namespace : null
}

output "components_v2_job_uid" {
  description = "UID of the Components-V2 migration job"
  value       = var.run_components_v2_migrations ? kubernetes_job.components_v2_migrations[0].metadata[0].uid : null
}

output "components_v2_job_status" {
  description = "Status reference for Components-V2 migration job (check with kubectl)"
  value = var.run_components_v2_migrations ? {
    name      = kubernetes_job.components_v2_migrations[0].metadata[0].name
    namespace = kubernetes_job.components_v2_migrations[0].metadata[0].namespace
    command   = "kubectl get job ${kubernetes_job.components_v2_migrations[0].metadata[0].name} -n ${kubernetes_job.components_v2_migrations[0].metadata[0].namespace} -o jsonpath='{.status}'"
  } : null
}

# Shared resource outputs
output "migration_config_map_name" {
  description = "Name of the migration configuration ConfigMap"
  value       = kubernetes_config_map.migration_config.metadata[0].name
}

output "migration_secret_name" {
  description = "Name of the migration credentials Secret"
  value       = kubernetes_secret.migration_db_credentials.metadata[0].name
}

# Summary output
output "migration_jobs_summary" {
  description = "Summary of all migration jobs created"
  value = {
    control_plane = var.run_control_plane_migrations ? {
      enabled   = true
      job_name  = kubernetes_job.control_plane_migrations[0].metadata[0].name
      namespace = kubernetes_job.control_plane_migrations[0].metadata[0].namespace
      database  = "${var.control_plane_db_host}:${var.control_plane_db_port}/${var.control_plane_db_name}"
    } : { enabled = false }

    supabase = var.run_supabase_migrations ? {
      enabled   = true
      job_name  = kubernetes_job.supabase_migrations[0].metadata[0].name
      namespace = kubernetes_job.supabase_migrations[0].metadata[0].namespace
      database  = "${var.supabase_db_host}:${var.supabase_db_port}/${var.supabase_db_name}"
    } : { enabled = false }

    components_v2 = var.run_components_v2_migrations ? {
      enabled   = true
      job_name  = kubernetes_job.components_v2_migrations[0].metadata[0].name
      namespace = kubernetes_job.components_v2_migrations[0].metadata[0].namespace
      database  = "${var.components_v2_db_host}:${var.components_v2_db_port}/${var.components_v2_db_name}"
    } : { enabled = false }
  }
}

# Helpful commands output
output "helpful_commands" {
  description = "Useful kubectl commands for checking migration status"
  value = {
    list_jobs = "kubectl get jobs -n ${var.namespace} -l app.kubernetes.io/component=migrations"
    list_pods = "kubectl get pods -n ${var.namespace} -l app.kubernetes.io/component=migrations"

    control_plane_logs = var.run_control_plane_migrations ? "kubectl logs -n ${kubernetes_job.control_plane_migrations[0].metadata[0].namespace} -l job-name=${kubernetes_job.control_plane_migrations[0].metadata[0].name}" : "N/A"
    supabase_logs      = var.run_supabase_migrations ? "kubectl logs -n ${kubernetes_job.supabase_migrations[0].metadata[0].namespace} -l job-name=${kubernetes_job.supabase_migrations[0].metadata[0].name}" : "N/A"
    components_v2_logs = var.run_components_v2_migrations ? "kubectl logs -n ${kubernetes_job.components_v2_migrations[0].metadata[0].namespace} -l job-name=${kubernetes_job.components_v2_migrations[0].metadata[0].name}" : "N/A"
  }
}
