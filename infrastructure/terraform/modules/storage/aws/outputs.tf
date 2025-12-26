# =============================================================================
# AWS Storage Module Outputs
# =============================================================================

output "bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.main.id
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.main.arn
}

output "bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = aws_s3_bucket.main.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "S3 bucket regional domain name"
  value       = aws_s3_bucket.main.bucket_regional_domain_name
}

output "endpoint" {
  description = "S3 endpoint URL"
  value       = "https://${aws_s3_bucket.main.bucket_regional_domain_name}"
}

output "resource_id" {
  description = "S3 bucket ID"
  value       = aws_s3_bucket.main.id
}

output "resource_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.main.arn
}

output "region" {
  description = "S3 bucket region"
  value       = aws_s3_bucket.main.region
}

output "versioning_enabled" {
  description = "Whether versioning is enabled"
  value       = var.versioning_enabled
}

output "encryption_enabled" {
  description = "Whether encryption is enabled"
  value       = var.encryption_enabled
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID for the bucket"
  value       = aws_s3_bucket.main.hosted_zone_id
}
