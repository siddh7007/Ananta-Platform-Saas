# =============================================================================
# CloudTrail Module Outputs
# =============================================================================

output "cloudtrail_id" {
  description = "The ID of the CloudTrail"
  value       = aws_cloudtrail.main.id
}

output "cloudtrail_arn" {
  description = "The ARN of the CloudTrail"
  value       = aws_cloudtrail.main.arn
}

output "s3_bucket_id" {
  description = "The ID of the CloudTrail S3 bucket"
  value       = aws_s3_bucket.cloudtrail.id
}

output "s3_bucket_arn" {
  description = "The ARN of the CloudTrail S3 bucket"
  value       = aws_s3_bucket.cloudtrail.arn
}

output "cloudwatch_log_group_name" {
  description = "The name of the CloudWatch Log Group for CloudTrail"
  value       = aws_cloudwatch_log_group.cloudtrail.name
}

output "cloudwatch_log_group_arn" {
  description = "The ARN of the CloudWatch Log Group for CloudTrail"
  value       = aws_cloudwatch_log_group.cloudtrail.arn
}

output "sns_topic_arn" {
  description = "The ARN of the SNS topic for CloudTrail notifications"
  value       = var.enable_sns_notifications ? aws_sns_topic.cloudtrail[0].arn : null
}
