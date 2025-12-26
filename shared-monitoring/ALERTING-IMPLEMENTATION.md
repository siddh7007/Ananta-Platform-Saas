# Alerting Infrastructure Implementation Summary

## What Was Implemented

This implementation adds comprehensive SLO tracking, critical alerting, and production-ready notification infrastructure to the Ananta Platform.

## Files Created/Modified

### 1. Prometheus Alert Rules

#### `prometheus/alerts/slos.yml` (NEW)
**Purpose**: Service Level Objective (SLO) tracking and error budget calculation

**Key Metrics**:
- Availability SLO: 99.9% uptime target
- Latency SLO: P95 < 500ms, P99 < 2s
- Error budget remaining (30-day rolling)
- Burn rate calculation (1h, 6h windows)

**Recording Rules Count**: 25+ rules across 5 groups

#### `prometheus/alerts/critical.yml` (NEW)
**Purpose**: Critical alerts requiring immediate action

**Alert Categories**:
- Service availability (ServiceDown, MultipleServicesDown)
- Error rate (HighErrorRate, CriticalErrorRate)
- Database (ConnectionPoolExhausted, DatabaseDown, ReplicationLag)
- SLO violations (ErrorBudgetBurningFast, ErrorBudgetCriticallyLow)
- Latency (ExtremelyHighLatency)
- Infrastructure (RedisDown, RabbitMQDown, DiskSpaceCritical)
- Deployment (DeploymentCausingErrors)

**Alert Count**: 20+ critical alerts

### 2. AlertManager Configuration

#### `alertmanager/alertmanager-production.yml` (NEW)
**Purpose**: Production-ready AlertManager config with real notification receivers

**Features**:
- **PagerDuty integration** for critical alerts (via routing_key_file)
- **Slack integrations** for 7 different channels:
  - #critical-alerts (critical severity)
  - #platform-alerts (warnings)
  - #slo-alerts (SLO violations)
  - #database-alerts (database team)
  - #control-plane-alerts (control plane team)
  - #app-plane-alerts (app plane team)
  - #infrastructure-alerts (infra team)
- **Email notifications** via SMTP (configurable per team)
- **Inhibition rules** to prevent alert spam
- **Sophisticated routing** by severity, plane, service, category

#### `alertmanager/secrets/` (NEW DIRECTORY)
Secret files for notification credentials:
- `pagerduty_key` - PagerDuty integration key
- `slack_critical_webhook` - Slack critical channel webhook
- `slack_warnings_webhook` - Slack warnings channel webhook
- `slack_slo_webhook` - SLO team webhook
- `slack_database_webhook` - Database team webhook
- `slack_control_plane_webhook` - Control plane team webhook
- `slack_app_plane_webhook` - App plane team webhook
- `slack_infrastructure_webhook` - Infrastructure team webhook

**Security**: Directory is git-ignored, includes example files and comprehensive README

### 3. Docker Compose Updates

#### `docker-compose.yml` (MODIFIED)
**Changes**:
- Added environment variables for SMTP configuration
- Added environment variables for email recipients
- Mounted secrets directory: `./alertmanager/secrets:/etc/alertmanager/secrets:ro`
- Added support for `.env` file with sensitive credentials

### 4. Terraform Monitoring Module (AWS)

#### `infrastructure/terraform/modules/monitoring/` (NEW MODULE)

**Files Created**:
- `main.tf` - SNS topics, CloudWatch alarms, Lambda functions
- `variables.tf` - Module inputs with sensible defaults
- `outputs.tf` - SNS topic ARNs, alarm ARNs, Lambda ARNs
- `lambda/pagerduty_forwarder.py` - Lambda to forward alerts to PagerDuty
- `lambda/slack_forwarder.py` - Lambda to forward alerts to Slack
- `README.md` - Comprehensive module documentation

**AWS Resources Created**:
- **4 SNS Topics**: critical, warning, SLO, infrastructure
- **CloudWatch Alarms for RDS**: CPU, storage, connections
- **CloudWatch Alarms for ElastiCache**: CPU, memory, evictions
- **CloudWatch Alarms for ECS**: Per-service CPU and memory
- **2 Lambda Functions**: PagerDuty forwarder, Slack forwarder
- **KMS Key**: For SNS topic encryption (optional)
- **IAM Roles**: Lambda execution roles with minimal permissions

### 5. Documentation

#### `SLO-ALERTING-GUIDE.md` (NEW)
**150+ lines** of comprehensive documentation covering:
- SLO definitions and targets
- Error budget policy
- Alert severity levels and routing
- Setup instructions (step-by-step)
- Runbooks for common alerts
- Troubleshooting guides
- Best practices

#### `alertmanager/secrets/README.md` (NEW)
**120+ lines** documenting:
- How to configure secrets securely
- PagerDuty integration key setup
- Slack webhook setup (7 different webhooks)
- File permissions and security
- Testing and verification
- Production deployment with AWS Secrets Manager

#### `.env.example` (NEW)
Template for environment variables with all required settings

## Integration Points

### Prometheus → AlertManager
1. Prometheus evaluates alert rules every 15s
2. Fires alerts to AlertManager when conditions met
3. AlertManager groups, routes, and deduplicates alerts
4. Sends to appropriate receivers based on routing rules

### AlertManager → Notification Channels
1. **PagerDuty**: Critical alerts only, triggers incident, pages on-call
2. **Slack**: All severities, different channels per team/severity
3. **Email**: Configurable per team, uses SMTP

### AWS CloudWatch → SNS → Lambda → External Services
1. CloudWatch alarm fires when threshold breached
2. SNS topic receives alarm notification
3. Lambda function triggered by SNS
4. Lambda forwards to PagerDuty/Slack with formatted payload

## Key Features

### 1. Error Budget Management
- **Target**: 99.9% availability = 43.2 minutes downtime/month
- **Tracking**: Real-time error budget consumption
- **Burn Rate Alerts**:
  - Fast burn (exhausted in < 6 hours): Page immediately
  - Slow burn (exhausted in < 2 days): Warning alert
- **Policy Enforcement**: Freeze deployments when budget < 10%

### 2. Multi-Window Multi-Burn-Rate Alerts
Following Google SRE best practices:
```
IF burn_rate > 14.4 (1h window) AND burn_rate > 6 (6h window)
THEN error budget will exhaust in < 6 hours → CRITICAL
```

### 3. Intelligent Alert Routing
- **Severity-based**: Critical → page, Warning → Slack
- **Team-based**: Database team gets database alerts
- **Plane-based**: Control Plane vs App Plane teams
- **Category-based**: SLO team gets error budget alerts

### 4. Alert Fatigue Prevention
- **Inhibition rules**: Suppress symptoms when root cause known
- **Grouping**: Batch related alerts together
- **Repeat intervals**: Don't spam (1h for critical, 6h for warnings)
- **Smart routing**: Right alert to right team

### 5. Production-Ready Security
- **Secrets management**: Git-ignored directory, file-based secrets
- **KMS encryption**: SNS topics encrypted at rest
- **Minimal IAM permissions**: Lambda functions have least privilege
- **SMTP TLS**: Email sent securely

## Usage Examples

### Development Environment

```bash
# 1. Configure environment
cd shared-monitoring
cp .env.example .env
# Edit .env with SMTP settings

# 2. Start monitoring stack
docker-compose up -d

# 3. Verify Prometheus loaded rules
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].name'

# 4. Access UIs
# Prometheus: http://localhost:9090
# AlertManager: http://localhost:9093
# Grafana: http://localhost:3001
```

### Production Environment

```bash
# 1. Configure secrets
cd shared-monitoring/alertmanager/secrets
echo "your-pagerduty-key" > pagerduty_key
echo "https://hooks.slack.com/..." > slack_critical_webhook
chmod 600 *

# 2. Update docker-compose to use production config
# Edit docker-compose.yml:
# - ./alertmanager/alertmanager-production.yml:/etc/alertmanager/alertmanager.yml:ro

# 3. Deploy
docker-compose up -d

# 4. Test alert flow
docker exec shared-alertmanager amtool alert add test \
  alertname=TestAlert severity=critical \
  --annotation=summary="Production test"
```

### AWS Deployment (Terraform)

```bash
# 1. Configure Terraform variables
cd infrastructure/terraform
cat > environments/prod/monitoring.tfvars <<EOF
enable_pagerduty = true
enable_slack     = true
pagerduty_integration_key = "your-key"
slack_webhook_url         = "your-webhook"
alert_email_addresses     = ["oncall@ananta.io"]
EOF

# 2. Deploy module
terraform init
terraform plan -var-file=environments/prod/terraform.tfvars \
               -var-file=environments/prod/monitoring.tfvars
terraform apply

# 3. Test CloudWatch alarm
aws cloudwatch set-alarm-state \
  --alarm-name "ananta-prod-control-plane-db-cpu-high" \
  --state-value ALARM \
  --state-reason "Testing alert flow"
```

## Metrics & Observability

### SLO Metrics Available

Query these in Prometheus/Grafana:

```promql
# Current availability (Control Plane)
slo:control_plane:availability:ratio_5m

# Error budget remaining
slo:control_plane:error_budget:remaining

# Current burn rate
slo:control_plane:error_budget:burn_rate_1h

# P95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# Request rate
slo:control_plane:request_rate:5m

# Error rate
slo:control_plane:error_rate:5m
```

### CloudWatch Alarms (AWS)

Per environment, the following alarms are created:

**RDS (3 alarms per database)**:
- CPU utilization > 80% for 10 min
- Free storage < 10 GB
- Connections > 80 for 10 min

**ElastiCache (3 alarms per cluster)**:
- CPU > 75% for 10 min
- Memory > 85% for 10 min
- Evictions > 100/5min

**ECS (2 alarms per service)**:
- CPU > 80% for 10 min
- Memory > 85% for 10 min

## Cost Estimation

### Prometheus/AlertManager (self-hosted)
- **Infrastructure**: $0 (running on existing servers)
- **Storage**: ~$5/month (15 days retention, 1GB/day)

### AWS CloudWatch + SNS + Lambda
For production environment with 20 alarms, 4 SNS topics, 2 Lambda functions:

| Resource | Quantity | Monthly Cost |
|----------|----------|--------------|
| CloudWatch Alarms | 20 | $2.00 |
| SNS Topics | 4 | $0.50 |
| Lambda Invocations | ~1000 | $0.20 |
| CloudWatch Logs | 1 GB | $0.50 |
| **Total** | | **~$3.20** |

### External Services
- **PagerDuty**: $19-49/user/month (bring your own license)
- **Slack**: Free for webhooks (included in Slack subscription)
- **SMTP**: $0 (use Gmail) or $10-50/month (SendGrid, etc.)

**Total estimated cost**: $3-10/month + PagerDuty licenses

## Testing Checklist

- [ ] Prometheus loads SLO recording rules
- [ ] Prometheus loads critical alert rules
- [ ] AlertManager config valid (`amtool check-config`)
- [ ] Secret files mounted and readable
- [ ] Test alert reaches Slack
- [ ] Test alert reaches PagerDuty
- [ ] Test alert sent via email
- [ ] Inhibition rules working (suppress child alerts)
- [ ] CloudWatch alarms created in AWS
- [ ] SNS topics receive messages
- [ ] Lambda functions execute successfully
- [ ] Grafana dashboards display SLO metrics

## Next Steps

1. **Create Grafana Dashboards**
   - SLO Overview dashboard
   - Error Budget dashboard
   - Alert History dashboard

2. **Configure Team Channels**
   - Create Slack channels (#critical-alerts, #slo-alerts, etc.)
   - Set up PagerDuty on-call schedules
   - Configure email distribution lists

3. **Tune Alert Thresholds**
   - Review alert firing frequency
   - Adjust thresholds based on actual traffic
   - Add new alerts for service-specific issues

4. **Document Runbooks**
   - Add runbooks for each critical alert
   - Include investigation steps
   - Include resolution steps
   - Link from alert annotations

5. **Implement Chaos Engineering**
   - Test alert flow under failure conditions
   - Verify MTTR (Mean Time To Resolve)
   - Practice incident response

6. **Review & Iterate**
   - Weekly SLO review meetings
   - Track error budget spend
   - Adjust SLOs based on business needs
   - Improve alert quality (reduce false positives)

## References

- Main documentation: `SLO-ALERTING-GUIDE.md`
- Terraform module: `infrastructure/terraform/modules/monitoring/README.md`
- Secrets setup: `alertmanager/secrets/README.md`
- Alert rules: `prometheus/alerts/slos.yml`, `prometheus/alerts/critical.yml`

## Support

For issues or questions:
1. Check `SLO-ALERTING-GUIDE.md` troubleshooting section
2. Review Prometheus/AlertManager logs
3. Consult SRE team documentation
4. Escalate to platform team if unresolved

---

**Implementation Date**: 2025-12-21
**Version**: 1.0.0
**Status**: Ready for deployment
