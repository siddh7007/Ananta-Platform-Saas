# WAF Module Variables

variable "name_prefix" {
  description = "Name prefix for WAF resources"
  type        = string

  validation {
    condition     = length(var.name_prefix) > 0 && length(var.name_prefix) <= 32
    error_message = "Name prefix must be between 1 and 32 characters"
  }
}

variable "alb_arn" {
  description = "ARN of the Application Load Balancer to associate with WAF"
  type        = string

  validation {
    condition     = can(regex("^arn:aws:elasticloadbalancing:", var.alb_arn))
    error_message = "Must be a valid ALB ARN"
  }
}

variable "rate_limit" {
  description = "Maximum number of requests allowed from a single IP within a 5-minute window"
  type        = number
  default     = 2000

  validation {
    condition     = var.rate_limit >= 100 && var.rate_limit <= 20000000
    error_message = "Rate limit must be between 100 and 20,000,000"
  }
}

variable "blocked_ip_addresses" {
  description = "List of IP addresses or CIDR blocks to block (e.g., ['192.0.2.0/24', '198.51.100.0/24'])"
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for ip in var.blocked_ip_addresses : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}(/[0-9]{1,2})?$", ip))
    ])
    error_message = "All IP addresses must be valid IPv4 addresses or CIDR blocks"
  }
}

variable "enable_logging" {
  description = "Enable CloudWatch logging for WAF"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain WAF logs in CloudWatch"
  type        = number
  default     = 30

  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180,
      365, 400, 545, 731, 1827, 3653
    ], var.log_retention_days)
    error_message = "Log retention must be a valid CloudWatch Logs retention period"
  }
}

variable "kms_key_id" {
  description = "KMS key ID for encrypting WAF logs (optional)"
  type        = string
  default     = null
}

variable "enable_alarms" {
  description = "Enable CloudWatch alarms for WAF metrics"
  type        = bool
  default     = true
}

variable "blocked_requests_threshold" {
  description = "Threshold for blocked requests alarm (total blocks in 5 minutes)"
  type        = number
  default     = 1000
}

variable "rate_limit_threshold" {
  description = "Threshold for rate limiting alarm (blocks per minute)"
  type        = number
  default     = 100
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarms trigger (e.g., SNS topic ARNs)"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to all WAF resources"
  type        = map(string)
  default     = {}
}

# Advanced configuration options

variable "enable_anonymous_ip_blocking" {
  description = "Enable blocking of anonymous IPs (VPNs, proxies, Tor)"
  type        = bool
  default     = true
}

variable "enable_ip_reputation_blocking" {
  description = "Enable blocking based on Amazon IP reputation list"
  type        = bool
  default     = true
}

variable "custom_rules" {
  description = "List of custom WAF rules to add"
  type = list(object({
    name     = string
    priority = number
    action   = string # "allow", "block", "count"
    statement = object({
      type = string # "byte_match", "geo_match", "ip_set", etc.
      # Add more fields as needed for specific statement types
    })
  }))
  default = []
}

variable "excluded_rules" {
  description = "Map of managed rule groups to their excluded rules"
  type = map(list(string))
  default = {}
  # Example:
  # {
  #   "AWSManagedRulesCommonRuleSet" = ["SizeRestrictions_BODY"]
  # }
}

variable "scope_down_statement_paths" {
  description = "List of URI paths to apply rate limiting (empty = all paths)"
  type        = list(string)
  default     = []
  # Example: ["/api/", "/login"]
}

variable "allowed_countries" {
  description = "List of country codes to allow (empty = allow all). Uses ISO 3166-1 alpha-2 codes"
  type        = list(string)
  default     = []
  # Example: ["US", "CA", "GB"]
}

variable "blocked_countries" {
  description = "List of country codes to block (empty = block none). Uses ISO 3166-1 alpha-2 codes"
  type        = list(string)
  default     = []
  # Example: ["CN", "RU", "KP"]
}
