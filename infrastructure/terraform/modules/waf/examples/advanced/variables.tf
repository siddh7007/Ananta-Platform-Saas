# Advanced Example Variables

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
  default     = "waf-advanced-example"
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS listener"
  type        = string
  # Provide via terraform.tfvars or create using AWS ACM
}

variable "alert_email" {
  description = "Email address for security alerts"
  type        = string
  # Provide via terraform.tfvars
}

variable "blocked_ip_addresses" {
  description = "List of IP addresses or CIDR blocks to block"
  type        = list(string)
  default     = []
  # Example:
  # [
  #   "192.0.2.0/24",
  #   "198.51.100.42/32"
  # ]
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default = {
    Environment = "production"
    Example     = "waf-advanced"
    ManagedBy   = "terraform"
    CostCenter  = "security"
  }
}
