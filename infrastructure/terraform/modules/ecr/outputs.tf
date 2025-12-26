# =============================================================================
# ECR Module - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Control Plane Repository Outputs
# -----------------------------------------------------------------------------

output "control_plane_repository_urls" {
  description = "Map of control plane service names to ECR repository URLs"
  value = {
    for k, v in aws_ecr_repository.control_plane : k => v.repository_url
  }
}

output "control_plane_repository_arns" {
  description = "Map of control plane service names to ECR repository ARNs"
  value = {
    for k, v in aws_ecr_repository.control_plane : k => v.arn
  }
}

output "control_plane_repository_registry_ids" {
  description = "Map of control plane service names to ECR registry IDs"
  value = {
    for k, v in aws_ecr_repository.control_plane : k => v.registry_id
  }
}

output "control_plane_repository_names" {
  description = "List of control plane ECR repository names"
  value       = [for v in aws_ecr_repository.control_plane : v.name]
}

# -----------------------------------------------------------------------------
# App Plane Repository Outputs
# -----------------------------------------------------------------------------

output "app_plane_repository_urls" {
  description = "Map of app plane service names to ECR repository URLs"
  value = {
    for k, v in aws_ecr_repository.app_plane : k => v.repository_url
  }
}

output "app_plane_repository_arns" {
  description = "Map of app plane service names to ECR repository ARNs"
  value = {
    for k, v in aws_ecr_repository.app_plane : k => v.arn
  }
}

output "app_plane_repository_registry_ids" {
  description = "Map of app plane service names to ECR registry IDs"
  value = {
    for k, v in aws_ecr_repository.app_plane : k => v.registry_id
  }
}

output "app_plane_repository_names" {
  description = "List of app plane ECR repository names"
  value       = [for v in aws_ecr_repository.app_plane : v.name]
}

# -----------------------------------------------------------------------------
# Combined Outputs
# -----------------------------------------------------------------------------

output "all_repository_urls" {
  description = "Map of all service names to ECR repository URLs"
  value = merge(
    { for k, v in aws_ecr_repository.control_plane : k => v.repository_url },
    { for k, v in aws_ecr_repository.app_plane : k => v.repository_url }
  )
}

output "all_repository_arns" {
  description = "Map of all service names to ECR repository ARNs"
  value = merge(
    { for k, v in aws_ecr_repository.control_plane : k => v.arn },
    { for k, v in aws_ecr_repository.app_plane : k => v.arn }
  )
}

output "all_repository_names" {
  description = "List of all ECR repository names"
  value = concat(
    [for v in aws_ecr_repository.control_plane : v.name],
    [for v in aws_ecr_repository.app_plane : v.name]
  )
}

# -----------------------------------------------------------------------------
# Registry Information
# -----------------------------------------------------------------------------

output "registry_id" {
  description = "ECR registry ID (AWS account ID)"
  value       = data.aws_caller_identity.current.account_id
}

output "registry_url" {
  description = "Base ECR registry URL"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

# -----------------------------------------------------------------------------
# SSM Parameter Outputs
# -----------------------------------------------------------------------------

output "control_plane_ssm_parameters" {
  description = "Map of SSM parameter names for control plane image URIs"
  value = {
    for k, v in aws_ssm_parameter.control_plane_image_uris : k => v.name
  }
}

output "app_plane_ssm_parameters" {
  description = "Map of SSM parameter names for app plane image URIs"
  value = {
    for k, v in aws_ssm_parameter.app_plane_image_uris : k => v.name
  }
}

# -----------------------------------------------------------------------------
# Replication Configuration
# -----------------------------------------------------------------------------

output "replication_enabled" {
  description = "Whether ECR replication is enabled"
  value       = var.enable_replication
}

output "replication_destination" {
  description = "Replication destination region (if enabled)"
  value       = var.enable_replication ? var.replication_region : null
}

# -----------------------------------------------------------------------------
# Security Configuration
# -----------------------------------------------------------------------------

output "scan_on_push_enabled" {
  description = "Whether image scanning on push is enabled"
  value       = var.scan_on_push
}

output "encryption_type" {
  description = "Encryption type used for repositories"
  value       = var.encryption_type
}

output "kms_key_arn" {
  description = "KMS key ARN used for encryption (if KMS encryption is enabled)"
  value       = var.encryption_type == "KMS" ? var.kms_key_arn : null
}

# -----------------------------------------------------------------------------
# Lifecycle Policy Configuration
# -----------------------------------------------------------------------------

output "lifecycle_policy_summary" {
  description = "Summary of lifecycle policy configuration"
  value = {
    keep_tagged_images    = var.keep_tagged_images_count
    keep_dev_images       = var.keep_dev_images_count
    untagged_image_days   = var.untagged_image_days
    keep_any_images_count = var.keep_any_images_count
  }
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "vulnerability_alarms_enabled" {
  description = "Whether vulnerability alarms are enabled"
  value       = var.enable_vulnerability_alarms
}

output "critical_vulnerability_threshold" {
  description = "Threshold for critical vulnerability alarms"
  value       = var.critical_vulnerability_threshold
}

output "alarm_sns_topics" {
  description = "SNS topic ARNs for vulnerability alarms"
  value       = var.alarm_sns_topic_arns
}

# -----------------------------------------------------------------------------
# Formatted Output for CI/CD Integration
# -----------------------------------------------------------------------------

output "cicd_repository_map" {
  description = "Formatted map for CI/CD tools (service -> full image URI template)"
  value = {
    for service, url in merge(
      { for k, v in aws_ecr_repository.control_plane : k => v.repository_url },
      { for k, v in aws_ecr_repository.app_plane : k => v.repository_url }
    ) : service => "${url}:latest"
  }
}

output "docker_login_command" {
  description = "AWS CLI command to authenticate Docker with ECR"
  value       = "aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

# -----------------------------------------------------------------------------
# Terraform Output for Other Modules
# -----------------------------------------------------------------------------

output "ecr_module_config" {
  description = "Configuration summary for use by other Terraform modules"
  value = {
    registry_id            = data.aws_caller_identity.current.account_id
    registry_url           = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
    region                 = data.aws_region.current.name
    environment            = var.environment
    control_plane_services = var.control_plane_services
    app_plane_services     = var.app_plane_services
  }
}
