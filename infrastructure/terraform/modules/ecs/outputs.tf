# =============================================================================
# ECS Module Outputs
# =============================================================================

output "cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks (passthrough from input)"
  value       = var.ecs_security_group_id
}

output "alb_security_group_id" {
  description = "Security group ID for ALB (passthrough from input)"
  value       = var.alb_security_group_id
}

output "alb_arn" {
  description = "Application Load Balancer ARN"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = aws_lb.main.zone_id
}

output "alb_https_listener_arn" {
  description = "ALB HTTPS listener ARN (for adding listener rules)"
  value       = length(aws_lb_listener.https) > 0 ? aws_lb_listener.https[0].arn : null
}

output "tenant_mgmt_service_name" {
  description = "Tenant management ECS service name"
  value       = aws_ecs_service.tenant_mgmt.name
}

output "tenant_mgmt_service_id" {
  description = "Tenant management ECS service ID"
  value       = aws_ecs_service.tenant_mgmt.id
}

output "cns_service_name" {
  description = "CNS ECS service name"
  value       = aws_ecs_service.cns_service.name
}

output "cns_service_id" {
  description = "CNS ECS service ID"
  value       = aws_ecs_service.cns_service.id
}

output "execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_execution.arn
}

output "task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "log_group_names" {
  description = "CloudWatch log group names"
  value = {
    ecs_exec        = aws_cloudwatch_log_group.ecs_exec.name
    tenant_mgmt     = aws_cloudwatch_log_group.tenant_mgmt.name
    cns_service     = aws_cloudwatch_log_group.cns_service.name
    temporal_worker = aws_cloudwatch_log_group.temporal_worker.name
    orchestrator    = aws_cloudwatch_log_group.orchestrator.name
    subscription    = aws_cloudwatch_log_group.subscription.name
    keycloak        = aws_cloudwatch_log_group.keycloak.name
    temporal        = aws_cloudwatch_log_group.temporal.name
    temporal_ui     = aws_cloudwatch_log_group.temporal_ui.name
    admin_app       = aws_cloudwatch_log_group.admin_app.name
    customer_portal = aws_cloudwatch_log_group.customer_portal.name
    cns_dashboard   = aws_cloudwatch_log_group.cns_dashboard.name
    novu            = aws_cloudwatch_log_group.novu.name
  }
}

output "prometheus_workspace_id" {
  description = "Amazon Managed Prometheus workspace ID (if enabled)"
  value       = null  # Placeholder - implement if using AMP
}

output "target_group_arns" {
  description = "ALB target group ARNs"
  value = {
    tenant_mgmt     = aws_lb_target_group.tenant_mgmt.arn
    cns_service     = aws_lb_target_group.cns_service.arn
    orchestrator    = aws_lb_target_group.orchestrator.arn
    subscription    = aws_lb_target_group.subscription.arn
    keycloak        = aws_lb_target_group.keycloak.arn
    temporal_ui     = aws_lb_target_group.temporal_ui.arn
    admin_app       = aws_lb_target_group.admin_app.arn
    customer_portal = aws_lb_target_group.customer_portal.arn
    cns_dashboard   = aws_lb_target_group.cns_dashboard.arn
    novu            = aws_lb_target_group.novu.arn
  }
}

# -----------------------------------------------------------------------------
# All Services Outputs
# -----------------------------------------------------------------------------

output "service_names" {
  description = "ECS service names"
  value = {
    tenant_mgmt     = aws_ecs_service.tenant_mgmt.name
    cns_service     = aws_ecs_service.cns_service.name
    temporal_worker = aws_ecs_service.temporal_worker.name
    orchestrator    = aws_ecs_service.orchestrator.name
    subscription    = aws_ecs_service.subscription.name
    keycloak        = aws_ecs_service.keycloak.name
    temporal        = aws_ecs_service.temporal.name
    temporal_ui     = aws_ecs_service.temporal_ui.name
    admin_app       = aws_ecs_service.admin_app.name
    customer_portal = aws_ecs_service.customer_portal.name
    cns_dashboard   = aws_ecs_service.cns_dashboard.name
    novu            = aws_ecs_service.novu.name
  }
}

output "service_arns" {
  description = "ECS service ARNs"
  value = {
    tenant_mgmt     = aws_ecs_service.tenant_mgmt.id
    cns_service     = aws_ecs_service.cns_service.id
    temporal_worker = aws_ecs_service.temporal_worker.id
    orchestrator    = aws_ecs_service.orchestrator.id
    subscription    = aws_ecs_service.subscription.id
    keycloak        = aws_ecs_service.keycloak.id
    temporal        = aws_ecs_service.temporal.id
    temporal_ui     = aws_ecs_service.temporal_ui.id
    admin_app       = aws_ecs_service.admin_app.id
    customer_portal = aws_ecs_service.customer_portal.id
    cns_dashboard   = aws_ecs_service.cns_dashboard.id
    novu            = aws_ecs_service.novu.id
  }
}

output "task_definition_arns" {
  description = "ECS task definition ARNs"
  value = {
    tenant_mgmt     = aws_ecs_task_definition.tenant_mgmt.arn
    cns_service     = aws_ecs_task_definition.cns_service.arn
    temporal_worker = aws_ecs_task_definition.temporal_worker.arn
    orchestrator    = aws_ecs_task_definition.orchestrator.arn
    subscription    = aws_ecs_task_definition.subscription.arn
    keycloak        = aws_ecs_task_definition.keycloak.arn
    temporal        = aws_ecs_task_definition.temporal.arn
    temporal_ui     = aws_ecs_task_definition.temporal_ui.arn
    admin_app       = aws_ecs_task_definition.admin_app.arn
    customer_portal = aws_ecs_task_definition.customer_portal.arn
    cns_dashboard   = aws_ecs_task_definition.cns_dashboard.arn
    novu            = aws_ecs_task_definition.novu.arn
  }
}

output "service_urls" {
  description = "Service URLs (ALB DNS-based)"
  value = {
    alb_url         = "https://${aws_lb.main.dns_name}"
    tenant_mgmt     = "https://${aws_lb.main.dns_name}/api"
    cns_service     = "https://${aws_lb.main.dns_name}/cns"
    orchestrator    = "https://${aws_lb.main.dns_name}/orchestrator"
    subscription    = "https://${aws_lb.main.dns_name}/subscription"
    keycloak        = "https://${aws_lb.main.dns_name}/auth"
    temporal_ui     = "https://${aws_lb.main.dns_name}/temporal"
    novu            = "https://${aws_lb.main.dns_name}/novu"
    admin_app       = "https://admin.${var.domain_name}"
    customer_portal = "https://app.${var.domain_name}"
    cns_dashboard   = "https://cns.${var.domain_name}"
  }
}
