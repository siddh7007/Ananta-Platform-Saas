# AWS WAF v2 Web ACL for ALB Protection
# Provides comprehensive security controls including managed rule sets,
# rate limiting, and IP blocking capabilities

resource "aws_wafv2_web_acl" "main" {
  name        = "${var.name_prefix}-waf"
  description = "WAF for ${var.name_prefix} ALB - Provides DDoS protection, SQL injection prevention, and rate limiting"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Priority 0: Block specific IPs (if configured)
  dynamic "rule" {
    for_each = length(var.blocked_ip_addresses) > 0 ? [1] : []
    content {
      name     = "BlockedIPs"
      priority = 0

      action {
        block {
          custom_response {
            response_code = 403
          }
        }
      }

      statement {
        ip_set_reference_statement {
          arn = aws_wafv2_ip_set.blocked[0].arn
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name_prefix}-blocked-ips"
        sampled_requests_enabled   = true
      }
    }
  }

  # Priority 1: AWS Managed Rules - Common Rule Set
  # Protects against common threats like SQLi, XSS, and known vulnerabilities
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude specific rules if needed (example)
        # excluded_rule {
        #   name = "SizeRestrictions_BODY"
        # }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # Priority 2: AWS Managed Rules - Known Bad Inputs
  # Blocks requests with patterns known to be malicious
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # Priority 3: AWS Managed Rules - SQL Injection Protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-sqli"
      sampled_requests_enabled   = true
    }
  }

  # Priority 4: Rate Limiting Rule
  # Protects against DDoS and brute force attacks
  rule {
    name     = "RateLimitRule"
    priority = 4

    action {
      block {
        custom_response {
          response_code = 429
          custom_response_body_key = "rate_limit_response"
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit
        aggregate_key_type = "IP"

        # Optional: Apply rate limiting only to specific paths
        # scope_down_statement {
        #   byte_match_statement {
        #     positional_constraint = "STARTS_WITH"
        #     search_string         = "/api/"
        #     field_to_match {
        #       uri_path {}
        #     }
        #     text_transformation {
        #       priority = 0
        #       type     = "LOWERCASE"
        #     }
        #   }
        # }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # Priority 5: AWS Managed Rules - Amazon IP Reputation List
  # Blocks IPs with poor reputation based on Amazon threat intelligence
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 5

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  # Priority 6: AWS Managed Rules - Anonymous IP List
  # Blocks requests from VPNs, proxies, Tor nodes, and hosting providers
  rule {
    name     = "AWSManagedRulesAnonymousIpList"
    priority = 6

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-anonymous-ip"
      sampled_requests_enabled   = true
    }
  }

  # Custom response body for rate limiting
  custom_response_body {
    key          = "rate_limit_response"
    content      = "Too many requests. Please try again later."
    content_type = "TEXT_PLAIN"
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

# IP Set for blocked addresses
resource "aws_wafv2_ip_set" "blocked" {
  count              = length(var.blocked_ip_addresses) > 0 ? 1 : 0
  name               = "${var.name_prefix}-blocked-ips"
  description        = "Manually blocked IP addresses for ${var.name_prefix}"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = var.blocked_ip_addresses

  tags = var.tags
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# CloudWatch Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count                   = var.enable_logging ? 1 : 0
  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]
  resource_arn            = aws_wafv2_web_acl.main.arn

  # Optional: Filter logs to reduce costs
  # logging_filter {
  #   default_behavior = "KEEP"
  #
  #   filter {
  #     behavior = "DROP"
  #     condition {
  #       action_condition {
  #         action = "ALLOW"
  #       }
  #     }
  #     requirement = "MEETS_ANY"
  #   }
  # }

  # Redact sensitive fields from logs
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

# CloudWatch Log Group for WAF logs
resource "aws_cloudwatch_log_group" "waf" {
  count             = var.enable_logging ? 1 : 0
  name              = "aws-waf-logs-${var.name_prefix}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_id

  tags = merge(
    var.tags,
    {
      Name = "WAF Logs - ${var.name_prefix}"
    }
  )
}

# CloudWatch Alarms for monitoring WAF activity
resource "aws_cloudwatch_metric_alarm" "blocked_requests_high" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.name_prefix}-waf-blocked-requests-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = var.blocked_requests_threshold
  alarm_description   = "This metric monitors blocked requests by WAF"
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = data.aws_region.current.name
    Rule   = "ALL"
  }

  alarm_actions = var.alarm_actions

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rate_limit_exceeded" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.name_prefix}-waf-rate-limit-exceeded"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 60
  statistic           = "Sum"
  threshold           = var.rate_limit_threshold
  alarm_description   = "This metric monitors rate limiting blocks"
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = data.aws_region.current.name
    Rule   = "RateLimitRule"
  }

  alarm_actions = var.alarm_actions

  tags = var.tags
}

# Data source for current region
data "aws_region" "current" {}
