# =============================================================================
# AWS Secrets Module Outputs
# =============================================================================

output "secret_arns" {
  description = "Map of secret names to ARNs"
  value = merge(
    { for k, v in aws_secretsmanager_secret.secrets : k => v.arn },
    { for k, v in aws_secretsmanager_secret.database : "db/${k}" => v.arn },
    { for k, v in aws_secretsmanager_secret.generated : k => v.arn }
  )
}

output "secret_names" {
  description = "Map of secret keys to full secret names"
  value = merge(
    { for k, v in aws_secretsmanager_secret.secrets : k => v.name },
    { for k, v in aws_secretsmanager_secret.database : "db/${k}" => v.name },
    { for k, v in aws_secretsmanager_secret.generated : k => v.name }
  )
}

output "secret_ids" {
  description = "Map of secret keys to secret IDs"
  value = merge(
    { for k, v in aws_secretsmanager_secret.secrets : k => v.id },
    { for k, v in aws_secretsmanager_secret.database : "db/${k}" => v.id },
    { for k, v in aws_secretsmanager_secret.generated : k => v.id }
  )
}

output "database_secret_arns" {
  description = "Map of database secret names to ARNs"
  value       = { for k, v in aws_secretsmanager_secret.database : k => v.arn }
}

output "generated_secret_values" {
  description = "Map of generated secret values"
  value       = { for k, v in random_password.generated : k => v.result }
  sensitive   = true
}

output "secrets_access_policy_arn" {
  description = "ARN of the IAM policy for secrets access"
  value       = var.create_access_policy ? aws_iam_policy.secrets_read[0].arn : null
}

output "all_secret_arns" {
  description = "List of all secret ARNs"
  value = concat(
    [for s in aws_secretsmanager_secret.secrets : s.arn],
    [for s in aws_secretsmanager_secret.database : s.arn],
    [for s in aws_secretsmanager_secret.generated : s.arn]
  )
}

# Common interface outputs
output "resource_ids" {
  description = "Map of resource IDs for all secrets"
  value = merge(
    { for k, v in aws_secretsmanager_secret.secrets : k => v.id },
    { for k, v in aws_secretsmanager_secret.database : "db-${k}" => v.id },
    { for k, v in aws_secretsmanager_secret.generated : k => v.id }
  )
}

output "resource_arns" {
  description = "Map of resource ARNs for all secrets"
  value = merge(
    { for k, v in aws_secretsmanager_secret.secrets : k => v.arn },
    { for k, v in aws_secretsmanager_secret.database : "db-${k}" => v.arn },
    { for k, v in aws_secretsmanager_secret.generated : k => v.arn }
  )
}
