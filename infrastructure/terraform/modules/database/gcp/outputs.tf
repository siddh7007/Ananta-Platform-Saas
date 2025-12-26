# =============================================================================
# GCP Cloud SQL Module Outputs
# =============================================================================

output "endpoint" {
  description = "Database endpoint (host:port)"
  value       = "${google_sql_database_instance.main.private_ip_address}:5432"
}

output "address" {
  description = "Database hostname (private IP)"
  value       = google_sql_database_instance.main.private_ip_address
}

output "port" {
  description = "Database port"
  value       = 5432
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.main.name
}

output "username" {
  description = "Master username"
  value       = google_sql_user.master.name
  sensitive   = true
}

output "password" {
  description = "Master password"
  value       = random_password.master.result
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${google_sql_user.master.name}:${random_password.master.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.main.name}?sslmode=require"
  sensitive   = true
}

output "replica_endpoints" {
  description = "Read replica endpoints"
  value       = [for r in google_sql_database_instance.replica : "${r.private_ip_address}:5432"]
}

output "pooler_endpoint" {
  description = "Connection pooler endpoint"
  value       = null # Cloud SQL doesn't have built-in pooler, use Cloud SQL Proxy
}

output "resource_id" {
  description = "Instance ID"
  value       = google_sql_database_instance.main.id
}

output "resource_arn" {
  description = "Instance connection name (GCP equivalent of ARN)"
  value       = google_sql_database_instance.main.connection_name
}

# GCP-specific outputs
output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "connection_name" {
  description = "Connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.main.connection_name
}

output "self_link" {
  description = "Self link of the instance"
  value       = google_sql_database_instance.main.self_link
}

output "public_ip_address" {
  description = "Public IP address (if enabled)"
  value       = google_sql_database_instance.main.public_ip_address
}

output "private_ip_address" {
  description = "Private IP address"
  value       = google_sql_database_instance.main.private_ip_address
}

output "secret_id" {
  description = "Secret Manager secret ID for credentials"
  value       = var.create_secret ? google_secret_manager_secret.db_credentials[0].secret_id : null
}

output "replica_connection_names" {
  description = "Connection names for read replicas"
  value       = [for r in google_sql_database_instance.replica : r.connection_name]
}
