# Alerting Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ANANTA PLATFORM SERVICES                         │
│  ┌──────────────────────┐           ┌──────────────────────┐            │
│  │   Control Plane      │           │     App Plane        │            │
│  │  - Tenant Mgmt API   │           │  - CNS Service       │            │
│  │  - Temporal Workers  │           │  - Customer Portal   │            │
│  │  - Orchestrator      │           │  - Django Backend    │            │
│  └──────┬───────────────┘           └──────┬───────────────┘            │
│         │                                   │                            │
│         │ Expose /metrics + /health         │ Expose /metrics + /health  │
└─────────┼───────────────────────────────────┼────────────────────────────┘
          │                                   │
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          PROMETHEUS (Scraper)                            │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Scrape Jobs (every 15s):                                      │     │
│  │  - ananta-saas-tenant-mgmt-metrics → :14000/metrics            │     │
│  │  - app-plane-cns-service → :27200/metrics                      │     │
│  │  - blackbox-http → health endpoints via probe                  │     │
│  │  - blackbox-tcp → DB/Redis ports via probe                     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Alert Rules Evaluation (every 15s):                           │     │
│  │  - slos.yml → SLO recording rules (availability, latency, etc) │     │
│  │  - critical.yml → Critical alerts (service down, errors, etc)  │     │
│  │  - ananta-platform.yml → Service-specific alerts               │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Firing Alerts → Send to AlertManager                                   │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       ALERTMANAGER (Router)                              │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Routing Logic:                                                 │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ severity=critical                                         │  │     │
│  │  │  → pagerduty-critical (page oncall)                       │  │     │
│  │  │  → slack-critical (#critical-alerts)                      │  │     │
│  │  │  → email (oncall@ananta.io)                               │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ severity=warning                                          │  │     │
│  │  │  → slack-warnings (#platform-alerts)                      │  │     │
│  │  │  → email (team@ananta.io)                                 │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ category=slo                                              │  │     │
│  │  │  → slo-team (email + slack #slo-alerts)                  │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ plane=control OR plane=app                                │  │     │
│  │  │  → plane-specific teams (email + slack)                   │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Inhibition Rules:                                                       │
│  - Critical suppresses Warnings for same service                         │
│  - ServiceDown suppresses all other alerts for that service              │
│  - MultipleServicesDown suppresses individual service alerts             │
└──────┬──────────┬───────────┬──────────┬───────────┬───────────┬─────────┘
       │          │           │          │           │           │
       ▼          ▼           ▼          ▼           ▼           ▼
   ┌───────┐ ┌────────┐ ┌─────────┐ ┌───────┐ ┌───────┐ ┌───────────┐
   │PagerDuty│Slack    │ Slack    │ Email  │ Email  │   Email    │
   │ (Critical)│(#critical)│(#warnings)│(oncall)│(slo-team)│(db-team)│
   └───────┘ └────────┘ └─────────┘ └───────┘ └───────┘ └───────────┘
       │          │           │          │           │           │
       │          │           │          │           │           │
       ▼          ▼           ▼          ▼           ▼           ▼
   Creates   Posts msg   Posts msg   Sends    Sends    Sends
   Incident  to Slack   to Slack    Email    Email    Email
   Pages
   Oncall

┌─────────────────────────────────────────────────────────────────────────┐
│                    AWS CLOUDWATCH (Alternative Path)                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  CloudWatch Alarms:                                             │     │
│  │  - RDS CPU > 80% for 10 min                                     │     │
│  │  - ElastiCache Memory > 85% for 10 min                          │     │
│  │  - ECS Service CPU > 80% for 10 min                             │     │
│  └──────────────────────────┬───────────────────────────────────────┘     │
│                             │                                            │
│                             ▼                                            │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  SNS Topics:                                                    │     │
│  │  - critical-alerts-topic                                        │     │
│  │  - warning-alerts-topic                                         │     │
│  │  - slo-violations-topic                                         │     │
│  │  - infrastructure-alerts-topic                                  │     │
│  └──────────────────────────┬───────────────────────────────────────┘     │
│                             │                                            │
│                             ▼                                            │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Lambda Functions:                                              │     │
│  │  - pagerduty-forwarder (Python 3.11)                            │     │
│  │  - slack-forwarder (Python 3.11)                                │     │
│  └──────────────────────────┬───────────────────────────────────────┘     │
│                             │                                            │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
                      Same Destinations
                      (PagerDuty, Slack, Email)
```

## Alert Flow Examples

### Example 1: Service Down (Critical)

```
1. Prometheus detects: up{job="app-plane-cns-service"} == 0 for > 1 min
2. Fires alert: ServiceDown (severity=critical, plane=app, service=cns-service)
3. AlertManager receives alert
4. Routing matches:
   - severity=critical → Route to pagerduty-critical + slack-critical
   - plane=app → Also route to app-plane-team
5. AlertManager sends notifications:
   a) PagerDuty: Creates incident, pages on-call engineer
   b) Slack #critical-alerts: Posts formatted message with service details
   c) Slack #app-plane-alerts: Posts to App Plane team channel
   d) Email: Sends to oncall@ananta.io and app-plane-team@ananta.io
6. Inhibition: Suppresses other CNS alerts (CNSConfigUnhealthy, etc.)
```

### Example 2: Error Budget Burning Fast (Critical)

```
1. Prometheus calculates:
   - burn_rate_1h = 15.2 (> 14.4 threshold)
   - burn_rate_6h = 7.1 (> 6 threshold)
   - Both conditions met for > 15 min
2. Fires alert: ErrorBudgetBurningFast (severity=critical, category=slo)
3. AlertManager receives alert
4. Routing matches:
   - severity=critical → pagerduty-critical + slack-critical
   - category=slo → slo-team
5. AlertManager sends:
   a) PagerDuty: Creates incident with error budget details
   b) Slack #critical-alerts: Posts with burn rate, remaining budget
   c) Slack #slo-alerts: Posts to SLO team with detailed metrics
   d) Email: slo-team@ananta.io with runbook link
6. Action: SRE team freezes deployments, investigates error spike
```

### Example 3: Database CPU High (Warning)

```
1. CloudWatch detects: RDS CPU > 80% for 10 min
2. CloudWatch Alarm fires: control-plane-db-cpu-high
3. SNS Topic receives alarm: warning-alerts-topic
4. Lambda slack-forwarder triggered
5. Lambda parses CloudWatch alarm, formats message
6. Posts to Slack #database-alerts with:
   - Alarm name: control-plane-db-cpu-high
   - Current CPU: 82%
   - Threshold: 80%
   - Link to CloudWatch console
   - Link to Grafana dashboard
7. Also sent via email to database-team@ananta.io
```

## SLO Metrics Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION METRICS                              │
│  Service exports:                                                        │
│  - http_requests_total{status="200"} → Success counter                   │
│  - http_requests_total{status="500"} → Error counter                     │
│  - http_request_duration_seconds_bucket{le="0.5"} → Latency histogram    │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ Scraped every 15s
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROMETHEUS RECORDING RULES                            │
│  Evaluate every 30s:                                                     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ slo:control_plane:availability:ratio_5m                         │     │
│  │   = sum(rate(http_requests_total{status!~"5.."}[5m]))          │     │
│  │     / sum(rate(http_requests_total[5m]))                        │     │
│  │   → Stores as new metric (e.g., 0.999 = 99.9%)                 │     │
│  └────────────────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ slo:control_plane:error_budget:remaining                        │     │
│  │   = 1 - ((1 - avg_over_time(...[30d])) / 0.001)               │     │
│  │   → Stores remaining budget (e.g., 0.75 = 75% remaining)       │     │
│  └────────────────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ slo:control_plane:error_budget:burn_rate_1h                     │     │
│  │   = (1 - availability_1h) / 0.001                              │     │
│  │   → Burn rate (e.g., 2.5 = consuming budget 2.5x allowed rate) │     │
│  └────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ Query via PromQL
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          GRAFANA DASHBOARD                               │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  SLO Overview:                                                  │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ Availability (30d): ████████████████░░ 99.92%            │  │     │
│  │  │ Target: 99.9% ✓                                          │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ Error Budget Remaining: ████████░░░░░░ 75%               │  │     │
│  │  │ Consumed: 10.8 min / 43.2 min monthly budget             │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ Burn Rate (1h): 2.1x ⚠️                                  │  │     │
│  │  │ If sustained: Budget exhausted in 14 hours              │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────────────────┐  │     │
│  │  │ P95 Latency: 320ms ✓ (target: < 500ms)                  │  │     │
│  │  │ P99 Latency: 1.2s ✓ (target: < 2s)                      │  │     │
│  │  └──────────────────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Metrics Collection | Prometheus | 2.47.0 | Scrapes metrics, evaluates alerts |
| Alert Routing | AlertManager | 0.26.0 | Routes alerts to receivers |
| Visualization | Grafana | 10.2.0 | Dashboards, SLO tracking |
| Health Probing | Blackbox Exporter | 0.24.0 | HTTP/TCP endpoint checks |
| AWS Alarms | CloudWatch | - | RDS, ElastiCache, ECS alarms |
| Notification Bus | SNS | - | Alert message delivery |
| Alert Forwarding | Lambda (Python 3.11) | - | PagerDuty/Slack integration |
| On-Call Paging | PagerDuty | Events API v2 | Incident management |
| Team Messaging | Slack | Webhooks API | Real-time notifications |
| Email | SMTP | - | Email notifications |

## Secrets Management

```
Production Secrets Flow:

alertmanager/secrets/
├── pagerduty_key                   ─┐
├── slack_critical_webhook           │
├── slack_warnings_webhook           ├─ Mounted to container
├── slack_slo_webhook                │  at /etc/alertmanager/secrets/
├── slack_database_webhook           │  (read-only)
├── slack_control_plane_webhook      │
├── slack_app_plane_webhook          │
└── slack_infrastructure_webhook    ─┘
                                     │
                                     ▼
              alertmanager-production.yml references:
              routing_key_file: /etc/alertmanager/secrets/pagerduty_key
              api_url_file: /etc/alertmanager/secrets/slack_critical_webhook

Alternative (AWS Secrets Manager):
  Lambda retrieves secrets at runtime:
    aws secretsmanager get-secret-value --secret-id ananta/pagerduty-key
```

## High Availability Considerations

### Single Points of Failure

1. **Prometheus**: Single instance
   - Mitigation: 15-day retention, fast recovery from volume
   - Future: Deploy Prometheus HA with Thanos

2. **AlertManager**: Single instance
   - Mitigation: Stateless (alerts regenerated by Prometheus)
   - Future: Deploy 3-node AlertManager cluster

3. **Grafana**: Single instance
   - Mitigation: Dashboards in git, fast recovery
   - Future: Deploy Grafana HA with shared database

### Failure Scenarios

| Failure | Impact | MTTR | Mitigation |
|---------|--------|------|------------|
| Prometheus down | No new alerts fired | 5 min | Auto-restart, health checks |
| AlertManager down | Alerts not routed | 5 min | Auto-restart, health checks |
| PagerDuty API down | No pages sent | N/A | Fallback to Slack + Email |
| Slack API down | No Slack messages | N/A | Fallback to Email |
| SMTP down | No emails sent | 30 min | Fallback to Slack + PagerDuty |

### Network Partitions

```
If Prometheus loses connectivity to services:
  1. probe_success{} metrics → 0
  2. Alerts fire: ServiceDown
  3. AlertManager routes as normal
  4. On-call investigates (may be false alarm)

If AlertManager loses connectivity to receivers:
  1. AlertManager retries with backoff
  2. Alerts queued in memory
  3. Sent when connectivity restored
  4. Check AlertManager UI for unsent alerts
```

## Performance Characteristics

### Prometheus

- **Scrape interval**: 15s
- **Rule evaluation**: 15s
- **Retention**: 15 days
- **Storage**: ~1 GB/day (estimated)
- **Query latency**: < 100ms (typical)

### AlertManager

- **Group wait**: 30s (first alert in group)
- **Group interval**: 5m (subsequent alerts in group)
- **Repeat interval**: 1h (critical), 6h (warning)
- **Processing latency**: < 1s

### Lambda Functions

- **Runtime**: Python 3.11
- **Timeout**: 30s
- **Memory**: 128 MB (default)
- **Cold start**: ~500ms
- **Warm execution**: ~50ms

### End-to-End Alert Latency

```
Service degrades (t=0)
  ↓ 15s (next Prometheus scrape)
Service metric scraped (t=15s)
  ↓ 15s (next rule evaluation)
Alert rule evaluates true (t=30s)
  ↓ 60s (for: 1m condition met)
Alert fires to AlertManager (t=90s)
  ↓ 30s (group_wait)
AlertManager sends notification (t=120s)
  ↓ 5s (PagerDuty/Slack API)
On-call receives page (t=125s)

Total: ~2 minutes from degradation to notification
```

---

**Last Updated**: 2025-12-21
