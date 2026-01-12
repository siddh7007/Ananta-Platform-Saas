# =============================================================================
# Infracost Cost Policy - Rego Rules
# =============================================================================
# OPA/Rego policies for enforcing cost governance
# =============================================================================

package infracost

# -----------------------------------------------------------------------------
# Default Deny
# -----------------------------------------------------------------------------
default allow = true

# -----------------------------------------------------------------------------
# Environment-Specific Budget Limits (Monthly USD)
# -----------------------------------------------------------------------------
budget_limits := {
    "dev": 500,
    "staging": 2000,
    "prod": 10000
}

# -----------------------------------------------------------------------------
# Resource Type Limits (Monthly USD)
# -----------------------------------------------------------------------------
resource_type_limits := {
    "aws_db_instance": 500,
    "aws_elasticache_replication_group": 200,
    "aws_nat_gateway": 100,
    "aws_ecs_service": 1000,
    "google_sql_database_instance": 500,
    "google_redis_instance": 200,
    "google_container_cluster": 2000
}

# -----------------------------------------------------------------------------
# Policy: Total Monthly Cost Limit
# -----------------------------------------------------------------------------
deny[msg] {
    project := input.projects[_]
    env_name := split(project.name, "-")[1]  # Extract environment from project name
    limit := budget_limits[env_name]
    project.breakdown
    monthly_cost := to_number(project.breakdown.totalMonthlyCost)
    monthly_cost > limit
    msg := sprintf(
        "Monthly cost of $%.2f for %s exceeds budget limit of $%d",
        [monthly_cost, project.name, limit]
    )
}

# -----------------------------------------------------------------------------
# Policy: Individual Resource Type Limits
# -----------------------------------------------------------------------------
deny[msg] {
    resource := input.projects[_].breakdown.resources[_]
    limit := resource_type_limits[resource.resourceType]
    cost := to_number(resource.monthlyCost)
    cost > limit
    msg := sprintf(
        "Resource %s of type %s costs $%.2f/month, exceeds limit of $%d",
        [resource.name, resource.resourceType, cost, limit]
    )
}

# -----------------------------------------------------------------------------
# Policy: No Expensive Instance Types in Dev
# -----------------------------------------------------------------------------
expensive_instance_types := {
    "db.r6g.xlarge", "db.r6g.2xlarge", "db.r6g.4xlarge",
    "db.m6g.xlarge", "db.m6g.2xlarge", "db.m6g.4xlarge",
    "cache.r6g.xlarge", "cache.r6g.2xlarge",
    "db-custom-16-65536", "db-custom-32-131072"
}

deny[msg] {
    project := input.projects[_]
    contains(project.name, "dev")
    resource := project.breakdown.resources[_]
    contains(resource.resourceType, "db_instance")
    resource.metadata
    instance_type := resource.metadata.instanceType
    expensive_instance_types[instance_type]
    msg := sprintf(
        "Dev environment should not use expensive instance type %s for %s",
        [instance_type, resource.name]
    )
}

# -----------------------------------------------------------------------------
# Policy: Require Reserved Instances in Production
# -----------------------------------------------------------------------------
warn[msg] {
    project := input.projects[_]
    contains(project.name, "prod")
    resource := project.breakdown.resources[_]
    resource.resourceType == "aws_db_instance"
    resource.metadata
    not resource.metadata.reservedInstance
    cost := to_number(resource.monthlyCost)
    cost > 200
    msg := sprintf(
        "Consider Reserved Instance for %s costing $%.2f/month in production",
        [resource.name, cost]
    )
}

# -----------------------------------------------------------------------------
# Policy: Warn on NAT Gateway Costs
# -----------------------------------------------------------------------------
warn[msg] {
    resource := input.projects[_].breakdown.resources[_]
    resource.resourceType == "aws_nat_gateway"
    cost := to_number(resource.monthlyCost)
    cost > 50
    msg := sprintf(
        "NAT Gateway %s costs $%.2f/month - consider NAT instances or VPC endpoints",
        [resource.name, cost]
    )
}

# -----------------------------------------------------------------------------
# Policy: Enforce Tagging
# -----------------------------------------------------------------------------
required_tags := ["Environment", "Project", "Owner", "CostCenter"]

deny[msg] {
    resource := input.projects[_].breakdown.resources[_]
    tag := required_tags[_]
    resource.tags
    not resource.tags[tag]
    resource.monthlyCost
    cost := to_number(resource.monthlyCost)
    cost > 10
    msg := sprintf(
        "Resource %s missing required tag: %s",
        [resource.name, tag]
    )
}

# -----------------------------------------------------------------------------
# Policy: Cost Increase Alert
# -----------------------------------------------------------------------------
cost_increase_threshold := 20  # 20% increase threshold

warn[msg] {
    project := input.projects[_]
    project.breakdown
    project.pastBreakdown
    current := to_number(project.breakdown.totalMonthlyCost)
    previous := to_number(project.pastBreakdown.totalMonthlyCost)
    previous > 0
    increase_pct := ((current - previous) / previous) * 100
    increase_pct > cost_increase_threshold
    msg := sprintf(
        "Cost for %s increased by %.1f%% (from $%.2f to $%.2f)",
        [project.name, increase_pct, previous, current]
    )
}

# -----------------------------------------------------------------------------
# Policy: Storage Cost Optimization
# -----------------------------------------------------------------------------
warn[msg] {
    project := input.projects[_]
    resource := project.breakdown.resources[_]
    resource.resourceType == "aws_s3_bucket"
    contains(project.name, "prod")
    some i
    resource.costComponents[i].name == "Standard storage"
    storage_cost := to_number(resource.costComponents[i].monthlyCost)
    storage_cost > 100
    msg := sprintf(
        "S3 bucket %s has high Standard storage cost ($%.2f) - consider Intelligent-Tiering",
        [resource.name, storage_cost]
    )
}

# -----------------------------------------------------------------------------
# Policy: Compute Right-Sizing
# -----------------------------------------------------------------------------
warn[msg] {
    resource := input.projects[_].breakdown.resources[_]
    resource.resourceType == "aws_ecs_service"
    resource.usageData
    cpu_hours := to_number(resource.usageData.monthly_cpu_hours)
    memory_gb_hours := to_number(resource.usageData.monthly_memory_gb_hours)
    cpu_hours > 0
    ratio := memory_gb_hours / cpu_hours
    ratio > 4  # More than 4GB per vCPU suggests memory-optimized might be better
    msg := sprintf(
        "ECS service %s has high memory/CPU ratio (%.1f) - verify instance sizing",
        [resource.name, ratio]
    )
}
