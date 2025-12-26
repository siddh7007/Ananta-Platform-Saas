# =============================================================================
# Service Discovery Module Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names (e.g., 'ananta-dev')"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the private DNS namespace"
  type        = string
}

variable "services" {
  description = <<-EOT
    Map of HTTP service names to their configurations.
    These are services exposed via ALB with HTTP health checks.
  EOT
  type = map(object({
    port              = number
    health_check_path = optional(string)
  }))
  default = {}
}

variable "internal_services" {
  description = <<-EOT
    Map of internal service names to their configurations.
    These are services NOT exposed via ALB (e.g., Temporal gRPC, databases).
  EOT
  type = map(object({
    port     = number
    protocol = optional(string, "tcp")
  }))
  default = {}
}

variable "dns_ttl" {
  description = "TTL for DNS records in seconds (lower = faster failover)"
  type        = number
  default     = 10
}

variable "health_check_failure_threshold" {
  description = "Number of consecutive health check failures before marking unhealthy"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
