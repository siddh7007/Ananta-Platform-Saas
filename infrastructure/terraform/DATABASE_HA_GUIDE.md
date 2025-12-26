# Database High Availability Guide

## Overview

This guide covers the high availability (HA) and connection pooling enhancements for RDS PostgreSQL databases in the Ananta Platform infrastructure. These features ensure 99.99% uptime, sub-second query performance, and efficient connection management.

## Architecture Components

### 1. Read Replicas

Read replicas provide horizontal scaling for read-heavy workloads and serve as hot standbys for disaster recovery.

**Benefits:**
- Offload read queries from primary database
- Geographic distribution for low-latency reads
- Zero-downtime disaster recovery
- Minimal replication lag (typically < 1 second)

**Configuration:**
```hcl
# Enable read replicas
control_plane_db_create_read_replica = true
control_plane_db_replica_count       = 2
control_plane_db_replica_instance_class = "db.r6g.large"
```

**Replication Flow:**
```
Primary DB (writes)
    ├─> Replica 1 (reads)
    └─> Replica 2 (reads)
```

### 2. RDS Proxy (Connection Pooling)

RDS Proxy manages database connections efficiently, reducing connection overhead and improving application scalability.

**Benefits:**
- Connection pooling reduces connection establishment time
- Maintains persistent connections to the database
- Graceful failover during maintenance or failures
- Reduces database CPU/memory usage from connections
- Supports IAM authentication integration

**Configuration:**
```hcl
# Enable RDS Proxy
control_plane_db_create_rds_proxy = true
```

**Connection Flow:**
```
Applications → RDS Proxy → Database
   (many)      (pooled)    (few persistent)
```

### 3. Multi-AZ Deployment

Multi-AZ provides automatic failover to a standby instance in a different availability zone.

**Benefits:**
- Automatic failover (60-120 seconds)
- Zero data loss (synchronous replication)
- Maintenance without downtime
- Protection against AZ failures

**Configuration:**
```hcl
control_plane_db_multi_az = true
```

## Database Module Enhancements

### New Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `create_read_replica` | bool | false | Enable read replica creation |
| `replica_count` | number | 1 | Number of read replicas (0-5) |
| `replica_instance_class` | string | null | Instance class for replicas (defaults to primary) |
| `create_rds_proxy` | bool | false | Enable RDS Proxy for connection pooling |
| `db_credentials_secret_arn` | string | null | Secrets Manager ARN (required for RDS Proxy) |
| `proxy_idle_client_timeout` | number | 1800 | Idle timeout in seconds |
| `proxy_max_connections_percent` | number | 100 | Max % of DB connections |
| `proxy_max_idle_connections_percent` | number | 50 | Max % of idle connections |
| `proxy_require_tls` | bool | true | Require TLS for proxy connections |
| `performance_insights_enabled` | bool | true | Enable Performance Insights |
| `performance_insights_retention_period` | number | 7 | Insights retention in days |
| `monitoring_interval` | number | 60 | Enhanced monitoring interval (seconds) |

### New Outputs

| Output | Description |
|--------|-------------|
| `replica_endpoints` | List of read replica endpoints |
| `replica_addresses` | List of replica hostnames |
| `replica_ids` | List of replica instance IDs |
| `proxy_endpoint` | RDS Proxy endpoint (if enabled) |
| `proxy_arn` | RDS Proxy ARN |
| `proxy_id` | RDS Proxy ID |

## Environment-Specific Configurations

### Production (High Availability)

```hcl
# environments/prod.tfvars

# Multi-AZ deployment
control_plane_db_multi_az = true
app_plane_db_multi_az     = true

# Read Replicas (2 per database for HA)
control_plane_db_create_read_replica    = true
control_plane_db_replica_count          = 2
control_plane_db_replica_instance_class = "db.r6g.large"

app_plane_db_create_read_replica    = true
app_plane_db_replica_count          = 2
app_plane_db_replica_instance_class = "db.r6g.large"

# RDS Proxy for connection pooling
control_plane_db_create_rds_proxy = true
app_plane_db_create_rds_proxy     = true

# Extended backup retention
control_plane_db_backup_retention_period = 30
```

**Expected Availability:** 99.99% (52 minutes downtime/year)

### Staging (Cost-Optimized HA)

```hcl
# environments/staging.tfvars

# Multi-AZ for production-like testing
control_plane_db_multi_az = true
app_plane_db_multi_az     = true

# Single read replica for testing
control_plane_db_create_read_replica = true
control_plane_db_replica_count       = 1

# RDS Proxy enabled for testing
control_plane_db_create_rds_proxy = true

# Standard backup retention
control_plane_db_backup_retention_period = 7
```

### Development (Minimal Resources)

```hcl
# environments/dev.tfvars

# Single-AZ deployment
control_plane_db_multi_az = false
app_plane_db_multi_az     = false

# No read replicas or proxy
control_plane_db_create_read_replica = false
control_plane_db_create_rds_proxy    = false

# Minimal backup retention
control_plane_db_backup_retention_period = 3
```

## Application Integration

### Using RDS Proxy Endpoint

When RDS Proxy is enabled, applications should use the proxy endpoint instead of the direct database endpoint:

```javascript
// Read from environment variable or Secrets Manager
const dbHost = process.env.DB_PROXY_ENABLED === 'true'
  ? process.env.DB_PROXY_ENDPOINT
  : process.env.DB_ENDPOINT;

const connectionString = `postgresql://user:pass@${dbHost}:5432/dbname`;
```

**Terraform Output:**
```bash
# Get proxy endpoint
terraform output -json control_plane_db_proxy_endpoint

# Update application environment
DB_PROXY_ENDPOINT=$(terraform output -raw control_plane_db_proxy_endpoint)
```

### Read Replica Usage

For read-heavy operations, route SELECT queries to read replicas:

```javascript
// Primary (read/write)
const primaryDb = new Pool({
  host: process.env.DB_PRIMARY_ENDPOINT,
  // ...
});

// Read replica (read-only)
const replicaDb = new Pool({
  host: process.env.DB_REPLICA_ENDPOINT,
  // ...
});

// Write operations
await primaryDb.query('INSERT INTO ...');

// Read operations
const results = await replicaDb.query('SELECT * FROM ...');
```

**Terraform Output:**
```bash
# Get replica endpoints (JSON array)
terraform output -json control_plane_db_replica_endpoints

# Example output:
# [
#   "ananta-prod-control-plane-replica-1.abc123.us-east-1.rds.amazonaws.com:5432",
#   "ananta-prod-control-plane-replica-2.abc123.us-east-1.rds.amazonaws.com:5432"
# ]
```

## RDS Proxy IAM Configuration

RDS Proxy requires permissions to access Secrets Manager for database credentials:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:SECRET_NAME"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.REGION.amazonaws.com"
        }
      }
    }
  ]
}
```

This is automatically created by the database module when `create_rds_proxy = true`.

## Monitoring and Alerting

### CloudWatch Metrics

**Primary Database:**
- `CPUUtilization` - Target: < 80%
- `FreeStorageSpace` - Alert: < 5 GB
- `DatabaseConnections` - Alert: > 100
- `ReplicationLag` - Target: < 1000ms (for Multi-AZ)

**Read Replicas:**
- `ReplicaLag` - Target: < 5000ms (5 seconds)
- `CPUUtilization` - Target: < 70%
- `DatabaseConnections` - Monitor read distribution

**RDS Proxy:**
- `DatabaseConnectionsCurrentlyBorrowed` - Monitor connection usage
- `DatabaseConnectionsBorrowLatency` - Target: < 10ms
- `ClientConnections` - Total active client connections

### Performance Insights

Enabled by default on all databases:
- Query performance analysis
- Wait event monitoring
- Top SQL statements
- Database load tracking

Retention: 7 days (free tier), extendable to 2 years (paid)

## Disaster Recovery

### Failover Scenarios

| Scenario | Recovery Method | RTO | RPO |
|----------|----------------|-----|-----|
| Primary AZ failure | Automatic Multi-AZ failover | 60-120s | 0 |
| Database instance failure | Automatic Multi-AZ failover | 60-120s | 0 |
| Region failure | Promote read replica (manual) | 5-10min | < 5s |
| Data corruption | Point-in-time restore | 20-30min | Varies |

### Manual Read Replica Promotion

If primary fails in a single-AZ deployment:

```bash
# Identify replica to promote
aws rds describe-db-instances \
  --db-instance-identifier ananta-prod-control-plane-replica-1

# Promote replica to standalone
aws rds promote-read-replica \
  --db-instance-identifier ananta-prod-control-plane-replica-1

# Update application connection strings
# Point to newly promoted instance
```

**Note:** RDS Proxy automatically redirects to the new primary after promotion.

## Cost Optimization

### Production Environment (Estimated Monthly Costs)

**Control Plane Database:**
- Primary: db.r6g.large Multi-AZ = $365/month
- 2 Read Replicas: 2 × $182 = $364/month
- RDS Proxy: 2 vCPU × $0.015/hour = $22/month
- Storage (100GB): $23/month
- **Total: ~$774/month**

**App Plane Database:**
- Primary: db.r6g.large Multi-AZ = $365/month
- 2 Read Replicas: 2 × $182 = $364/month
- RDS Proxy: 2 vCPU × $0.015/hour = $22/month
- Storage (200GB): $46/month
- **Total: ~$797/month**

**Combined Database Infrastructure: ~$1,571/month**

### Cost Savings Strategies

1. **Development:** Disable Multi-AZ, replicas, and proxy (-80% cost)
2. **Staging:** Single replica, smaller instances (-50% cost)
3. **Reserved Instances:** 1-year commitment = 40% discount
4. **Auto-scaling storage:** Only pay for used capacity

## Maintenance Windows

### Recommended Settings

```hcl
# Production
backup_window      = "03:00-04:00"  # 3-4 AM UTC
maintenance_window = "Mon:04:00-Mon:05:00"  # Monday 4-5 AM UTC

# Development
backup_window      = "00:00-01:00"
maintenance_window = "Sat:00:00-Sat:01:00"
```

### Zero-Downtime Maintenance

With Multi-AZ + RDS Proxy:
1. RDS applies maintenance to standby
2. Performs failover to updated standby (< 60s)
3. Updates old primary (now standby)
4. RDS Proxy maintains connections throughout

## Troubleshooting

### High Replication Lag

**Symptoms:** `ReplicaLag` > 10 seconds

**Causes:**
- Heavy write load on primary
- Long-running transactions
- Network issues between AZs

**Solutions:**
1. Upgrade replica instance class
2. Optimize long-running queries
3. Reduce write load or add more replicas

### Connection Pooling Issues

**Symptoms:** Connection timeout errors with RDS Proxy

**Causes:**
- `max_connections_percent` too low
- Database max_connections limit reached
- Firewall/security group blocking proxy

**Solutions:**
1. Increase `proxy_max_connections_percent` to 100
2. Increase database `max_connections` parameter
3. Verify security group allows proxy traffic

### Failover Testing

Test Multi-AZ failover (non-production environments):

```bash
# Force failover
aws rds reboot-db-instance \
  --db-instance-identifier ananta-staging-control-plane-postgres \
  --force-failover

# Monitor failover progress
watch aws rds describe-db-instances \
  --db-instance-identifier ananta-staging-control-plane-postgres \
  --query 'DBInstances[0].DBInstanceStatus'
```

## Best Practices

1. **Always enable Multi-AZ in production** for automatic failover
2. **Use RDS Proxy** for high-connection workloads (> 100 connections)
3. **Deploy read replicas** in different AZs for geographic redundancy
4. **Monitor replication lag** - alert if > 5 seconds consistently
5. **Test failover** in staging before production deployment
6. **Use Performance Insights** to identify slow queries
7. **Set appropriate connection timeouts** (120s for RDS Proxy)
8. **Enable automated backups** with 30-day retention in production
9. **Use Secrets Manager rotation** for database credentials
10. **Tag all resources** for cost allocation and management

## Security Considerations

1. **TLS Encryption:** All connections (proxy and replicas) require TLS
2. **Security Groups:** Restrict database access to application subnets only
3. **Secrets Manager:** Database passwords stored encrypted
4. **KMS Encryption:** Storage encryption at rest with customer-managed keys
5. **Network Isolation:** Databases in private subnets, no public access
6. **IAM Policies:** RDS Proxy uses least-privilege IAM roles
7. **Audit Logging:** PostgreSQL query logging enabled (queries > 1s)

## Deployment Checklist

Before enabling HA features in production:

- [ ] Verify Secrets Manager contains database credentials
- [ ] Update application code to use proxy endpoint (if enabled)
- [ ] Configure read replica routing logic (if needed)
- [ ] Test connection pooling with expected load
- [ ] Set up CloudWatch alarms for all metrics
- [ ] Document failover procedures for on-call team
- [ ] Test manual replica promotion in staging
- [ ] Configure backup retention (30 days for prod)
- [ ] Enable Performance Insights
- [ ] Review estimated costs and get approval
- [ ] Schedule maintenance windows appropriately
- [ ] Create runbooks for common failure scenarios

## Migration Path

### Phase 1: Enable Multi-AZ (Zero Downtime)
```bash
terraform apply -var="control_plane_db_multi_az=true"
# RDS automatically provisions standby in different AZ
```

### Phase 2: Add Read Replicas (Zero Downtime)
```bash
terraform apply \
  -var="control_plane_db_create_read_replica=true" \
  -var="control_plane_db_replica_count=2"
# Replicas created from snapshot, then sync via replication
```

### Phase 3: Enable RDS Proxy (Minimal Downtime)
```bash
terraform apply -var="control_plane_db_create_rds_proxy=true"
# Update application connection strings to use proxy endpoint
# Deploy application with new connection string
```

**Total migration time:** ~30 minutes
**Application downtime:** < 1 minute (during connection string update)

## Support and References

- [AWS RDS Multi-AZ Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html)
- [AWS RDS Read Replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html)
- [AWS RDS Proxy Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
