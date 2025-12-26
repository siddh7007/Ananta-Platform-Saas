# =============================================================================
# Network Module Outputs
# =============================================================================

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = aws_subnet.database[*].id
}

output "db_subnet_group_name" {
  description = "Name of the database subnet group"
  value       = aws_db_subnet_group.database.name
}

output "cache_subnet_group_name" {
  description = "Name of the ElastiCache subnet group"
  value       = aws_elasticache_subnet_group.cache.name
}

output "nat_gateway_ips" {
  description = "List of NAT Gateway public IPs"
  value       = aws_eip.nat[*].public_ip
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "IDs of the private route tables"
  value       = aws_route_table.private[*].id
}

# =============================================================================
# VPC Endpoint Outputs
# =============================================================================

output "vpc_endpoint_s3_id" {
  description = "ID of the S3 VPC endpoint (Gateway endpoint for free S3 access)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.s3[0].id : null
}

output "vpc_endpoint_dynamodb_id" {
  description = "ID of the DynamoDB VPC endpoint (Gateway endpoint for free DynamoDB access)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.dynamodb[0].id : null
}

output "vpc_endpoint_ecr_api_id" {
  description = "ID of the ECR API VPC endpoint (Interface endpoint for container registry)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.ecr_api[0].id : null
}

output "vpc_endpoint_ecr_dkr_id" {
  description = "ID of the ECR DKR VPC endpoint (Interface endpoint for Docker operations)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.ecr_dkr[0].id : null
}

output "vpc_endpoint_secretsmanager_id" {
  description = "ID of the Secrets Manager VPC endpoint (Interface endpoint for secrets)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.secretsmanager[0].id : null
}

output "vpc_endpoint_logs_id" {
  description = "ID of the CloudWatch Logs VPC endpoint (Interface endpoint for logging)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.logs[0].id : null
}

output "vpc_endpoint_ssm_id" {
  description = "ID of the SSM VPC endpoint (Interface endpoint for Systems Manager)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.ssm[0].id : null
}

output "vpc_endpoint_ssmmessages_id" {
  description = "ID of the SSM Messages VPC endpoint (Interface endpoint for Session Manager)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.ssmmessages[0].id : null
}

output "vpc_endpoint_ec2messages_id" {
  description = "ID of the EC2 Messages VPC endpoint (Interface endpoint for SSM agent)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.ec2messages[0].id : null
}

output "vpc_endpoint_sts_id" {
  description = "ID of the STS VPC endpoint (Interface endpoint for IAM role assumption)"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.sts[0].id : null
}

output "vpc_endpoint_security_group_id" {
  description = "Security group ID for VPC interface endpoints"
  value       = var.enable_vpc_endpoints ? aws_security_group.vpc_endpoints[0].id : null
}
