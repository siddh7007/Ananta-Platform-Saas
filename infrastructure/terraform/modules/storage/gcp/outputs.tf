# =============================================================================
# GCP Storage Module Outputs
# =============================================================================

output "bucket_name" {
  description = "Bucket name"
  value       = google_storage_bucket.main.name
}

output "bucket_arn" {
  description = "Bucket self link (ARN equivalent)"
  value       = google_storage_bucket.main.self_link
}

output "endpoint" {
  description = "Bucket URL"
  value       = google_storage_bucket.main.url
}

output "resource_id" {
  description = "Bucket ID"
  value       = google_storage_bucket.main.id
}

output "resource_arn" {
  description = "Bucket self link"
  value       = google_storage_bucket.main.self_link
}

# GCP-specific outputs

output "url" {
  description = "Bucket URL (gs://bucket-name)"
  value       = google_storage_bucket.main.url
}

output "self_link" {
  description = "Bucket self link"
  value       = google_storage_bucket.main.self_link
}

output "project" {
  description = "GCP project ID"
  value       = var.project_id
}

output "location" {
  description = "Bucket location"
  value       = google_storage_bucket.main.location
}

output "storage_class" {
  description = "Storage class"
  value       = google_storage_bucket.main.storage_class
}

output "versioning_enabled" {
  description = "Whether versioning is enabled"
  value       = var.versioning_enabled
}

output "public_access_prevention" {
  description = "Public access prevention status"
  value       = google_storage_bucket.main.public_access_prevention
}

output "uniform_bucket_level_access" {
  description = "Whether uniform bucket-level access is enabled"
  value       = google_storage_bucket.main.uniform_bucket_level_access
}
