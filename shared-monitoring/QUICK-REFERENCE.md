# SRE Quick Reference Card

## Critical Commands

### Check System Health

```bash
# Prometheus health
curl http://localhost:9090/-/healthy

# AlertManager health
curl http://localhost:9093/-/healthy

# View active alerts
curl http://localhost:9093/api/v1/alerts | jq .

# View SLO metrics
curl http://localhost:9090/api/v1/query?query=slo:control_plane:availability:ratio_5m
```

### Send Test Alert

```bash
docker exec shared-alertmanager amtool alert add \
  alertname=TestAlert severity=critical \
  --annotation=summary="Test alert" \
  --alertmanager.url=http://localhost:9093
```

### Reload Configs

```bash
# Reload Prometheus (hot reload)
curl -X POST http://localhost:9090/-/reload

# Reload AlertManager
docker exec shared-alertmanager kill -HUP 1
# OR
docker restart shared-alertmanager
```

### Silence Alert

```bash
# Silence for 2 hours
docker exec shared-alertmanager amtool silence add \
  alertname=ServiceDown \
  --duration=2h \
  --comment="Planned maintenance" \
  --author="oncall@ananta.io"

# List silences
docker exec shared-alertmanager amtool silence query
```

## Key Metrics

### SLO Queries (PromQL)

```promql
# Availability (current 5-minute window)
slo:control_plane:availability:ratio_5m

# Error budget remaining (30-day)
slo:control_plane:error_budget:remaining

# Burn rate (1-hour window)
slo:control_plane:error_budget:burn_rate_1h

# P95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# Request rate
rate(http_requests_total[5m])

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m]))
```

## Alert Severity Matrix

| Severity | Response Time | Channels | Example |
|----------|---------------|----------|---------|
| Critical | < 5 min | PagerDuty + Slack + Email | ServiceDown |
| Warning | < 30 min | Slack + Email | HighMemory |
| Info | Next day | Slack | ConfigReload |

## Error Budget Policy

| Budget Remaining | Action |
|------------------|--------|
| > 50% | ✓ Normal ops |
| 25-50% | ⚠️ Review changes |
| 10-25% | 🚨 Freeze non-critical |
| < 10% | 🔥 STOP deployments |

## Common Runbook Links

| Alert | Runbook |
|-------|---------|
| ServiceDown | https://docs.ananta.io/runbooks/service-down |
| HighErrorRate | https://docs.ananta.io/runbooks/high-error-rate |
| DatabaseDown | https://docs.ananta.io/runbooks/database-down |
| ErrorBudgetBurningFast | https://docs.ananta.io/runbooks/error-budget-burn |

## Escalation

1. Check active alerts: http://localhost:9093
2. Review Grafana: http://localhost:3001
3. Check service logs: `docker logs <service>`
4. Follow runbook for specific alert
5. If stuck > 15 min, page senior SRE

## File Locations

| Config | Path |
|--------|------|
| SLO Rules | `prometheus/alerts/slos.yml` |
| Critical Alerts | `prometheus/alerts/critical.yml` |
| AlertManager | `alertmanager/alertmanager-production.yml` |
| Secrets | `alertmanager/secrets/` |
| Docs | `SLO-ALERTING-GUIDE.md` |

## URLs

- Prometheus: http://localhost:9090
- AlertManager: http://localhost:9093
- Grafana: http://localhost:3001
- Slack: https://ananta-platform.slack.com
- PagerDuty: https://ananta.pagerduty.com

---
**Keep this card handy during on-call shifts!**
