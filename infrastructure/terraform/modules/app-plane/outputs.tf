# =============================================================================
# App Plane Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# RabbitMQ Outputs
# -----------------------------------------------------------------------------

output "rabbitmq_broker_id" {
  description = "RabbitMQ broker ID"
  value       = aws_mq_broker.rabbitmq.id
}

output "rabbitmq_broker_arn" {
  description = "RabbitMQ broker ARN"
  value       = aws_mq_broker.rabbitmq.arn
}

output "rabbitmq_endpoint" {
  description = "RabbitMQ AMQP endpoint"
  value       = aws_mq_broker.rabbitmq.instances[0].endpoints[0]
}

output "rabbitmq_console_url" {
  description = "RabbitMQ management console URL"
  value       = aws_mq_broker.rabbitmq.instances[0].console_url
}

output "rabbitmq_username" {
  description = "RabbitMQ admin username"
  value       = "admin"
}

output "rabbitmq_password" {
  description = "RabbitMQ admin password"
  value       = random_password.rabbitmq.result
  sensitive   = true
}

output "rabbitmq_security_group_id" {
  description = "Security group ID for RabbitMQ"
  value       = aws_security_group.rabbitmq.id
}

# -----------------------------------------------------------------------------
# S3 Bucket Outputs
# -----------------------------------------------------------------------------

output "s3_bom_bucket_name" {
  description = "S3 bucket name for BOM storage"
  value       = aws_s3_bucket.bom.id
}

output "s3_bom_bucket_arn" {
  description = "S3 bucket ARN for BOM storage"
  value       = aws_s3_bucket.bom.arn
}

output "s3_assets_bucket_name" {
  description = "S3 bucket name for assets"
  value       = aws_s3_bucket.assets.id
}

output "s3_assets_bucket_arn" {
  description = "S3 bucket ARN for assets"
  value       = aws_s3_bucket.assets.arn
}

output "s3_exports_bucket_name" {
  description = "S3 bucket name for exports"
  value       = aws_s3_bucket.exports.id
}

output "s3_exports_bucket_arn" {
  description = "S3 bucket ARN for exports"
  value       = aws_s3_bucket.exports.arn
}

output "s3_access_policy_arn" {
  description = "IAM policy ARN for S3 access"
  value       = aws_iam_policy.s3_access.arn
}

# -----------------------------------------------------------------------------
# CloudFront Outputs
# -----------------------------------------------------------------------------

output "cloudfront_oai_arn" {
  description = "CloudFront Origin Access Identity ARN"
  value       = var.enable_cloudfront ? aws_cloudfront_origin_access_identity.assets[0].iam_arn : null
}

# -----------------------------------------------------------------------------
# SQS Outputs (if enabled)
# -----------------------------------------------------------------------------

output "sqs_enrichment_queue_url" {
  description = "SQS enrichment queue URL"
  value       = var.use_sqs_instead_of_rabbitmq ? aws_sqs_queue.enrichment[0].url : null
}

output "sqs_enrichment_queue_arn" {
  description = "SQS enrichment queue ARN"
  value       = var.use_sqs_instead_of_rabbitmq ? aws_sqs_queue.enrichment[0].arn : null
}

output "sqs_enrichment_dlq_url" {
  description = "SQS enrichment DLQ URL"
  value       = var.use_sqs_instead_of_rabbitmq ? aws_sqs_queue.enrichment_dlq[0].url : null
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups
# -----------------------------------------------------------------------------

output "log_group_cns_service" {
  description = "CloudWatch log group name for CNS service"
  value       = aws_cloudwatch_log_group.cns_service.name
}

output "log_group_enrichment_worker" {
  description = "CloudWatch log group name for enrichment worker"
  value       = aws_cloudwatch_log_group.enrichment_worker.name
}
