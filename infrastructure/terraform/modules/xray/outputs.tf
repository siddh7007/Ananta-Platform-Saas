# =============================================================================
# X-Ray Module Outputs
# =============================================================================

output "xray_encryption_config_id" {
  description = "X-Ray encryption configuration ID"
  value       = aws_xray_encryption_config.main.id
}

output "xray_kms_key_id" {
  description = "KMS key ID for X-Ray encryption"
  value       = var.enable_kms_encryption ? (var.kms_key_id != "" ? var.kms_key_id : aws_kms_key.xray[0].id) : null
}

output "xray_kms_key_arn" {
  description = "KMS key ARN for X-Ray encryption"
  value       = var.enable_kms_encryption && var.kms_key_id == "" ? aws_kms_key.xray[0].arn : null
}

output "xray_write_policy_arn" {
  description = "IAM policy ARN for X-Ray write access"
  value       = aws_iam_policy.xray_write.arn
}

output "xray_groups" {
  description = "Map of X-Ray group names to IDs"
  value = {
    api_services       = aws_xray_group.api_services.id
    workflows          = aws_xray_group.workflows.id
    errors             = aws_xray_group.errors.id
    slow_requests      = aws_xray_group.slow_requests.id
    tenant_operations  = aws_xray_group.tenant_operations.id
  }
}

output "sampling_rules" {
  description = "Map of X-Ray sampling rule names to ARNs"
  value = {
    critical_apis  = aws_xray_sampling_rule.critical_apis.arn
    auth_apis      = aws_xray_sampling_rule.auth_apis.arn
    health_checks  = aws_xray_sampling_rule.health_checks.arn
    default        = aws_xray_sampling_rule.default.arn
  }
}

output "xray_console_urls" {
  description = "URLs for X-Ray console views"
  value = {
    service_map = "https://console.aws.amazon.com/xray/home?region=${data.aws_region.current.name}#/service-map"
    traces      = "https://console.aws.amazon.com/xray/home?region=${data.aws_region.current.name}#/traces"
    groups      = "https://console.aws.amazon.com/xray/home?region=${data.aws_region.current.name}#/groups"
  }
}
