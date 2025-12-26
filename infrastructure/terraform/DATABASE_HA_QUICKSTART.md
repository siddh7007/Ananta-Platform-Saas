# Database HA Quick Start Guide

Quick reference for enabling and using RDS high availability features.

## Enable HA Features (Production)

### Step 1: Update tfvars

Edit `environments/prod.tfvars`:

```hcl
# Read Replicas (2 per database)
control_plane_db_create_read_replica    = true
control_plane_db_replica_count          = 2

app_plane_db_create_read_replica    = true
app_plane_db_replica_count          = 2

# RDS Proxy (Connection Pooling)
control_plane_db_create_rds_proxy = true
app_plane_db_create_rds_proxy     = true
```

### Step 2: Apply Changes

```bash
cd infrastructure/terraform
terraform plan -var-file="environments/prod.tfvars"
terraform apply -var-file="environments/prod.tfvars"
```

**Time:** ~30 minutes
**Downtime:** 0 minutes

## Get Connection Endpoints

### Primary Database
```bash
terraform output -raw control_plane_db_endpoint
# ananta-prod-control-plane-postgres.abc123.us-east-1.rds.amazonaws.com:5432
```

### RDS Proxy (Recommended)
```bash
terraform output -raw control_plane_db_proxy_endpoint
# ananta-prod-control-plane-proxy.proxy-abc123.us-east-1.rds.amazonaws.com:5432
```

### Read Replicas
```bash
terraform output -json control_plane_db_replica_endpoints
# [
#   "ananta-prod-control-plane-replica-1.abc123.us-east-1.rds.amazonaws.com:5432",
#   "ananta-prod-control-plane-replica-2.abc123.us-east-1.rds.amazonaws.com:5432"
# ]
```

## Application Configuration

### Environment Variables

```bash
# Use proxy endpoint for best performance
DB_HOST=ananta-prod-control-plane-proxy.proxy-abc123.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=arc_saas
DB_USER=postgres
DB_PASSWORD=<from-secrets-manager>

# Read replica (optional - for read scaling)
DB_REPLICA_HOST=ananta-prod-control-plane-replica-1.abc123.us-east-1.rds.amazonaws.com
```

### Connection String

**With Proxy (Recommended):**
```
postgresql://postgres:PASSWORD@proxy-endpoint.us-east-1.rds.amazonaws.com:5432/arc_saas
```

**Direct Primary:**
```
postgresql://postgres:PASSWORD@primary-endpoint.us-east-1.rds.amazonaws.com:5432/arc_saas
```

## Common Operations

### Check Replication Lag

```bash
# SSH into replica instance or use RDS console
psql -h replica-endpoint -U postgres -c \
  "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"

# Target: < 1 second
# Warning: > 5 seconds
# Critical: > 30 seconds
```

### Test Failover (Staging Only)

```bash
aws rds reboot-db-instance \
  --db-instance-identifier ananta-staging-control-plane-postgres \
  --force-failover

# Monitor failover
aws rds describe-db-instances \
  --db-instance-identifier ananta-staging-control-plane-postgres \
  --query 'DBInstances[0].DBInstanceStatus'
```

### Promote Read Replica (DR Scenario)

```bash
# Promote replica to standalone database
aws rds promote-read-replica \
  --db-instance-identifier ananta-prod-control-plane-replica-1

# Update application to point to new endpoint
```

### View Connection Stats

```bash
# Connect to database
psql -h proxy-endpoint -U postgres -d arc_saas

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check max connections limit
SELECT max_connections FROM pg_settings WHERE name = 'max_connections';

# View connection details
SELECT datname, usename, count(*)
FROM pg_stat_activity
GROUP BY datname, usename;
```

## Monitoring

### CloudWatch Metrics

```bash
# CPU Utilization (target: < 80%)
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=ananta-prod-control-plane-postgres \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T01:00:00Z \
  --period 300 \
  --statistics Average

# Database Connections
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=ananta-prod-control-plane-postgres \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T01:00:00Z \
  --period 300 \
  --statistics Average
```

### Performance Insights

```bash
# View top queries via AWS Console
# RDS → Databases → [your-db] → Performance Insights

# Or via CLI
aws pi describe-dimension-keys \
  --service-type RDS \
  --identifier db-ABC123XYZ \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T01:00:00Z \
  --metric db.load.avg \
  --group-by '{"Group":"db.sql"}'
```

## Troubleshooting

### High Connection Count

**Symptom:** Near max_connections limit

**Solution 1:** Enable RDS Proxy
```bash
terraform apply -var="control_plane_db_create_rds_proxy=true"
```

**Solution 2:** Increase max_connections parameter
```bash
aws rds modify-db-parameter-group \
  --db-parameter-group-name ananta-prod-pg15 \
  --parameters "ParameterName=max_connections,ParameterValue=500,ApplyMethod=pending-reboot"

aws rds reboot-db-instance \
  --db-instance-identifier ananta-prod-control-plane-postgres
```

### High Replication Lag

**Symptom:** Replica lag > 5 seconds

**Solution 1:** Upgrade replica instance
```bash
terraform apply -var="control_plane_db_replica_instance_class=db.r6g.xlarge"
```

**Solution 2:** Reduce write load
- Optimize long-running transactions
- Batch insert operations
- Add indexes to reduce update times

### Storage Full

**Symptom:** Free storage < 5 GB

**Solution:** Increase max_allocated_storage (autoscaling will handle it)
```bash
terraform apply -var="control_plane_db_max_allocated_storage=1000"
```

## Cost Estimates

| Configuration | Monthly Cost |
|---------------|--------------|
| **Development** (Single instance, no HA) | ~$20 |
| **Staging** (Multi-AZ, 1 replica) | ~$400 |
| **Production** (Multi-AZ, 2 replicas, proxy) | ~$774 per database |

## Feature Matrix

| Feature | Development | Staging | Production |
|---------|-------------|---------|------------|
| Multi-AZ | ❌ | ✅ | ✅ |
| Read Replicas | ❌ | 1 | 2 |
| RDS Proxy | ❌ | ✅ | ✅ |
| Backup Retention | 3 days | 7 days | 30 days |
| Performance Insights | ✅ | ✅ | ✅ |
| Enhanced Monitoring | ✅ | ✅ | ✅ |
| Deletion Protection | ❌ | ✅ | ✅ |

## Availability SLA

| Configuration | Availability | Downtime/Year |
|---------------|--------------|---------------|
| Single-AZ | 99.95% | ~4 hours |
| Multi-AZ | 99.99% | ~52 minutes |
| Multi-AZ + Replicas | 99.995% | ~26 minutes |

## Emergency Contacts

- **AWS Support:** https://console.aws.amazon.com/support
- **Database Team:** db-team@example.com
- **On-Call:** See PagerDuty rotation
- **Documentation:** See `DATABASE_HA_GUIDE.md` for detailed procedures

## Quick Links

- [Full HA Guide](./DATABASE_HA_GUIDE.md) - Comprehensive documentation
- [Module README](./modules/database/README.md) - Module-specific docs
- [AWS RDS Console](https://console.aws.amazon.com/rds/) - RDS dashboard
- [CloudWatch Console](https://console.aws.amazon.com/cloudwatch/) - Monitoring

## Version History

- **v1.0** (2025-12-21) - Initial HA implementation
  - Read replicas (up to 5)
  - RDS Proxy for connection pooling
  - Multi-AZ support
  - Performance Insights
  - Enhanced monitoring
