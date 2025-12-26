# Ananta Platform Service Level Objectives

## Document Overview

This document defines Service Level Objectives (SLOs) for the Ananta Platform SaaS infrastructure. SLOs represent our commitments to reliability and performance for both internal services and customer-facing applications.

**Last Updated**: 2025-12-21
**Owner**: SRE Team
**Review Cycle**: Quarterly

---

## SLO Fundamentals

### Service Level Indicators (SLIs)
Quantitative measures of service behavior:
- **Availability**: Percentage of successful requests
- **Latency**: Time to complete requests (P50, P95, P99)
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per second

### Service Level Objectives (SLOs)
Target values for SLIs over a time window:
- Define what "good" service looks like
- Based on user experience, not infrastructure metrics
- Expressed as percentages or absolute values

### Error Budgets
Inverse of SLO - acceptable failure rate:
- 99.9% SLO = 0.1% error budget = 43.2 minutes/month downtime
- Used to balance feature velocity vs. reliability
- Triggers operational responses when depleted

---

## Control Plane Services

### Tenant Management Service

**Service Description**: Core backend API for tenant provisioning, subscription management, user authentication, and billing.

**Business Criticality**: CRITICAL - Revenue impacting, blocks customer onboarding

**Dependencies**: PostgreSQL (arc_saas DB), Redis, Keycloak, Temporal

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.9% | 30 days rolling | 43.2 minutes |
| Latency P95 | < 500ms | 5 minutes | N/A |
| Latency P99 | < 2s | 5 minutes | N/A |
| Error Rate | < 0.1% | 5 minutes | 43.2 minutes |

**Exclusions**:
- Scheduled maintenance windows (pre-announced 48h)
- Client-side errors (4xx except 429 rate limiting)
- Dependency failures beyond our control (Keycloak SaaS outage)

**Measurement**:
```promql
# Availability
sum(rate(http_requests_total{service="tenant-management-service",status!~"5.."}[5m]))
/ sum(rate(http_requests_total{service="tenant-management-service"}[5m]))

# P95 Latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{service="tenant-management-service"}[5m])) by (le)
)
```

---

### Keycloak (Authentication Service)

**Service Description**: OAuth2/OIDC authentication provider for all Ananta Platform services.

**Business Criticality**: CRITICAL - Blocks all user access

**Dependencies**: PostgreSQL (Keycloak DB), LDAP/AD (optional)

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.95% | 30 days rolling | 21.6 minutes |
| Auth Latency P95 | < 200ms | 5 minutes | N/A |
| Token Refresh P95 | < 100ms | 5 minutes | N/A |
| Login Success Rate | > 99.5% | 5 minutes | 21.6 minutes |

**Exclusions**:
- Invalid credentials (user error)
- Account lockouts (security policy)
- Upstream IdP failures (external SAML/LDAP)

**Measurement**:
```promql
# Availability (probe-based)
avg_over_time(probe_success{instance=~".*keycloak.*"}[5m])

# Auth latency (blackbox probe)
histogram_quantile(0.95,
  sum(rate(probe_http_duration_seconds_bucket{instance=~".*keycloak.*"}[5m])) by (le)
)
```

---

### Temporal (Workflow Engine)

**Service Description**: Orchestrates long-running workflows for tenant provisioning, subscription updates, and billing cycles.

**Business Criticality**: HIGH - Blocks automated operations, manual workarounds available

**Dependencies**: PostgreSQL (Temporal DB), Control Plane services

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.5% | 30 days rolling | 3.6 hours |
| Workflow Start P95 | < 1s | 5 minutes | N/A |
| Task Queue Latency P95 | < 5s | 5 minutes | N/A |
| Workflow Success Rate | > 99% | 24 hours | 3.6 hours |

**Exclusions**:
- Workflow failures due to invalid input
- Retry exhaustion for transient errors
- Manual workflow terminations

**Measurement**:
```promql
# Availability (gRPC health)
avg_over_time(probe_success{instance=~".*temporal.*:7233"}[5m])

# Workflow success rate (custom metric)
sum(rate(temporal_workflow_completed_total{status="success"}[5m]))
/ sum(rate(temporal_workflow_completed_total[5m]))
```

---

### PostgreSQL (Control Plane Database)

**Service Description**: Primary data store for tenant management, subscriptions, users, and configuration.

**Business Criticality**: CRITICAL - Single point of failure for Control Plane

**Dependencies**: EBS volumes, RDS (if managed)

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.99% | 30 days rolling | 4.3 minutes |
| Query Latency P95 | < 100ms | 5 minutes | N/A |
| Connection Success Rate | > 99.9% | 5 minutes | 43.2 minutes |
| Replication Lag | < 5s | 1 minute | N/A |

**Exclusions**:
- Failover to replica (expected recovery < 30s)
- Slow queries caused by application code
- Manual maintenance operations

**Measurement**:
```promql
# Availability (TCP probe)
avg_over_time(probe_success{instance=~".*postgres.*:5432"}[5m])

# Connection pool utilization
pg_stat_activity_count / pg_settings_max_connections

# Replication lag (if replica exists)
pg_replication_lag_seconds
```

---

### Redis (Cache & Session Store)

**Service Description**: In-memory cache for lead tokens, session data, and frequently accessed configuration.

**Business Criticality**: MEDIUM - Degrades performance, not a blocker

**Dependencies**: Persistent storage (RDB/AOF), network

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.5% | 30 days rolling | 3.6 hours |
| Command Latency P95 | < 10ms | 5 minutes | N/A |
| Cache Hit Rate | > 80% | 5 minutes | N/A |
| Memory Availability | < 85% used | 5 minutes | N/A |

**Exclusions**:
- Cache misses (expected behavior)
- Key evictions (LRU policy)
- Persistence delays (async writes)

**Measurement**:
```promql
# Availability (TCP probe)
avg_over_time(probe_success{instance=~".*redis.*:6379"}[5m])

# Command latency (from redis_exporter)
redis_command_duration_seconds_p95

# Hit rate
rate(redis_keyspace_hits_total[5m])
/ (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))
```

---

## App Plane Services

### CNS Service (Component Normalization & BOM Enrichment)

**Service Description**: FastAPI service for BOM processing, component enrichment, supplier integration, and part matching.

**Business Criticality**: HIGH - Core customer value proposition

**Dependencies**: Supabase DB, Components-V2 DB, Redis, RabbitMQ, Supplier APIs (DigiKey, Mouser, Octopart)

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.5% | 30 days rolling | 3.6 hours |
| Enrichment Latency P95 | < 5s | 5 minutes | N/A |
| Batch Processing P95 | < 30s | 5 minutes | N/A |
| Match Rate | > 85% | 24 hours | N/A |
| Supplier API Success | > 95% | 5 minutes | 3.6 hours |

**Exclusions**:
- Low match rate due to poor input data quality
- Supplier API rate limiting (429 responses)
- Manual enrichment requests (background jobs)

**Measurement**:
```promql
# Availability
sum(rate(http_requests_total{service="cns-service",status!~"5.."}[5m]))
/ sum(rate(http_requests_total{service="cns-service"}[5m]))

# Enrichment latency (custom histogram)
histogram_quantile(0.95,
  sum(rate(enrichment_duration_seconds_bucket[5m])) by (le)
)

# Match rate (custom counter)
sum(enrichment_matches_total{status="matched"})
/ sum(enrichment_matches_total)
```

---

### Supabase Database (App Plane Data)

**Service Description**: PostgreSQL instance storing customer business data (BOMs, line items, organizations, enrichment results).

**Business Criticality**: CRITICAL - Customer data loss unacceptable

**Dependencies**: Persistent volumes, backups (PITR)

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.9% | 30 days rolling | 43.2 minutes |
| Query Latency P95 | < 150ms | 5 minutes | N/A |
| Connection Success Rate | > 99.9% | 5 minutes | 43.2 minutes |
| Backup Success Rate | 100% | 24 hours | 0 |

**Exclusions**:
- Planned failover drills
- Long-running analytical queries (user-initiated)

**Measurement**:
```promql
# Availability (TCP probe to port 27432)
avg_over_time(probe_success{instance="supabase-db:27432"}[5m])

# Query performance (pg_stat_statements)
histogram_quantile(0.95, sum(rate(pg_stat_statements_total_time_bucket[5m])) by (le))
```

---

### Customer Portal (Frontend)

**Service Description**: React-based customer-facing application for BOM management, enrichment tracking, and component search.

**Business Criticality**: HIGH - Primary customer interface

**Dependencies**: CNS Service, Supabase API, Keycloak

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.5% | 30 days rolling | 3.6 hours |
| Page Load P95 | < 2s | 5 minutes | N/A |
| API Call Success | > 99% | 5 minutes | 3.6 hours |
| Interactive Time P95 | < 3s | 5 minutes | N/A |

**Exclusions**:
- Client-side JavaScript errors (browser compatibility)
- Network latency outside our control
- CDN failures (external provider)

**Measurement**:
```promql
# Availability (HTTP probe)
avg_over_time(probe_success{instance=~".*customer-portal.*:27100"}[5m])

# Real User Monitoring (RUM) metrics
# (requires instrumentation with DataDog RUM or similar)
```

---

### RabbitMQ (Message Broker)

**Service Description**: Asynchronous messaging for enrichment jobs, notifications, and event processing.

**Business Criticality**: MEDIUM - Delays background processing, not customer-facing

**Dependencies**: Persistent storage, cluster peers (if clustered)

| SLI | SLO Target | Measurement Window | Error Budget (Monthly) |
|-----|------------|-------------------|----------------------|
| Availability | 99.5% | 30 days rolling | 3.6 hours |
| Message Publish Latency P95 | < 100ms | 5 minutes | N/A |
| Queue Processing Rate | > 100 msg/s | 5 minutes | N/A |
| Message Loss Rate | < 0.01% | 24 hours | 4.3 minutes |

**Exclusions**:
- Message rejections (invalid format)
- Dead letter queue accumulation (expected for retries)

**Measurement**:
```promql
# Availability (TCP probe + management API)
avg_over_time(probe_success{instance=~".*rabbitmq.*:5672"}[5m])

# Queue depth (indicator of processing health)
sum(rabbitmq_queue_messages_ready)

# Message rates
rate(rabbitmq_queue_messages_delivered_total[5m])
```

---

## Cross-Cutting SLOs

### End-to-End User Journeys

#### BOM Enrichment Flow
**User Story**: Customer uploads BOM, receives enriched results with supplier data

| SLI | SLO Target | Measurement Window |
|-----|------------|-------------------|
| E2E Success Rate | > 95% | 24 hours |
| E2E Duration P95 | < 60s (for 100-line BOM) | 5 minutes |

**Measurement**: Synthetic monitoring with Blackbox exporter or DataDog Synthetics

#### Tenant Onboarding Flow
**User Story**: Lead submits form, provisions tenant, receives activation email

| SLI | SLO Target | Measurement Window |
|-----|------------|-------------------|
| E2E Success Rate | > 98% | 24 hours |
| E2E Duration P95 | < 5 minutes | 5 minutes |

**Measurement**: Temporal workflow completion metrics

---

## SLO Compliance Reporting

### Monthly SLO Report Template

**Month**: [Month Year]
**Reporting Period**: [Start Date] - [End Date]

| Service | SLO Target | Actual | Status | Error Budget Consumed |
|---------|------------|--------|--------|-----------------------|
| Tenant Management | 99.9% | 99.95% | PASS | 50% |
| Keycloak | 99.95% | 99.98% | PASS | 40% |
| CNS Service | 99.5% | 99.3% | FAIL | 140% |
| Supabase DB | 99.9% | 99.92% | PASS | 80% |

**SLO Violations**:
1. **CNS Service** - Availability 99.3% (target 99.5%)
   - **Root Cause**: Supplier API rate limiting caused cascading failures
   - **Impact**: 7.2 hours downtime (exceeded 3.6h budget)
   - **Action Items**: Implement circuit breaker, cache supplier responses

**Recommendations**:
- Review CNS Service error handling
- Increase monitoring for supplier API dependencies
- Consider relaxing SLO to 99.0% or improving architecture

---

## Error Budget Policy

### Budget Allocation by Window

| Time Window | Error Budget | Threshold Actions |
|-------------|--------------|-------------------|
| 1 hour | 0.43 seconds | Alert if burn rate > 14.4x |
| 6 hours | 2.6 seconds | Alert if burn rate > 6x |
| 24 hours | 10.4 seconds | Alert if burn rate > 3x |
| 30 days | 43.2 minutes | Monthly review |

### Operational Response Levels

#### LEVEL 1: Healthy (>50% budget remaining)
**Indicator**: Error budget consumption normal or below trend

**Actions**:
- Normal development velocity
- Standard change management process
- Deploy features during business hours
- Maintain routine monitoring

**Approval Required**: None (standard process)

---

#### LEVEL 2: Warning (25-50% budget remaining)
**Indicator**: Error budget consumption elevated but manageable

**Actions**:
- Increase monitoring vigilance
- Review recent changes for reliability impact
- Prioritize reliability fixes in sprint planning
- Add observability to risky code paths
- Daily SLO review in standup

**Approval Required**: Engineering Manager approval for risky deployments

---

#### LEVEL 3: Critical (10-25% budget remaining)
**Indicator**: Error budget depleting rapidly, SLO breach likely

**Actions**:
- FREEZE all non-critical deployments
- All hands on reliability improvements
- Root cause analysis for budget consumption
- Hotfix-only deployment policy
- Executive notification (VP Engineering)
- Twice-daily SLO war room

**Approval Required**: VP Engineering approval for ANY deployment

---

#### LEVEL 4: Exhausted (<10% or negative budget)
**Indicator**: SLO breach occurred or imminent

**Actions**:
- EMERGENCY MODE: No deployments except reliability fixes
- Incident Commander assigned
- Continuous war room until recovery
- Executive escalation (CTO notification)
- Customer communication prepared
- Mandatory postmortem within 48 hours
- External communication if customer-facing

**Approval Required**: CTO approval for reliability fix deployments only

---

### Budget Burn Rate Thresholds

| Burn Rate | Time to Exhaustion | Alert Severity | Response Time |
|-----------|-------------------|----------------|---------------|
| 1x | 30 days (normal) | None | N/A |
| 3x | 10 days | Warning | 4 hours |
| 6x | 5 days | High | 1 hour |
| 14.4x | < 2 days | Critical | 15 minutes |

**Calculation**:
```
Burn Rate = (1 - current_availability) / (1 - SLO_target)

Example: 99% actual vs 99.9% target
Burn Rate = (1 - 0.99) / (1 - 0.999) = 0.01 / 0.001 = 10x
```

---

## SLO Review & Adjustment Process

### Quarterly Review Checklist

Conducted by: SRE Team, Engineering Managers, Product Managers

**Agenda**:
1. Review SLO compliance for past quarter
2. Analyze error budget consumption patterns
3. Assess customer impact of SLO violations
4. Evaluate SLO appropriateness (too strict/loose)
5. Update SLOs based on business priorities

**Outputs**:
- Updated SLO targets (if needed)
- Architecture improvements identified
- Monitoring gaps addressed
- Training needs documented

**Next Steps**:
- Communicate SLO changes to stakeholders
- Update Prometheus recording rules
- Update Grafana dashboards
- Schedule follow-up in 3 months

---

### When to Adjust SLOs

**Tighten SLOs (increase target)**:
- Consistently exceeding targets by >10%
- Customer expectations have increased
- Competitive pressure requires higher reliability
- Business model shift (e.g., enterprise focus)

**Relax SLOs (decrease target)**:
- Consistently missing targets despite best efforts
- Architecture limitations prevent achieving target
- Cost of achieving SLO exceeds business value
- Error budget policy causing excessive deployment friction

**Example**: If CNS Service consistently achieves 99.8% availability against 99.5% target, consider raising to 99.7% to align with actual capability.

---

## Appendix: SLO Calculation Examples

### Example 1: Monthly Availability SLO

**Scenario**: Tenant Management Service had 2 outages in November:
- Outage 1: 15 minutes (database connection pool exhausted)
- Outage 2: 10 minutes (Keycloak authentication failure)

**Calculation**:
```
Total minutes in November: 30 days × 24 hours × 60 min = 43,200 minutes
Downtime: 15 + 10 = 25 minutes
Uptime: 43,200 - 25 = 43,175 minutes
Availability: 43,175 / 43,200 = 99.942%

SLO Target: 99.9%
Error Budget: 43.2 minutes
Error Budget Consumed: 25 / 43.2 = 57.9%
```

**Result**: PASS (99.942% > 99.9%), but consumed 58% of error budget.

---

### Example 2: Latency SLO Violation

**Scenario**: CNS Service P95 latency exceeded 5s during peak hours (12pm-2pm) on Friday due to database slow queries.

**Calculation**:
```
Total requests in period: 10,000
Requests over 5s threshold: 800 (8%)
P95 latency: 6.2s (measured via histogram_quantile)

SLO Target: P95 < 5s
Actual: P95 = 6.2s
```

**Result**: FAIL (6.2s > 5s threshold). Impacted 8% of requests in 2-hour window.

**Impact**:
- Not counted against availability error budget (different SLI)
- Triggers latency alert and investigation
- Requires postmortem if recurring

---

### Example 3: Multi-Window Burn Rate Alert

**Scenario**: Control Plane experiencing 5% error rate for past hour.

**Calculation**:
```
SLO Target: 99.9% availability
Allowed error rate: 0.1%
Current error rate: 5%

1-hour burn rate = 5% / 0.1% = 50x
6-hour burn rate = 2% / 0.1% = 20x

Alert threshold: 1h > 14.4x AND 6h > 6x
Result: 50x > 14.4x ✓ AND 20x > 6x ✓
```

**Result**: CRITICAL ALERT triggered. Error budget will be exhausted in:
```
Time to exhaustion = 30 days / 50x = 0.6 days = 14.4 hours
```

**Response**: Immediate incident escalation, all hands to investigate.

---

## Related Documentation

- **Alert Rules**: `shared-monitoring/prometheus/alerts/slos.yml`
- **Error Budget Policy**: `shared-monitoring/docs/ERROR-BUDGET-POLICY.md`
- **SLO Dashboards**: `shared-monitoring/grafana/dashboards/slo-dashboard.json`
- **Alerting Guide**: `shared-monitoring/SLO-ALERTING-GUIDE.md`
- **Incident Response**: `docs/INCIDENT-RESPONSE-RUNBOOK.md` (to be created)

---

**Version**: 1.0
**Approved By**: SRE Team Lead
**Next Review**: 2025-03-21 (Quarterly)
