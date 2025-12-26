# =============================================================================
# Monitoring Module Outputs
# =============================================================================

output "critical_alerts_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  value       = aws_sns_topic.critical_alerts.arn
}

output "warning_alerts_topic_arn" {
  description = "ARN of the warning alerts SNS topic"
  value       = aws_sns_topic.warning_alerts.arn
}

output "slo_violations_topic_arn" {
  description = "ARN of the SLO violations SNS topic"
  value       = aws_sns_topic.slo_violations.arn
}

output "infrastructure_alerts_topic_arn" {
  description = "ARN of the infrastructure alerts SNS topic"
  value       = aws_sns_topic.infrastructure_alerts.arn
}

output "pagerduty_lambda_arn" {
  description = "ARN of the PagerDuty forwarder Lambda function"
  value       = var.enable_pagerduty ? aws_lambda_function.pagerduty_forwarder[0].arn : null
}

output "slack_lambda_arn" {
  description = "ARN of the Slack forwarder Lambda function"
  value       = var.enable_slack ? aws_lambda_function.slack_forwarder[0].arn : null
}

output "cloudwatch_alarms" {
  description = "Map of CloudWatch alarm names and ARNs"
  value = merge(
    # RDS alarms
    var.control_plane_db_id != "" ? {
      "control-plane-db-cpu"         = aws_cloudwatch_metric_alarm.control_plane_db_cpu[0].arn
      "control-plane-db-storage"     = aws_cloudwatch_metric_alarm.control_plane_db_storage[0].arn
      "control-plane-db-connections" = aws_cloudwatch_metric_alarm.control_plane_db_connections[0].arn
    } : {},
    var.app_plane_db_id != "" ? {
      "app-plane-db-cpu" = aws_cloudwatch_metric_alarm.app_plane_db_cpu[0].arn
    } : {},
    # Redis alarms
    var.redis_cluster_id != "" ? {
      "redis-cpu"       = aws_cloudwatch_metric_alarm.redis_cpu[0].arn
      "redis-memory"    = aws_cloudwatch_metric_alarm.redis_memory[0].arn
      "redis-evictions" = aws_cloudwatch_metric_alarm.redis_evictions[0].arn
    } : {},
    # ECS alarms
    {
      for k, v in var.ecs_services :
      "${k}-cpu" => aws_cloudwatch_metric_alarm.ecs_cpu[k].arn
    },
    {
      for k, v in var.ecs_services :
      "${k}-memory" => aws_cloudwatch_metric_alarm.ecs_memory[k].arn
    }
  )
}
