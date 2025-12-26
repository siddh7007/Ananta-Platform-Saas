# Error Budget Policy - Ananta Platform

## Executive Summary

This document defines how the Ananta Platform SRE team manages error budgets to balance feature development velocity with system reliability. Error budgets are the allowable amount of unreliability within our Service Level Objectives (SLOs) and serve as the quantitative basis for decision-making around deployments, incident response, and reliability investments.

**Last Updated**: 2025-12-21
**Owner**: SRE Team
**Review Cycle**: Quarterly

---

## What is an Error Budget?

### Definition

An error budget is the inverse of an SLO - the acceptable amount of unreliability over a time window.

**Formula**:
```
Error Budget = 1 - SLO Target

Example:
SLO Target: 99.9% availability
Error Budget: 1 - 0.999 = 0.001 = 0.1%
Monthly Error Budget: 43,200 minutes × 0.001 = 43.2 minutes downtime
```

### Purpose

Error budgets serve three critical functions:

1. **Decision Framework**: Objective metric for deployment risk assessment
2. **Incentive Alignment**: Balances product velocity with reliability needs
3. **Transparency**: Shared understanding between Engineering, Product, and Business teams

### Key Principle

> "If we have error budget remaining, we can take risks. If we've exhausted our budget, reliability takes precedence over features."

---

## Error Budget Calculation

### Time Windows

Error budgets are tracked across multiple windows for different decision-making contexts:

| Window | Purpose | Error Budget (99.9% SLO) | Usage |
|--------|---------|-------------------------|-------|
| 1 hour | Fast burn detection | 0.43 seconds | Incident alerting |
| 6 hours | Medium burn detection | 2.6 seconds | Deployment decisions |
| 24 hours | Daily tracking | 10.4 seconds | Daily standup review |
| 7 days | Weekly review | 1.01 minutes | Sprint planning input |
| 30 days | Official SLO window | 43.2 minutes | Monthly reporting, policy enforcement |

### Calculation Methodology

**Availability-Based Error Budget**:
```promql
# Error budget remaining (percentage)
slo:service:error_budget:remaining = 1 - (
  (1 - actual_availability_30d) / (1 - slo_target)
)

# Error budget consumed (minutes)
error_budget_consumed_minutes = (
  total_minutes_in_window × (1 - actual_availability)
)
```

**Example**:
```
Service: Tenant Management
SLO: 99.9% (43.2 min budget/month)
Actual: 99.85% (64.8 min downtime/month)
Budget Consumed: 64.8 / 43.2 = 150% (EXHAUSTED)
```

### Burn Rate

Burn rate indicates how fast we're consuming error budget relative to the SLO:

```
Burn Rate = (1 - current_availability) / (1 - slo_target)

Interpretation:
1x = Normal consumption (will hit SLO exactly)
2x = Consuming twice as fast (will breach SLO in 15 days)
10x = Consuming 10x fast (will breach SLO in 3 days)
```

---

## Policy Levels & Response Actions

### Level 0: Excellent (>75% Budget Remaining)

**Indicator**: Error budget healthy, well under consumption target

**Deployment Policy**:
- Aggressive feature deployment encouraged
- Experiment with new technologies
- Large-scale refactoring permitted
- Deploy during business hours without restriction
- Batch multiple changes together

**Change Management**:
- Standard PR review (1 approval)
- Automated testing required
- No special approvals needed
- Rollback plan documented

**Monitoring**:
- Standard dashboards
- Weekly SLO review in team meeting
- No special vigilance

**Example Decision**:
```
"We have 90% error budget remaining. Let's deploy the new microservice
architecture refactor and the GraphQL migration together this sprint."
```

---

### Level 1: Healthy (50-75% Budget Remaining)

**Indicator**: Error budget consumption normal, within expected range

**Deployment Policy**:
- Normal development velocity
- Standard change management
- Deploy features during business hours
- Maintain routine monitoring
- One major change per deployment

**Change Management**:
- Standard PR review (1 approval)
- All tests must pass
- Deployment plan reviewed
- Rollback tested in staging

**Monitoring**:
- Standard dashboards
- Daily SLO check in standup
- Weekly error budget review

**Example Decision**:
```
"We have 65% error budget. Deploy the new feature today but monitor
closely for the next 2 hours."
```

---

### Level 2: Warning (25-50% Budget Remaining)

**Indicator**: Error budget consumption elevated, requires attention

**Deployment Policy**:
- Reduce deployment frequency
- Increase deployment review scrutiny
- Prefer small, incremental changes
- Deploy only during business hours (9am-3pm)
- No deployments on Fridays
- Require Engineering Manager awareness

**Change Management**:
- PR review: 2 approvals required
- Load testing for traffic-impacting changes
- Deployment runbook mandatory
- Rollback plan tested
- Deployment approval from Engineering Manager

**Monitoring**:
- Enhanced monitoring for 24h post-deployment
- Daily SLO review in standup
- Twice-weekly error budget analysis
- Alert thresholds tightened

**Reliability Investments**:
- Prioritize bug fixes over features (70/30 split)
- Add observability to known risky areas
- Review recent incident postmortems
- Identify toil reduction opportunities

**Example Decision**:
```
"We have 40% error budget left with 15 days remaining in the month.
Delay the non-critical UI redesign. Deploy critical billing fix only,
with EM approval and extended monitoring."
```

---

### Level 3: Critical (10-25% Budget Remaining)

**Indicator**: Error budget depleting rapidly, SLO breach likely if trend continues

**Deployment Policy**:
- FREEZE all non-critical deployments
- Only critical bug fixes and security patches
- Deploy outside business hours (8pm-6am)
- Require VP Engineering approval
- Mandatory deployment review meeting

**Change Management**:
- PR review: 3 approvals (2 Senior Engineers + EM)
- Mandatory canary deployment (5% traffic)
- Deployment simulation in production-like environment
- Incident Commander on standby during deployment
- Automated rollback configured

**Monitoring**:
- Continuous monitoring during deployment
- SLO war room twice daily (10am, 4pm)
- Real-time error budget tracking dashboard
- Executive reporting (daily)

**Reliability Investments**:
- All hands on reliability improvements
- Stop all feature work
- Mandatory incident review for budget consumption events
- Architecture review for systemic issues
- Increase on-call coverage

**Communication**:
- Engineering-wide notification of freeze
- Daily stakeholder updates
- Product Manager alignment on feature delays
- Customer-facing communication prepared (if needed)

**Example Decision**:
```
"CRITICAL: 15% error budget remaining with 10 days left. Deployment
freeze in effect. Only the data corruption hotfix approved by VP Eng
proceeds tonight at 10pm with IC on call. All feature work paused
until we recover to 30% budget."
```

---

### Level 4: Exhausted (<10% or Negative Budget)

**Indicator**: SLO breach occurred or imminent, error budget exhausted

**Deployment Policy**:
- EMERGENCY MODE: Complete deployment freeze
- ONLY reliability fixes allowed
- Require CTO approval for ANY change
- Deployment requires Incident Commander coordination

**Change Management**:
- Emergency change process only
- Incident Commander leads deployment
- Full war room during deployment
- Automated rollback mandatory
- Post-deployment verification checklist

**Incident Response**:
- Incident Commander assigned immediately
- Continuous war room until budget > 10%
- Root cause analysis within 24 hours
- Postmortem within 48 hours
- Executive escalation (CTO, CEO if customer-facing)

**Communication**:
- Engineering-wide STOP WORK notification
- Hourly stakeholder updates
- Customer communication if external impact
- Status page updated
- Postmortem shared company-wide

**Recovery Actions**:
- Identify all contributors to budget exhaustion
- Rollback recent changes if causal
- Scale resources if capacity issue
- Implement circuit breakers if cascade failure
- Add compensating controls

**Example Decision**:
```
"ERROR BUDGET EXHAUSTED: -5% remaining. All deployments halted.
Incident Commander appointed. War room active until resolution.
Rollback last 3 deployments immediately. CTO notified. Customer
communication drafted. Mandatory all-hands postmortem Friday."
```

---

## Burn Rate Alert Thresholds

### Multi-Window, Multi-Burn-Rate Alerts

Based on Google SRE best practices, we use overlapping time windows to detect both fast and slow burns.

| Alert Name | Short Window | Long Window | Burn Rate | Time to Exhaustion | Severity | Response Time |
|------------|--------------|-------------|-----------|-------------------|----------|---------------|
| Fast Burn | 1h > 14.4x | 5m > 14.4x | 14.4x | 2 days | Critical | 15 min |
| Medium Burn | 6h > 6x | 30m > 6x | 6x | 5 days | High | 1 hour |
| Slow Burn | 24h > 3x | 2h > 3x | 3x | 10 days | Warning | 4 hours |
| Very Slow Burn | 72h > 1.5x | 6h > 1.5x | 1.5x | 20 days | Info | 1 business day |

### Burn Rate Calculation

```promql
# 1-hour burn rate
slo:service:error_budget:burn_rate_1h = (
  (1 - slo:service:availability:ratio_1h)
  /
  (1 - 0.999)  # SLO target
)

# Multi-window alert
alert: ErrorBudgetFastBurn
expr: |
  slo:service:error_budget:burn_rate_1h > 14.4
  and
  slo:service:error_budget:burn_rate_5m > 14.4
for: 2m
labels:
  severity: critical
```

### Alert Response Playbook

**When Fast Burn Alert Fires**:

1. **Immediate (within 15 minutes)**:
   - Incident Commander assigned
   - War room initiated
   - Identify source of errors (service, endpoint, deployment)
   - Check recent changes (last 1 hour)

2. **Investigation (within 30 minutes)**:
   - Correlate with deployment timeline
   - Check downstream dependencies
   - Analyze error logs and stack traces
   - Assess customer impact

3. **Mitigation (within 1 hour)**:
   - Rollback if deployment-related
   - Scale resources if capacity issue
   - Implement circuit breaker if cascade failure
   - Route traffic if regional issue

4. **Recovery**:
   - Verify burn rate returned to normal
   - Calculate error budget impact
   - Update stakeholders
   - Schedule postmortem

---

## Decision Framework Examples

### Example 1: Feature Launch Decision

**Scenario**: Product wants to launch new multi-tenant workspace feature next Tuesday.

**Analysis**:
```
Current Date: Day 20 of month
Error Budget Status: 55% remaining (23.8 min of 43.2 min budget)
Recent Trend: Stable, no major incidents this month
Feature Risk: Medium (new database queries, UI changes)
```

**Decision**: PROCEED with conditions
- Deploy in canary mode (10% users initially)
- Monitor for 24h before full rollout
- Rollback plan tested
- Engineering Manager approval obtained
- Deploy Tuesday 10am (not Friday)

**Rationale**: 55% budget is healthy (Level 1), medium-risk feature acceptable with canary approach.

---

### Example 2: Hotfix During Budget Exhaustion

**Scenario**: Critical security vulnerability discovered. Error budget at 5% remaining.

**Analysis**:
```
Current Date: Day 25 of month
Error Budget Status: 5% remaining (EXHAUSTED)
Hotfix Risk: Low (isolated code path, well-tested)
Security Impact: High (CVE-2024-XXXX, actively exploited)
```

**Decision**: PROCEED via emergency process
- CTO approval obtained
- Incident Commander coordinates deployment
- Deploy during off-hours (10pm)
- Full war room active
- Automated rollback configured
- Customer communication prepared

**Rationale**: Security hotfixes override error budget policy. Use emergency process to minimize risk.

---

### Example 3: Refactoring vs. Feature Trade-off

**Scenario**: Sprint planning - choose between database refactoring (reduces tech debt) or new analytics feature.

**Analysis**:
```
Current Date: Sprint planning (mid-month)
Error Budget Status: 30% remaining (WARNING)
Recent Incidents: 2 database-related incidents last week
Analytics Feature: Nice-to-have, not customer-committed
Refactoring Benefit: Improves query performance, reduces incident risk
```

**Decision**: Prioritize refactoring (delay analytics)
- Error budget at WARNING level requires reliability focus
- Database incidents consuming budget
- Refactoring directly addresses error budget consumption
- Analytics can wait until budget recovers

**Rationale**: At Level 2 (Warning), reliability work takes precedence over nice-to-have features.

---

## Stakeholder Communication

### Engineering Leadership

**Audience**: VP Engineering, Engineering Managers, Tech Leads

**Frequency**:
- Monthly: SLO compliance report
- Weekly: Error budget status in leadership meeting
- Daily: If in WARNING or CRITICAL state

**Format**:
```
Subject: [SLO STATUS] Error Budget at 35% - WARNING Level

Current Status: WARNING (Level 2)
Error Budget Remaining: 35% (15.1 min of 43.2 min)
Burn Rate: 1.8x (slightly elevated)
Days Remaining in Month: 12

Recent Contributors:
1. CNS Service outage (Dec 15, 2h) - Database connection pool - 10.5% budget
2. Keycloak latency spike (Dec 18, 30m) - Memory leak - 4.2% budget

Actions Taken:
- Deployment freeze for non-critical changes (EM approval required)
- Database connection pool tuning deployed
- Keycloak memory monitoring enhanced

Next Steps:
- Continue deployment freeze until budget > 50%
- Root cause analysis for connection pool issue (due Dec 22)
- Sprint planning to prioritize reliability work

Dashboard: https://grafana.ananta.io/d/slo-overview
```

---

### Product Management

**Audience**: Product Managers, Product Owners

**Frequency**:
- Monthly: SLO report in product sync
- Ad-hoc: If deployment freeze impacts roadmap

**Format**:
```
Subject: Deployment Freeze - Reliability Focus This Week

Hi Product Team,

We've hit our error budget WARNING threshold (35% remaining) due to
database incidents this week. This means we're pausing non-critical
feature deployments to focus on reliability.

Impact on Roadmap:
- Analytics Dashboard (PM-123): Delayed 1 week → Deploy Dec 28
- UI Redesign (PM-456): Delayed 2 weeks → Deploy Jan 4
- Critical Bug Fixes: Proceeding as planned

Why This Matters:
Error budgets represent our commitment to customers. When we consume
budget faster than planned, we risk missing our 99.9% uptime commitment,
which impacts customer trust and contract SLAs.

What We're Doing:
1. Fixing database connection pool issues
2. Adding monitoring to prevent recurrence
3. Reviewing recent changes for reliability impact

Expected Recovery: Dec 26 (when budget > 50%)

Questions? Reach out to SRE team or check real-time status:
https://grafana.ananta.io/d/slo-overview

Thanks for your understanding,
SRE Team
```

---

### Customer Communication (if needed)

**Audience**: Customers (if SLO breach impacts SLA)

**Frequency**: Only if SLO breach exceeds contracted SLA

**Format**:
```
Subject: Service Availability Update - December 2024

Dear Ananta Platform Customers,

We want to inform you of service availability for December 2024:

Service Level: 99.85% (Target: 99.9%)
Downtime: 64.8 minutes (Budget: 43.2 minutes)
Impact: Brief service interruptions on Dec 15 and Dec 18

What Happened:
On December 15, our database connection pool reached capacity during
peak traffic, causing a 2-hour service degradation. We implemented
immediate mitigations and are deploying permanent fixes.

What We're Doing:
1. Increased database connection pool capacity
2. Enhanced monitoring and alerting
3. Conducted thorough root cause analysis
4. Implementing circuit breakers for graceful degradation

SLA Credit (if applicable):
Per our Service Level Agreement, customers on Enterprise plans are
eligible for a 10% service credit. Credits will be applied to your
January invoice automatically.

We sincerely apologize for the inconvenience. Reliability is our top
priority, and we're committed to preventing similar issues.

Full Incident Report: [Link to Postmortem]

Questions? Contact support@ananta.io

Best regards,
Ananta Platform Team
```

---

## Error Budget Attribution

### Tracking Budget Consumption

Attribute error budget consumption to specific causes for learning and prevention:

| Category | Definition | Example | Prevention |
|----------|------------|---------|------------|
| Deployment | Changes causing errors | Bad code deploy | Better testing, canary deploys |
| Dependency | External service failures | AWS outage, Stripe API down | Circuit breakers, retries |
| Capacity | Resource exhaustion | Database connections full | Auto-scaling, capacity planning |
| Configuration | Config errors | Wrong env var, bad feature flag | Config validation, gradual rollout |
| Infrastructure | Hardware/network failures | Disk full, network partition | Redundancy, monitoring |
| User Error | Invalid requests | Malformed API calls | Input validation, rate limiting |
| Unknown | Unexplained errors | Transient failures | Improve observability |

### Monthly Attribution Report

```
Error Budget Attribution - December 2024
Total Budget Consumed: 64.8 minutes (150% of 43.2 min budget)

By Category:
1. Capacity (Database) - 42 minutes (65%)
   - Connection pool exhaustion (Dec 15)
2. Dependency (Keycloak) - 15 minutes (23%)
   - Memory leak causing slowness (Dec 18)
3. Deployment (CNS Service) - 7.8 minutes (12%)
   - Bad release (rolled back in 10 min)

Actionable Insights:
- Capacity issues dominate (65%) → Invest in auto-scaling
- Database is single point of failure → Add read replicas
- Deployment issues low (12%) → CI/CD working well
```

---

## Continuous Improvement

### Quarterly SLO Review

**Agenda**:
1. Review 90-day error budget trend
2. Analyze budget attribution patterns
3. Assess SLO appropriateness (too strict/loose)
4. Identify systemic reliability issues
5. Update SLOs if business priorities changed

**Outputs**:
- Updated SLO targets (if needed)
- Architecture improvements backlog
- Monitoring enhancements
- Error budget policy refinements

### Postmortem Integration

Every SLO breach requires a postmortem:

**Postmortem Template**:
```
Incident: [Name]
Date: [Date]
Duration: [Minutes]
Error Budget Consumed: [X%]

What Happened:
[Timeline of events]

Root Cause:
[Technical root cause]

Contributing Factors:
[Organizational, process, or technical factors]

Impact:
- Customers: [Number affected, severity]
- Error Budget: [Percentage consumed]
- Revenue: [If applicable]

Action Items:
1. [Immediate fix] - Owner: [Name] - Due: [Date]
2. [Long-term prevention] - Owner: [Name] - Due: [Date]

Lessons Learned:
[Key takeaways]
```

---

## Appendix: Policy Enforcement Examples

### Scenario A: Unauthorized Deployment During Freeze

**Situation**: Engineer deploys feature during CRITICAL error budget freeze without VP approval.

**Policy Violation**: Level 3 policy requires VP Engineering approval for all deployments.

**Response**:
1. Immediate rollback of deployment
2. Incident review to assess impact
3. Engineering Manager coaching conversation
4. Policy review in team meeting
5. Update deployment tooling to enforce approval gates

**Lesson**: Automation prevents human error. Implement tooling to enforce policy.

---

### Scenario B: Product Pressure to Deploy

**Situation**: Product Manager pressures team to deploy revenue-critical feature despite exhausted error budget.

**Policy Conflict**: Business urgency vs. reliability commitment

**Resolution**:
1. Escalate to VP Engineering and VP Product
2. Present risk assessment (deploy vs. wait)
3. Joint decision with executive alignment
4. If deployed, implement maximum safeguards:
   - Canary deployment (1% users)
   - Feature flag (instant rollback)
   - Incident Commander on standby
   - Customer communication prepared
5. Document decision rationale

**Lesson**: Error budget policy is not absolute. Executives can override with informed risk acceptance.

---

## Related Documentation

- **SLO Definitions**: `shared-monitoring/docs/SLO-DEFINITIONS.md`
- **Alert Rules**: `shared-monitoring/prometheus/alerts/slos.yml`
- **SLO Dashboards**: `shared-monitoring/grafana/dashboards/slo-dashboard.json`
- **Alerting Guide**: `shared-monitoring/SLO-ALERTING-GUIDE.md`
- **Incident Response**: `docs/INCIDENT-RESPONSE-RUNBOOK.md` (to be created)

---

**Version**: 1.0
**Approved By**: VP Engineering, SRE Team Lead
**Next Review**: 2025-03-21 (Quarterly)
