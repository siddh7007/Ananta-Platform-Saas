# =============================================================================
# KMS Module Outputs
# =============================================================================

# RDS KMS Key
output "rds_kms_key_id" {
  description = "The ID of the RDS KMS key"
  value       = aws_kms_key.rds.key_id
}

output "rds_kms_key_arn" {
  description = "The ARN of the RDS KMS key"
  value       = aws_kms_key.rds.arn
}

# S3 KMS Key
output "s3_kms_key_id" {
  description = "The ID of the S3 KMS key"
  value       = aws_kms_key.s3.key_id
}

output "s3_kms_key_arn" {
  description = "The ARN of the S3 KMS key"
  value       = aws_kms_key.s3.arn
}

# Secrets Manager KMS Key
output "secrets_kms_key_id" {
  description = "The ID of the Secrets Manager KMS key"
  value       = aws_kms_key.secrets.key_id
}

output "secrets_kms_key_arn" {
  description = "The ARN of the Secrets Manager KMS key"
  value       = aws_kms_key.secrets.arn
}

# CloudWatch Logs KMS Key
output "cloudwatch_kms_key_id" {
  description = "The ID of the CloudWatch Logs KMS key"
  value       = aws_kms_key.cloudwatch.key_id
}

output "cloudwatch_kms_key_arn" {
  description = "The ARN of the CloudWatch Logs KMS key"
  value       = aws_kms_key.cloudwatch.arn
}

# EBS KMS Key
output "ebs_kms_key_id" {
  description = "The ID of the EBS KMS key"
  value       = aws_kms_key.ebs.key_id
}

output "ebs_kms_key_arn" {
  description = "The ARN of the EBS KMS key"
  value       = aws_kms_key.ebs.arn
}

# Amazon MQ KMS Key
output "mq_kms_key_id" {
  description = "The ID of the Amazon MQ KMS key"
  value       = aws_kms_key.mq.key_id
}

output "mq_kms_key_arn" {
  description = "The ARN of the Amazon MQ KMS key"
  value       = aws_kms_key.mq.arn
}
