# Basic Example Variables

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
  default     = "waf-basic-example"
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS listener"
  type        = string
  # You'll need to provide this or create one using AWS ACM
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default = {
    Environment = "development"
    Example     = "waf-basic"
    ManagedBy   = "terraform"
  }
}
