# ElastiCache Module

> **DEPRECATED**: This module is deprecated in favor of the cloud-agnostic `cache/` module.
>
> Use `../cache/` for all new deployments. This module remains for backwards compatibility
> with existing AWS deployments but will be removed in a future release.

## Migration Guide

Replace usage of this module:

```hcl
# OLD (deprecated)
module "elasticache" {
  source = "./modules/elasticache"
  # ... AWS-specific configuration
}
```

With the cloud-agnostic `cache` module:

```hcl
# NEW (recommended)
module "cache" {
  source = "./modules/cache"

  cloud_provider = "aws"  # or "azure", "gcp", "kubernetes"

  # Common interface
  name_prefix    = var.name_prefix
  environment    = var.environment
  instance_size  = "medium"
  engine_version = "7.0"

  # AWS-specific configuration
  aws_config = {
    vpc_id            = module.network.vpc_id
    subnet_ids        = module.network.private_subnet_ids
    security_group_id = module.security_groups.redis_security_group_id
    # ... other AWS-specific options
  }
}
```

## Benefits of Migration

1. **Cloud Portability**: Same interface works across AWS, Azure, GCP, and Kubernetes
2. **Unified Outputs**: Consistent `endpoint`, `port`, `connection_string` outputs
3. **Future-Proof**: All new features added to `cache/` module only

## Original Purpose

This module provisions AWS ElastiCache Redis clusters with:
- Replication group configuration
- Subnet group management
- Parameter group customization
- Automatic failover support
- Encryption at rest and in transit
