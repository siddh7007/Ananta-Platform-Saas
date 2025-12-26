# WAF Module Outputs

output "web_acl_id" {
  description = "The ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.id
}

output "web_acl_arn" {
  description = "The ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "web_acl_name" {
  description = "The name of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.name
}

output "web_acl_capacity" {
  description = "The capacity units used by the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.capacity
}

output "ip_set_id" {
  description = "The ID of the blocked IP set (if created)"
  value       = length(aws_wafv2_ip_set.blocked) > 0 ? aws_wafv2_ip_set.blocked[0].id : null
}

output "ip_set_arn" {
  description = "The ARN of the blocked IP set (if created)"
  value       = length(aws_wafv2_ip_set.blocked) > 0 ? aws_wafv2_ip_set.blocked[0].arn : null
}

output "log_group_name" {
  description = "The name of the CloudWatch log group for WAF logs (if enabled)"
  value       = var.enable_logging ? aws_cloudwatch_log_group.waf[0].name : null
}

output "log_group_arn" {
  description = "The ARN of the CloudWatch log group for WAF logs (if enabled)"
  value       = var.enable_logging ? aws_cloudwatch_log_group.waf[0].arn : null
}

output "alarm_arns" {
  description = "Map of CloudWatch alarm names to their ARNs"
  value = var.enable_alarms ? {
    blocked_requests_high = aws_cloudwatch_metric_alarm.blocked_requests_high[0].arn
    rate_limit_exceeded   = aws_cloudwatch_metric_alarm.rate_limit_exceeded[0].arn
  } : {}
}

output "association_id" {
  description = "The ID of the WAF Web ACL association with the ALB"
  value       = aws_wafv2_web_acl_association.main.id
}

# Operational outputs

output "rate_limit_configured" {
  description = "The configured rate limit per IP per 5 minutes"
  value       = var.rate_limit
}

output "blocked_ip_count" {
  description = "Number of IPs in the blocked IP set"
  value       = length(var.blocked_ip_addresses)
}

output "logging_enabled" {
  description = "Whether WAF logging is enabled"
  value       = var.enable_logging
}

output "alarms_enabled" {
  description = "Whether CloudWatch alarms are enabled"
  value       = var.enable_alarms
}

# Metrics and monitoring

output "cloudwatch_metrics" {
  description = "List of CloudWatch metric names for WAF monitoring"
  value = {
    web_acl             = "${var.name_prefix}-waf"
    common_rules        = "${var.name_prefix}-common-rules"
    bad_inputs          = "${var.name_prefix}-bad-inputs"
    sqli                = "${var.name_prefix}-sqli"
    rate_limit          = "${var.name_prefix}-rate-limit"
    ip_reputation       = "${var.name_prefix}-ip-reputation"
    anonymous_ip        = "${var.name_prefix}-anonymous-ip"
    blocked_ips         = length(var.blocked_ip_addresses) > 0 ? "${var.name_prefix}-blocked-ips" : null
  }
}

output "dashboard_url" {
  description = "URL to view WAF metrics in CloudWatch console"
  value       = "https://console.aws.amazon.com/wafv2/homev2/web-acl/${aws_wafv2_web_acl.main.name}/${aws_wafv2_web_acl.main.id}/metrics?region=${data.aws_region.current.name}"
}

# Security posture summary

output "security_features" {
  description = "Summary of enabled WAF security features"
  value = {
    managed_rule_sets = [
      "AWSManagedRulesCommonRuleSet",
      "AWSManagedRulesKnownBadInputsRuleSet",
      "AWSManagedRulesSQLiRuleSet",
      "AWSManagedRulesAmazonIpReputationList",
      "AWSManagedRulesAnonymousIpList"
    ]
    rate_limiting_enabled = true
    ip_blocking_enabled   = length(var.blocked_ip_addresses) > 0
    logging_enabled       = var.enable_logging
    alarms_enabled        = var.enable_alarms
  }
}
