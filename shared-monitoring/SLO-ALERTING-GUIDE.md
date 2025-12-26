# SLO & Alerting Implementation Guide

## Overview

This guide documents the complete Service Level Objective (SLO) tracking and alerting infrastructure for the Ananta Platform.

## Components

### 1. Prometheus SLO Recording Rules
**File**: `prometheus/alerts/slos.yml`

Tracks Service Level Indicators (SLIs) and calculates:
- **Availability SLO**: 99.9% uptime target
- **Latency SLO**: P95 < 500ms, P99 < 2s
- **Error Budget**: Remaining budget calculation
- **Burn Rate**: How fast we're consuming error budget

### 2. Critical Alert Rules
**File**: `prometheus/alerts/critical.yml`

High-priority alerts requiring immediate action:
- Service down (any service unavailable > 1 min)
- High error rate (> 1% for 5 min, > 5% for 2 min)
- Database issues (connection pool exhausted, replication lag)
- SLO violations (error budget burning fast)
- Infrastructure failures (Redis, RabbitMQ, disk space)

### 3. AlertManager Configuration
**Files**:
- `alertmanager/alertmanager.yml` - Development (webhook receivers)
- `alertmanager/alertmanager-production.yml` - Production (real receivers)

Features:
- **PagerDuty** integration for critical alerts
- **Slack** integration for warnings and team-specific alerts
- **Email** notifications via SMTP
- **Inhibition rules** to prevent alert spam
- **Routing logic** based on severity, plane, and service

### 4. Terraform Monitoring Module
**Location**: `infrastructure/terraform/modules/monitoring/`

AWS-native monitoring:
- **CloudWatch Alarms** for RDS, ElastiCache, ECS
- **SNS Topics** for different alert severities
- **Lambda Functions** for PagerDuty/Slack forwarding
- **KMS Encryption** for SNS topics

## SLO Definitions

### Availability SLO: 99.9%

| Metric | Target | Error Budget |
|--------|--------|--------------|
| Monthly uptime | 99.9% | 43.2 minutes |
| Weekly uptime | 99.9% | 10.08 minutes |
| Daily uptime | 99.9% | 1.44 minutes |

**Measured by**:
```promql
# Availability ratio (5-minute window)
sum(rate(http_requests_total{status!~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

### Latency SLO

| Percentile | Target | Description |
|------------|--------|-------------|
| P95 | < 500ms | 95% of requests under 500ms |
| P99 | < 2s | 99% of requests under 2 seconds |

**Measured by**:
```promql
# P95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

### Error Budget Policy

| Remaining Budget | Action Required |
|------------------|-----------------|
| > 50% | Normal operations, low risk deployments |
| 25-50% | Caution, review recent changes |
| 10-25% | Freeze non-critical deployments |
| < 10% | CRITICAL: Stop all deployments, focus on reliability |

**Burn Rate Alerts**:
- Burn rate > 14.4 for 1h AND > 6 for 6h = Budget exhausted in < 6 hours
- Burn rate > 6 for 6h AND > 3 for 24h = Budget exhausted in < 2 days

## Alert Severity Levels

### Critical (Page Immediately)
- **Response Time**: < 5 minutes
- **Escalation**: PagerDuty + Slack + Email
- **Examples**: Service down, database unreachable, error rate > 5%

### Warning (Review Soon)
- **Response Time**: < 30 minutes
- **Escalation**: Slack + Email
- **Examples**: High latency, memory usage > 85%, queue depth high

### Info (Track/Monitor)
- **Response Time**: Next business day
- **Escalation**: Slack
- **Examples**: Prometheus config reload, target missing

## Alert Routing

### By Severity
```
critical → PagerDuty + Slack (#critical-alerts) + Email
warning  → Slack (#platform-alerts) + Email
info     → Slack (#monitoring)
```

### By Plane
```
Control Plane → #control-plane-alerts + control-plane-team@ananta.io
App Plane     → #app-plane-alerts + app-plane-team@ananta.io
```

### By Category
```
database       → #database-alerts + database-team@ananta.io
slo            → #slo-alerts + slo-team@ananta.io
infrastructure → #infrastructure-alerts + infra-team@ananta.io
```

## Setup Instructions

### 1. Configure Secrets

Create AlertManager secret files:

```bash
cd shared-monitoring/alertmanager/secrets

# PagerDuty
echo "your-integration-key" > pagerduty_key

# Slack webhooks
echo "https://hooks.slack.com/services/XXX" > slack_critical_webhook
echo "https://hooks.slack.com/services/YYY" > slack_warnings_webhook

# Set permissions
chmod 600 *
```

### 2. Configure Environment Variables

```bash
cd shared-monitoring
cp .env.example .env

# Edit .env with your SMTP settings
nano .env
```

Required variables:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=alerts@ananta.io
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

DEFAULT_EMAIL=oncall@ananta.io
```

### 3. Deploy Monitoring Stack

```bash
# Development (uses alertmanager.yml)
docker-compose up -d

# Production (uses alertmanager-production.yml)
# 1. Update docker-compose.yml to use alertmanager-production.yml
# 2. Ensure secrets are configured
docker-compose up -d
```

### 4. Deploy Terraform Monitoring (AWS)

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan (check what will be created)
terraform plan -var-file=environments/prod/terraform.tfvars

# Apply
terraform apply -var-file=environments/prod/terraform.tfvars
```

Required Terraform variables:
```hcl
# environments/prod/terraform.tfvars
enable_pagerduty = true
enable_slack     = true

pagerduty_integration_key = "your-key"  # Or use TF_VAR_
slack_webhook_url         = "your-url"

alert_email_addresses = [
  "oncall@ananta.io",
  "sre-team@ananta.io"
]
```

### 5. Verify Setup

```bash
# Check Prometheus loaded rules
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | .name'

# Expected output:
# - slo_availability
# - slo_latency
# - slo_error_budget
# - critical_service_down
# - critical_error_rate
# - critical_database
# - critical_slo_violations
# ...

# Check AlertManager config
docker exec shared-alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Send test alert
docker exec shared-alertmanager amtool alert add test \
  alertname=TestAlert severity=warning \
  --annotation=summary="Test alert" \
  --alertmanager.url=http://localhost:9093
```

### 6. Test Alert Flow

```bash
# Trigger a test CloudWatch alarm (AWS)
aws cloudwatch set-alarm-state \
  --alarm-name "ananta-dev-control-plane-db-cpu-high" \
  --state-value ALARM \
  --state-reason "Testing alert flow"

# Check:
# 1. SNS topic received message
# 2. Lambda function executed (check CloudWatch Logs)
# 3. PagerDuty/Slack received notification

# Resolve alarm
aws cloudwatch set-alarm-state \
  --alarm-name "ananta-dev-control-plane-db-cpu-high" \
  --state-value OK \
  --state-reason "Test complete"
```

## Monitoring the Monitors

### Prometheus Self-Monitoring

Check Prometheus is scraping targets:
```bash
# View targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# View rules evaluation
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | {name, interval}'
```

### AlertManager Health

```bash
# Check AlertManager status
curl http://localhost:9093/api/v1/status | jq .

# View active alerts
curl http://localhost:9093/api/v1/alerts | jq .

# Check silences
curl http://localhost:9093/api/v1/silences | jq .
```

### Grafana Dashboards

Access Grafana at http://localhost:3001

**Recommended dashboards**:
1. **Platform Overview** - High-level SLO metrics
2. **Error Budget** - Burn rate and remaining budget
3. **Service Health** - Per-service availability and latency
4. **Alert Dashboard** - Active/resolved alerts

## Runbooks

### Service Down Alert

**Alert**: `ServiceDown`

**Symptoms**: Service unreachable for > 1 minute

**Impact**: Users cannot access service

**Investigation**:
1. Check service logs: `docker logs <service-name>`
2. Check service status: `docker ps | grep <service-name>`
3. Check health endpoint: `curl http://service:port/health`
4. Check resource usage: CPU, memory, disk

**Resolution**:
1. Restart service: `docker restart <service-name>`
2. If restart fails, check for config issues
3. If persistent, rollback recent deployment
4. Page on-call if issue continues > 15 minutes

### High Error Rate Alert

**Alert**: `HighErrorRate` or `CriticalErrorRate`

**Symptoms**: > 1% or > 5% of requests returning 5xx errors

**Impact**: Users experiencing frequent errors

**Investigation**:
1. Check application logs for error stack traces
2. Check database connectivity
3. Check downstream service health
4. Review recent deployments (last 1 hour)

**Resolution**:
1. If caused by recent deployment, rollback
2. If database issue, check connection pool, slow queries
3. If downstream service issue, implement circuit breaker
4. Scale up if resource constrained

### Error Budget Burning Fast

**Alert**: `ErrorBudgetBurningFast`

**Symptoms**: Current error rate will exhaust monthly budget in < 6 hours

**Impact**: SLO breach imminent

**Investigation**:
1. Check current availability: Grafana → SLO Dashboard
2. Identify source of errors: Group by service, endpoint
3. Check recent changes (deployments, config, traffic)

**Resolution**:
1. IMMEDIATE: Stop all non-critical deployments
2. Investigate root cause of errors
3. If deployment-related, rollback
4. If traffic spike, scale resources
5. Communicate status to stakeholders

### Database Connection Pool Exhausted

**Alert**: `DatabaseConnectionPoolExhausted`

**Symptoms**: Database using > 90% of max connections

**Impact**: New connections will fail, service degraded

**Investigation**:
1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
2. Check for connection leaks: Long-running idle transactions
3. Check for slow queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '1 minute';`

**Resolution**:
1. Kill long-running queries: `SELECT pg_terminate_backend(pid);`
2. Restart services with connection leaks
3. Increase `max_connections` if consistently high usage
4. Review connection pooling configuration

## Dashboards & Visualizations

### SLO Dashboard (Grafana)

**Metrics to display**:
- Availability (current, 7-day, 30-day)
- Error budget remaining (gauge)
- Burn rate (current 1h, 6h, 24h)
- P95/P99 latency
- Request rate
- Error rate

**PromQL queries**:
```promql
# Availability (30-day)
avg_over_time(slo:control_plane:availability:ratio_1h[30d])

# Error budget remaining
slo:control_plane:error_budget:remaining

# Burn rate
slo:control_plane:error_budget:burn_rate_1h

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

### Alert Dashboard

Show:
- Active alerts (count by severity)
- Alert timeline (last 24h, 7d, 30d)
- Mean time to resolve (MTTR)
- Most frequent alerts

## Best Practices

### Alert Fatigue Prevention

1. **Use inhibition rules** - Don't alert on symptoms if root cause is known
2. **Set appropriate thresholds** - Too sensitive = noise, too loose = miss issues
3. **Group related alerts** - Batch notifications by service/plane
4. **Use repeat_interval** - Don't spam every minute

### SLO Management

1. **Review SLOs quarterly** - Adjust based on business needs
2. **Track error budget spend** - Understand what consumes budget
3. **Use error budget for decision-making** - Deploy vs. stabilize
4. **Document SLO violations** - Postmortem for each breach

### On-Call Readiness

1. **Test alert routing monthly** - Ensure PagerDuty/Slack work
2. **Keep runbooks updated** - Add steps as issues are resolved
3. **Practice incident response** - Game days, chaos engineering
4. **Review alert effectiveness** - Weekly SRE meetings

## Troubleshooting

### Prometheus Not Scraping

```bash
# Check targets
curl http://localhost:9090/api/v1/targets

# Common issues:
# - Service not reachable (network, DNS)
# - Metrics endpoint not exposed
# - Auth required but not configured
```

### AlertManager Not Sending Notifications

```bash
# Check AlertManager logs
docker logs shared-alertmanager

# Test receiver manually
amtool alert add test alertname=Test severity=critical --alertmanager.url=http://localhost:9093

# Common issues:
# - Secret files not mounted/readable
# - SMTP credentials incorrect
# - Slack webhook URL invalid
# - Inhibition rule suppressing alerts
```

### SLO Metrics Missing

```bash
# Check recording rules evaluation
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name | contains("slo"))'

# Common issues:
# - http_requests_total metric not exported
# - Histogram buckets not configured
# - Scrape interval too long
```

## References

- [Google SRE Book - SLO Chapter](https://sre.google/sre-book/service-level-objectives/)
- [Prometheus Alerting Best Practices](https://prometheus.io/docs/practices/alerting/)
- [PagerDuty Events API](https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview)
- [Multi-Window Multi-Burn-Rate Alerts](https://sre.google/workbook/alerting-on-slos/)
- [The Four Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/)

## Appendix: Alert Rule Reference

### SLO Recording Rules

| Rule | Description | Interval |
|------|-------------|----------|
| `slo:control_plane:availability:ratio_5m` | Control Plane availability (5m) | 30s |
| `slo:control_plane:availability:ratio_1h` | Control Plane availability (1h) | 30s |
| `slo:control_plane:error_budget:remaining` | Error budget remaining (30d) | 1m |
| `slo:control_plane:error_budget:burn_rate_1h` | Burn rate (1h window) | 1m |
| `slo:control_plane:latency:p95_ratio_5m` | P95 latency < 500ms | 30s |

### Critical Alert Rules

| Alert | Threshold | For | Severity |
|-------|-----------|-----|----------|
| `ServiceDown` | up == 0 | 1m | critical |
| `HighErrorRate` | error_rate > 1% | 5m | critical |
| `CriticalErrorRate` | error_rate > 5% | 2m | critical |
| `DatabaseConnectionPoolExhausted` | usage > 90% | 5m | critical |
| `ErrorBudgetBurningFast` | burn_rate > 14.4 (1h) & > 6 (6h) | 15m | critical |
| `RedisMemoryCritical` | memory > 95% | 5m | critical |

---

**Last Updated**: 2025-12-21
**Maintained By**: SRE Team
