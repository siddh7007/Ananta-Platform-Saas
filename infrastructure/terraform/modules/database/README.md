# Database Module - RDS PostgreSQL with HA

Production-ready RDS PostgreSQL module with built-in support for:
- Multi-AZ deployment for automatic failover
- Read replicas for horizontal scaling
- RDS Proxy for connection pooling
- Performance Insights and enhanced monitoring
- Automated backups with point-in-time recovery

## Features

### High Availability

1. **Multi-AZ Deployment**
   - Automatic failover to standby in different AZ
   - Synchronous replication (zero data loss)
   - 60-120 second failover time
   - Transparent to applications

2. **Read Replicas**
   - Asynchronous replication from primary
   - Support for up to 5 replicas
   - Cross-AZ deployment for redundancy
   - Read scaling for heavy workloads
   - Hot standby for disaster recovery

3. **RDS Proxy (Connection Pooling)**
   - Efficient connection management
   - Reduced database overhead
   - Graceful failover handling
   - IAM authentication support
   - Up to 100% connection pooling

### Monitoring & Performance

- Performance Insights (7-day retention)
- Enhanced monitoring (60-second intervals)
- CloudWatch alarms (CPU, storage, connections)
- Automated query logging (queries > 1 second)
- PostgreSQL statistics tracking

### Security

- TLS encryption in transit (required)
- KMS encryption at rest
- Private subnet deployment
- Security group isolation
- Secrets Manager integration
- IAM role-based access

## Usage

### Basic Production Setup

```hcl
module "database" {
  source = "./modules/database"

  name_prefix         = "myapp-prod"
  environment         = "prod"
  vpc_id              = module.network.vpc_id
  database_subnet_ids = module.network.database_subnet_ids
  security_group_id   = aws_security_group.rds.id

  # Database configuration
  database_name       = "myapp"
  engine_version      = "15.4"
  instance_class      = "db.r6g.large"
  allocated_storage   = 100
  max_allocated_storage = 500

  # High availability
  multi_az            = true
  backup_retention_period = 30
  deletion_protection = true

  # AWS region for KMS/IAM
  aws_region = "us-east-1"

  tags = {
    Environment = "prod"
    Project     = "myapp"
  }
}
```

### With Read Replicas

```hcl
module "database" {
  source = "./modules/database"

  # ... basic configuration ...

  # Read replicas for scaling
  create_read_replica      = true
  replica_count            = 2
  replica_instance_class   = "db.r6g.large"  # Optional: defaults to primary class

  # Enhanced monitoring
  performance_insights_enabled = true
  monitoring_interval          = 60
}
```

### With RDS Proxy (Connection Pooling)

```hcl
module "database" {
  source = "./modules/database"

  # ... basic configuration ...

  # RDS Proxy for connection pooling
  create_rds_proxy              = true
  db_credentials_secret_arn     = aws_secretsmanager_secret.db_creds.arn
  proxy_max_connections_percent = 100
  proxy_max_idle_connections_percent = 50
  proxy_require_tls             = true
  proxy_idle_client_timeout     = 1800  # 30 minutes
}
```

### Full Production Configuration

```hcl
module "control_plane_database" {
  source = "./modules/database"

  name_prefix         = "myapp-prod-control"
  environment         = "prod"
  vpc_id              = module.network.vpc_id
  database_subnet_ids = module.network.database_subnet_ids
  security_group_id   = module.security_groups.rds_sg_id

  # Database
  database_name         = "control_plane"
  engine_version        = "15.4"
  instance_class        = "db.r6g.large"
  allocated_storage     = 100
  max_allocated_storage = 500

  # High availability
  multi_az                = true
  backup_retention_period = 30
  deletion_protection     = true
  skip_final_snapshot     = false

  # Read replicas (2 for redundancy)
  create_read_replica    = true
  replica_count          = 2
  replica_instance_class = "db.r6g.large"

  # Connection pooling
  create_rds_proxy          = true
  db_credentials_secret_arn = module.secrets.control_plane_db_secret_arn
  aws_region                = "us-east-1"

  # Performance monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60

  tags = {
    Environment = "prod"
    Project     = "myapp"
    Criticality = "high"
  }
}
```

## Inputs

### Required Inputs

| Name | Type | Description |
|------|------|-------------|
| `name_prefix` | string | Prefix for resource names |
| `vpc_id` | string | VPC ID for deployment |
| `database_subnet_ids` | list(string) | Database subnet IDs (minimum 2 for Multi-AZ) |
| `security_group_id` | string | Security group ID for database access |
| `database_name` | string | Initial database name to create |

### Core Configuration

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `environment` | string | "dev" | Environment name (dev/staging/prod) |
| `engine_version` | string | "15.4" | PostgreSQL version |
| `instance_class` | string | "db.t3.medium" | RDS instance type |
| `allocated_storage` | number | 20 | Initial storage in GB |
| `max_allocated_storage` | number | 100 | Autoscaling limit in GB |
| `multi_az` | bool | false | Enable Multi-AZ deployment |
| `backup_retention_period` | number | 7 | Backup retention in days |
| `deletion_protection` | bool | true | Prevent accidental deletion |
| `skip_final_snapshot` | bool | false | Skip snapshot on deletion |
| `kms_key_id` | string | null | KMS key for encryption |

### High Availability - Read Replicas

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `create_read_replica` | bool | false | Enable read replica creation |
| `replica_count` | number | 1 | Number of replicas (0-5) |
| `replica_instance_class` | string | null | Replica instance class (defaults to primary) |

### Connection Pooling - RDS Proxy

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `create_rds_proxy` | bool | false | Enable RDS Proxy |
| `db_credentials_secret_arn` | string | null | Secrets Manager ARN (required for proxy) |
| `proxy_idle_client_timeout` | number | 1800 | Idle timeout in seconds |
| `proxy_max_connections_percent` | number | 100 | Max % of DB connections |
| `proxy_max_idle_connections_percent` | number | 50 | Max % of idle connections |
| `proxy_require_tls` | bool | true | Require TLS for connections |
| `aws_region` | string | "us-east-1" | AWS region (for IAM policies) |

### Monitoring

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `performance_insights_enabled` | bool | true | Enable Performance Insights |
| `performance_insights_retention_period` | number | 7 | Insights retention in days |
| `monitoring_interval` | number | 60 | Enhanced monitoring interval (0 to disable) |
| `alarm_sns_topic_arns` | list(string) | [] | SNS topics for CloudWatch alarms |

## Outputs

### Primary Database

| Name | Description |
|------|-------------|
| `endpoint` | Primary database endpoint (host:port) |
| `address` | Primary database hostname |
| `port` | Database port (5432) |
| `database_name` | Database name |
| `username` | Master username (sensitive) |
| `password` | Master password (sensitive) |
| `instance_id` | RDS instance ID |
| `instance_arn` | RDS instance ARN |
| `connection_string` | PostgreSQL connection string (sensitive) |

### Read Replicas

| Name | Description |
|------|-------------|
| `replica_endpoints` | List of replica endpoints |
| `replica_addresses` | List of replica hostnames |
| `replica_ids` | List of replica instance IDs |

### RDS Proxy

| Name | Description |
|------|-------------|
| `proxy_endpoint` | RDS Proxy endpoint (if enabled) |
| `proxy_arn` | RDS Proxy ARN |
| `proxy_id` | RDS Proxy ID |

### Other

| Name | Description |
|------|-------------|
| `parameter_group_name` | DB parameter group name |

## Connection Examples

### Using Primary Endpoint

```bash
# Direct connection to primary
psql "postgresql://postgres:PASSWORD@ananta-prod-postgres.abc123.us-east-1.rds.amazonaws.com:5432/mydb"
```

### Using RDS Proxy (Recommended)

```bash
# Connection via RDS Proxy
psql "postgresql://postgres:PASSWORD@ananta-prod-proxy.proxy-abc123.us-east-1.rds.amazonaws.com:5432/mydb"
```

### Using Read Replica

```bash
# Read-only connection to replica
psql "postgresql://postgres:PASSWORD@ananta-prod-replica-1.abc123.us-east-1.rds.amazonaws.com:5432/mydb"
```

### Application Code (Node.js)

```javascript
const { Pool } = require('pg');

// Primary connection (read/write)
const primaryPool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 20,  // Connection pool size
  idleTimeoutMillis: 30000,
});

// Replica connection (read-only)
const replicaPool = new Pool({
  host: process.env.DB_REPLICA_HOST,
  // ... same configuration
});

// Write operations
await primaryPool.query('INSERT INTO users ...');

// Read operations (use replica to offload primary)
const users = await replicaPool.query('SELECT * FROM users');
```

## Monitoring

### CloudWatch Alarms

The module creates three alarms by default:

1. **CPU Utilization** (> 80% for 15 minutes)
2. **Free Storage Space** (< 5 GB)
3. **Database Connections** (> 100)

### Performance Insights

Access via AWS Console:
1. Navigate to RDS → Databases → [your-database]
2. Click "Performance Insights" tab
3. View query performance, wait events, and top SQL

### Enhanced Monitoring

View OS-level metrics:
- CPU usage per process
- Memory usage
- Disk I/O
- Network throughput

Granularity: 60 seconds (configurable via `monitoring_interval`)

## Security Best Practices

1. **Never expose publicly**
   ```hcl
   publicly_accessible = false  # Always false
   ```

2. **Use Secrets Manager for credentials**
   ```hcl
   db_credentials_secret_arn = aws_secretsmanager_secret.db.arn
   ```

3. **Enable TLS for all connections**
   ```hcl
   proxy_require_tls = true
   ```

4. **Restrict security group access**
   ```hcl
   # Only allow from application subnets
   ingress {
     from_port   = 5432
     to_port     = 5432
     protocol    = "tcp"
     cidr_blocks = var.private_subnet_cidrs
   }
   ```

5. **Enable deletion protection in production**
   ```hcl
   deletion_protection = true
   skip_final_snapshot = false
   ```

## Cost Estimation

### Production Setup (us-east-1)

**Configuration:**
- Primary: db.r6g.large Multi-AZ
- 2 Read Replicas: db.r6g.large
- RDS Proxy: 2 vCPU
- Storage: 100GB gp3

**Monthly Cost:**
- Primary Multi-AZ: ~$365
- 2 Replicas: 2 × $182 = $364
- RDS Proxy: ~$22
- Storage: ~$23
- **Total: ~$774/month**

### Development Setup

**Configuration:**
- Primary: db.t3.micro Single-AZ
- No replicas
- No proxy
- Storage: 20GB gp3

**Monthly Cost:**
- Primary: ~$15
- Storage: ~$5
- **Total: ~$20/month**

## Disaster Recovery

### Automatic Failover (Multi-AZ)

- RTO: 60-120 seconds
- RPO: 0 (synchronous replication)
- No manual intervention required

### Read Replica Promotion

```bash
# Promote replica to standalone database
aws rds promote-read-replica \
  --db-instance-identifier ananta-prod-replica-1
```

- RTO: 5-10 minutes
- RPO: ~5 seconds (replication lag)

### Point-in-Time Recovery

```bash
# Restore to specific timestamp
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier ananta-prod-postgres \
  --target-db-instance-identifier ananta-prod-postgres-restored \
  --restore-time 2024-01-15T12:00:00Z
```

- RTO: 20-30 minutes
- RPO: 5 minutes (backup frequency)

## Troubleshooting

### High Replication Lag

**Check lag:**
```sql
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

**Solutions:**
- Upgrade replica instance class
- Reduce write load on primary
- Optimize long-running transactions

### Connection Limit Reached

**Check connections:**
```sql
SELECT count(*) FROM pg_stat_activity;
SELECT max_connections FROM pg_settings WHERE name = 'max_connections';
```

**Solutions:**
- Enable RDS Proxy for connection pooling
- Increase `max_connections` parameter
- Review application connection management

### Performance Issues

**Enable Performance Insights** and check:
1. Top SQL statements
2. Wait events
3. Database load

**Common optimizations:**
- Add missing indexes
- Optimize slow queries
- Increase instance size
- Add read replicas

## Migration Guide

### Enabling Multi-AZ

```bash
# Zero downtime
terraform apply -var="multi_az=true"
```

AWS automatically:
1. Provisions standby in different AZ
2. Syncs data from primary
3. Enables automatic failover

### Adding Read Replicas

```bash
terraform apply \
  -var="create_read_replica=true" \
  -var="replica_count=2"
```

Process:
1. Creates snapshot of primary
2. Restores snapshot to new instance
3. Enables replication
4. Catches up to primary

Time: ~30 minutes for 100GB database

### Enabling RDS Proxy

```bash
terraform apply -var="create_rds_proxy=true"
```

Then update application connection strings:
- Old: `postgres.abc123.us-east-1.rds.amazonaws.com`
- New: `proxy.abc123.proxy.us-east-1.rds.amazonaws.com`

Deploy with zero downtime using blue-green deployment.

## Additional Resources

- [Parent Documentation](../../DATABASE_HA_GUIDE.md) - Complete HA guide
- [AWS RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [PostgreSQL High Availability](https://www.postgresql.org/docs/current/high-availability.html)
- [RDS Proxy Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
