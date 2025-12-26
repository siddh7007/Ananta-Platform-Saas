# Alerting Infrastructure & SLO Implementation - Complete Summary

## Executive Summary

A production-ready alerting infrastructure and SLO tracking system has been implemented for the Ananta Platform, providing comprehensive monitoring, error budget management, and multi-channel notifications.

**Status**: Ready for deployment
**Implementation Date**: 2025-12-21
**Total Files Created**: 20+ files across monitoring and infrastructure

## What Was Delivered

### 1. SLO Tracking System

**Service Level Objectives Defined**:
- Availability SLO: 99.9% uptime (43.2 min/month error budget)
- Latency SLO: P95 < 500ms, P99 < 2s
- Error budget tracking with burn rate calculation
- Multi-window alerting on SLO violations

**Implementation**: `shared-monitoring/prometheus/alerts/slos.yml`
- 25+ recording rules across 5 groups
- Real-time availability calculation
- Error budget consumption tracking
- Burn rate alerts (1h, 6h, 24h windows)

### 2. Critical Alert System

**Implementation**: `shared-monitoring/prometheus/alerts/critical.yml`
- 20+ critical alerts requiring immediate action
- Categories: Service availability, error rate, database, SLO violations, latency, infrastructure, deployments

**Key Alerts**:
- ServiceDown: Any service unavailable > 1 min
- HighErrorRate: > 1% errors for 5 min
- CriticalErrorRate: > 5% errors for 2 min
- DatabaseConnectionPoolExhausted: > 90% connections used
- ErrorBudgetBurningFast: Will exhaust in < 6 hours
- RedisMemoryCritical: > 95% memory usage
- DeploymentCausingErrors: Recent deployment causing issues

### 3. Production AlertManager Configuration

**Implementation**: `shared-monitoring/alertmanager/alertmanager-production.yml`

**Notification Channels**:
- **PagerDuty**: Critical alerts (pages on-call)
- **Slack**: 7 different channels for different teams/severities
  - #critical-alerts
  - #platform-alerts
  - #slo-alerts
  - #database-alerts
  - #control-plane-alerts
  - #app-plane-alerts
  - #infrastructure-alerts
- **Email**: Team-specific email notifications

**Features**:
- Intelligent routing by severity, plane, service, category
- Inhibition rules to prevent alert spam
- Customizable repeat intervals (1h for critical, 6h for warnings)
- Grouping to batch related alerts

### 4. Secrets Management

**Implementation**: `shared-monitoring/alertmanager/secrets/`

**Security Features**:
- Git-ignored directory for sensitive credentials
- File-based secrets mounted read-only into containers
- Example files for easy setup
- Comprehensive documentation

**Required Secrets**:
- PagerDuty integration key
- 7 Slack webhook URLs (one per channel)
- SMTP credentials (environment variables)

### 5. AWS CloudWatch Integration (Terraform)

**Implementation**: `infrastructure/terraform/modules/monitoring/`

**AWS Resources**:
- 4 SNS Topics (critical, warning, SLO, infrastructure)
- CloudWatch Alarms for RDS (CPU, storage, connections)
- CloudWatch Alarms for ElastiCache (CPU, memory, evictions)
- CloudWatch Alarms for ECS (per-service CPU, memory)
- 2 Lambda Functions (Python 3.11):
  - PagerDuty forwarder
  - Slack forwarder
- KMS encryption for SNS topics
- IAM roles with minimal permissions

**Cost**: ~$3-5/month (AWS native monitoring)

### 6. Comprehensive Documentation

**Files Created**:
- `SLO-ALERTING-GUIDE.md` - 500+ lines, complete operational guide
- `ALERTING-IMPLEMENTATION.md` - Implementation summary
- `ARCHITECTURE.md` - System architecture diagrams
- `alertmanager/secrets/README.md` - Secrets setup guide
- `infrastructure/terraform/modules/monitoring/README.md` - Terraform usage

**Runbooks**: Included for common alerts:
- Service Down
- High Error Rate
- Error Budget Burning Fast
- Database Connection Pool Exhausted

### 7. Validation Tooling

**Implementation**: `shared-monitoring/scripts/validate-alerting.sh`

**Validation Checks**:
- File existence (20+ files)
- YAML syntax validation
- Running service health checks
- Alert rule content verification
- Receiver configuration checks
- Secrets configuration validation
- Terraform module structure
- Environment variable checks

## File Structure

```
Ananta-Platform-Saas/
├── shared-monitoring/
│   ├── prometheus/
│   │   └── alerts/
│   │       ├── slos.yml                    [NEW] SLO recording rules
│   │       ├── critical.yml                [NEW] Critical alerts
│   │       └── ananta-platform.yml         [EXISTING]
│   ├── alertmanager/
│   │   ├── alertmanager.yml                [EXISTING] Dev config
│   │   ├── alertmanager-production.yml     [NEW] Production config
│   │   ├── templates/
│   │   │   └── ananta.tmpl                 [EXISTING]
│   │   └── secrets/                        [NEW DIRECTORY]
│   │       ├── .gitignore                  [NEW] Security
│   │       ├── README.md                   [NEW] Setup guide
│   │       ├── pagerduty_key.example       [NEW]
│   │       └── slack_critical_webhook.example [NEW]
│   ├── docker-compose.yml                  [MODIFIED] Added env vars & secrets mount
│   ├── .env.example                        [NEW] Environment template
│   ├── SLO-ALERTING-GUIDE.md              [NEW] Operational guide
│   ├── ALERTING-IMPLEMENTATION.md         [NEW] Implementation summary
│   ├── ARCHITECTURE.md                     [NEW] Architecture diagrams
│   └── scripts/
│       └── validate-alerting.sh           [NEW] Validation script
│
└── infrastructure/
    └── terraform/
        └── modules/
            └── monitoring/                 [NEW MODULE]
                ├── main.tf                 [NEW] SNS, CloudWatch, Lambda
                ├── variables.tf            [NEW] Module inputs
                ├── outputs.tf              [NEW] Module outputs
                ├── README.md               [NEW] Terraform docs
                └── lambda/
                    ├── pagerduty_forwarder.py [NEW] PagerDuty integration
                    └── slack_forwarder.py     [NEW] Slack integration
```

## Setup Instructions (Quick Start)

### Step 1: Configure Secrets

```bash
cd shared-monitoring/alertmanager/secrets

# PagerDuty
echo "your-pagerduty-integration-key" > pagerduty_key

# Slack webhooks
echo "https://hooks.slack.com/services/XXX/YYY/ZZZ" > slack_critical_webhook
echo "https://hooks.slack.com/services/AAA/BBB/CCC" > slack_warnings_webhook

# Set permissions
chmod 600 *
```

### Step 2: Configure Environment

```bash
cd shared-monitoring
cp .env.example .env

# Edit .env with your SMTP settings
# Required: SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USERNAME, SMTP_PASSWORD
# Required: DEFAULT_EMAIL, SLO_TEAM_EMAIL, DATABASE_TEAM_EMAIL, etc.
```

### Step 3: Deploy Monitoring Stack

```bash
# For development (uses alertmanager.yml)
docker-compose up -d

# For production (update docker-compose.yml to use alertmanager-production.yml)
# Then:
docker-compose up -d
```

### Step 4: Verify Setup

```bash
# Run validation script
cd shared-monitoring
./scripts/validate-alerting.sh

# Check Prometheus UI
open http://localhost:9090

# Check AlertManager UI
open http://localhost:9093

# Check Grafana
open http://localhost:3001
```

### Step 5: Deploy AWS Monitoring (Optional)

```bash
cd infrastructure/terraform

# Configure variables
export TF_VAR_pagerduty_key="your-key"
export TF_VAR_slack_webhook="your-webhook"

# Deploy
terraform init
terraform plan -var-file=environments/prod/terraform.tfvars
terraform apply
```

## Alert Flow

### Critical Alert Example

```
1. Service degrades (e.g., CNS service down)
2. Prometheus scrapes and detects: up{job="app-plane-cns-service"} == 0
3. After 1 minute, alert fires: ServiceDown (severity=critical)
4. AlertManager receives alert and routes based on rules:
   - severity=critical → PagerDuty + Slack #critical-alerts + Email
   - plane=app → Also Slack #app-plane-alerts + app-plane-team email
5. Notifications sent:
   - PagerDuty: Creates incident, pages on-call
   - Slack: Posts to #critical-alerts and #app-plane-alerts
   - Email: Sent to oncall@ananta.io and app-plane-team@ananta.io
6. On-call engineer receives page within 2-3 minutes
7. Engineer follows runbook, resolves issue
8. Service recovers, alert auto-resolves
```

### SLO Violation Example

```
1. Error rate spikes due to database issue
2. Prometheus calculates:
   - Availability drops from 99.95% to 99.5%
   - Burn rate jumps to 15x (threshold: 14.4x)
3. After 15 minutes, alert fires: ErrorBudgetBurningFast
4. AlertManager routes to:
   - PagerDuty (critical severity)
   - Slack #slo-alerts
   - Email to slo-team@ananta.io
5. SRE team responds:
   - Freezes non-critical deployments
   - Investigates root cause
   - Rolls back problematic change
6. Error rate normalizes, burn rate returns to normal
7. Alert resolves automatically
```

## Key Metrics

### SLO Metrics (Prometheus)

Query these via Grafana or Prometheus UI:

```promql
# Current availability (5-minute window)
slo:control_plane:availability:ratio_5m

# Error budget remaining (30-day rolling)
slo:control_plane:error_budget:remaining

# Current burn rate (1-hour window)
slo:control_plane:error_budget:burn_rate_1h

# P95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

### CloudWatch Alarms (AWS)

Per environment:
- 3 alarms per RDS database (CPU, storage, connections)
- 3 alarms per ElastiCache cluster (CPU, memory, evictions)
- 2 alarms per ECS service (CPU, memory)

Example: Production environment with 3 databases, 1 Redis, 5 ECS services:
- RDS: 3 databases × 3 alarms = 9 alarms
- ElastiCache: 1 cluster × 3 alarms = 3 alarms
- ECS: 5 services × 2 alarms = 10 alarms
- **Total: 22 CloudWatch alarms**

## Error Budget Policy

| Remaining Budget | Action Required |
|------------------|-----------------|
| > 50% | Normal operations |
| 25-50% | Review recent changes, increase monitoring |
| 10-25% | **Freeze non-critical deployments** |
| < 10% | **CRITICAL: Stop all deployments, focus on reliability** |

## Testing & Validation

### Send Test Alert

```bash
# Via AlertManager
docker exec shared-alertmanager amtool alert add test \
  alertname=TestAlert severity=critical \
  --annotation=summary="Production readiness test" \
  --alertmanager.url=http://localhost:9093

# Expected result: Alert appears in all configured channels
```

### Trigger CloudWatch Alarm

```bash
# Set alarm to ALARM state
aws cloudwatch set-alarm-state \
  --alarm-name "ananta-prod-control-plane-db-cpu-high" \
  --state-value ALARM \
  --state-reason "Testing alert flow"

# Expected result:
# 1. SNS message sent
# 2. Lambda function executes
# 3. Notification received in PagerDuty/Slack
```

### Validation Checklist

Run the validation script:

```bash
cd shared-monitoring
./scripts/validate-alerting.sh

# Expected output:
# - All critical checks pass
# - Warnings for optional components
# - Summary of results
```

## Troubleshooting

### Issue: Alerts not firing

**Diagnosis**:
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check alert rules
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | .name'

# Check AlertManager
curl http://localhost:9093/api/v1/alerts
```

**Solution**: Verify services are being scraped, rules are loaded

### Issue: PagerDuty not receiving alerts

**Diagnosis**:
```bash
# Check AlertManager logs
docker logs shared-alertmanager | grep -i pagerduty

# Verify secret file
docker exec shared-alertmanager cat /etc/alertmanager/secrets/pagerduty_key
```

**Solution**: Verify integration key is correct, test PagerDuty API manually

### Issue: Slack not receiving messages

**Diagnosis**:
```bash
# Test webhook manually
curl -X POST -H 'Content-Type: application/json' \
  -d '{"text":"Test from AlertManager"}' \
  $(cat alertmanager/secrets/slack_critical_webhook)
```

**Solution**: Verify webhook URL, check Slack app permissions

## Production Deployment Recommendations

### Phase 1: Development Environment (Week 1)
- [ ] Deploy monitoring stack to dev environment
- [ ] Configure test Slack channel (#dev-alerts)
- [ ] Test alert flow with manual triggers
- [ ] Tune alert thresholds based on dev traffic
- [ ] Create Grafana dashboards

### Phase 2: Staging Environment (Week 2-3)
- [ ] Deploy to staging with production-like config
- [ ] Configure staging Slack channels
- [ ] Set up test PagerDuty schedule
- [ ] Run chaos engineering tests
- [ ] Validate alert suppression (inhibition rules)
- [ ] Document any issues/refinements

### Phase 3: Production Deployment (Week 4)
- [ ] Configure production secrets (PagerDuty, Slack, SMTP)
- [ ] Deploy Terraform monitoring module to AWS
- [ ] Update docker-compose to use alertmanager-production.yml
- [ ] Set up production on-call rotation
- [ ] Send test alerts to verify flow
- [ ] Monitor for false positives (first 48 hours)
- [ ] Adjust thresholds if needed

### Phase 4: Operational Excellence (Ongoing)
- [ ] Weekly SLO review meetings
- [ ] Monthly alert quality review (reduce noise)
- [ ] Quarterly SLO target adjustment
- [ ] Continuous runbook improvements
- [ ] Regular chaos engineering exercises

## Success Criteria

### Week 1 (Development)
- ✓ All services exposing metrics
- ✓ Prometheus scraping successfully
- ✓ Alert rules loaded and evaluating
- ✓ Test alerts reaching Slack

### Week 4 (Production)
- ✓ Real-time SLO tracking visible in Grafana
- ✓ Critical alerts paging on-call via PagerDuty
- ✓ Team-specific alerts routing correctly
- ✓ Error budget policy enforced
- ✓ MTTR < 30 minutes for critical incidents

### Month 3 (Operational Maturity)
- ✓ SLO compliance > 99.9%
- ✓ Alert fatigue < 5 alerts/week (false positives)
- ✓ Runbooks for all critical alerts
- ✓ Automated remediation for common issues
- ✓ Chaos engineering tests passing

## References

- **Operational Guide**: `shared-monitoring/SLO-ALERTING-GUIDE.md`
- **Architecture**: `shared-monitoring/ARCHITECTURE.md`
- **Terraform Module**: `infrastructure/terraform/modules/monitoring/README.md`
- **Secrets Setup**: `shared-monitoring/alertmanager/secrets/README.md`

**External Resources**:
- [Google SRE Book - SLO Chapter](https://sre.google/sre-book/service-level-objectives/)
- [Multi-Window Multi-Burn-Rate Alerts](https://sre.google/workbook/alerting-on-slos/)
- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview)
- [Prometheus Alerting Best Practices](https://prometheus.io/docs/practices/alerting/)

## Support & Contact

**Implementation Team**: SRE Engineering Team
**Maintained By**: Platform SRE
**Last Updated**: 2025-12-21
**Version**: 1.0.0

For questions or issues:
1. Review documentation in `shared-monitoring/`
2. Check troubleshooting sections
3. Consult SRE team documentation
4. Escalate to platform team if unresolved

---

**Status**: Production-ready, pending deployment approval
**Next Action**: Configure production secrets and deploy to staging environment for validation
