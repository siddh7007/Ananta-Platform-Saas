# ARC-SaaS Deployment Strategies

This document outlines deployment strategies for the ARC-SaaS platform across different environments.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Environment Strategy](#environment-strategy)
3. [Blue-Green Deployment](#blue-green-deployment)
4. [Canary Deployment](#canary-deployment)
5. [Rolling Updates](#rolling-updates)
6. [Database Migrations](#database-migrations)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring & Validation](#monitoring--validation)

---

## Deployment Overview

### Deployment Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Build   │ -> │   Test   │ -> │  Stage   │ -> │   Prod   │
│  & Scan  │    │  & QA    │    │ Validate │    │  Deploy  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     v               v               v               v
  Docker          E2E Tests      Smoke Tests     Health Checks
  Image           Security       Performance     Monitoring
  Push            Scans          Tests           Alerts
```

### Service Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer                            │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         v                    v                    v
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Admin App  │      │  API Layer  │      │  Keycloak   │
│  (Frontend) │      │  (Backend)  │      │   (Auth)    │
└─────────────┘      └─────────────┘      └─────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         v                    v                    v
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Temporal   │      │ PostgreSQL  │      │   Redis     │
│  Workers    │      │  (Primary)  │      │   Cache     │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## Environment Strategy

### Environment Progression

| Environment | Purpose | Deploy Trigger | Approval |
|-------------|---------|----------------|----------|
| **Dev** | Development testing | Push to `develop` | Automatic |
| **Staging** | QA & Integration | Push to `release/*` | Automatic |
| **Production** | Live traffic | Manual trigger | Required |

### Environment Characteristics

#### Development
- Single instance services
- FARGATE_SPOT for cost savings
- No multi-AZ
- Minimal monitoring
- Short data retention

#### Staging
- Production-like configuration
- Multi-instance where critical
- Full monitoring enabled
- Performance testing allowed
- 7-day data retention

#### Production
- Multi-AZ deployment
- Full redundancy
- Comprehensive monitoring
- WAF enabled
- 30-day data retention
- Disaster recovery ready

---

## Blue-Green Deployment

Recommended for **major version releases** with significant changes.

### Architecture

```
                    ┌─────────────────────────┐
                    │     Load Balancer       │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                    │
    ┌─────────▼─────────┐            ┌────────────▼────────────┐
    │   Blue (Current)  │            │    Green (New)          │
    │   v1.0.0          │            │    v2.0.0               │
    │   100% traffic    │            │    0% traffic           │
    │                   │            │    (ready for switch)   │
    └───────────────────┘            └─────────────────────────┘
```

### Steps

1. **Deploy Green Environment**
   ```bash
   # Deploy new version to green environment
   terraform workspace select green
   terraform apply -var="app_version=2.0.0"

   # Or with Helm
   helm upgrade --install arc-saas-green ./charts/tenant-management-service \
     --set image.tag=2.0.0 \
     --set service.name=tenant-management-green
   ```

2. **Validate Green Environment**
   ```bash
   # Run smoke tests against green
   ./scripts/smoke-test.sh https://green.arc-saas.example.com

   # Run integration tests
   npm run test:integration -- --env=green
   ```

3. **Switch Traffic**
   ```bash
   # Update ALB to point to green target group
   aws elbv2 modify-listener \
     --listener-arn $LISTENER_ARN \
     --default-actions Type=forward,TargetGroupArn=$GREEN_TARGET_GROUP
   ```

4. **Monitor & Validate**
   ```bash
   # Watch error rates for 15 minutes
   ./scripts/monitor-deployment.sh --duration=15m
   ```

5. **Decommission Blue** (after validation period)
   ```bash
   terraform workspace select blue
   terraform destroy
   ```

### Rollback
```bash
# Instant rollback - switch back to blue
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions Type=forward,TargetGroupArn=$BLUE_TARGET_GROUP
```

---

## Canary Deployment

Recommended for **incremental rollouts** with risk mitigation.

### Traffic Split Strategy

```
Phase 1:  [████░░░░░░░░░░░░░░░░] 5% → Canary
Phase 2:  [████████░░░░░░░░░░░░] 25% → Canary
Phase 3:  [████████████░░░░░░░░] 50% → Canary
Phase 4:  [████████████████████] 100% → New Version
```

### ECS Implementation

```hcl
# Terraform - ECS Service with weighted routing
resource "aws_ecs_service" "canary" {
  name            = "tenant-management-canary"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.new_version.arn
  desired_count   = 1

  load_balancer {
    target_group_arn = aws_lb_target_group.canary.arn
    container_name   = "app"
    container_port   = 14000
  }
}

# ALB Listener Rule with weighted routing
resource "aws_lb_listener_rule" "weighted" {
  listener_arn = aws_lb_listener.main.arn
  priority     = 100

  action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.stable.arn
        weight = 95
      }

      target_group {
        arn    = aws_lb_target_group.canary.arn
        weight = 5
      }
    }
  }
}
```

### Kubernetes Implementation

```yaml
# Istio VirtualService for canary
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: tenant-management
spec:
  hosts:
    - tenant-management
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: tenant-management-canary
    - route:
        - destination:
            host: tenant-management-stable
          weight: 95
        - destination:
            host: tenant-management-canary
          weight: 5
```

### Automated Canary Analysis

```yaml
# Flagger Canary resource
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: tenant-management
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tenant-management
  progressDeadlineSeconds: 600
  service:
    port: 14000
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 1m
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 1m
```

---

## Rolling Updates

Default strategy for **routine updates** with minimal changes.

### ECS Rolling Update

```hcl
resource "aws_ecs_service" "main" {
  deployment_configuration {
    maximum_percent         = 200  # Allow 2x capacity during deployment
    minimum_healthy_percent = 100  # Keep all tasks running
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true  # Auto-rollback on failure
  }
}
```

### Kubernetes Rolling Update

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0      # No downtime
      maxSurge: 25%          # 25% extra capacity
  minReadySeconds: 30        # Wait 30s before marking ready
  progressDeadlineSeconds: 600
```

---

## Database Migrations

### Migration Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    MIGRATION FLOW                            │
└─────────────────────────────────────────────────────────────┘

1. BACKWARD COMPATIBLE CHANGES FIRST
   ┌──────────────────────────────────────────────────────────┐
   │  Add new columns with defaults                           │
   │  Create new tables                                       │
   │  Add new indexes                                         │
   └──────────────────────────────────────────────────────────┘

2. DEPLOY NEW APPLICATION VERSION
   ┌──────────────────────────────────────────────────────────┐
   │  Application handles both old and new schema             │
   │  Writes to both old and new columns if needed            │
   └──────────────────────────────────────────────────────────┘

3. CLEANUP MIGRATION (after validation)
   ┌──────────────────────────────────────────────────────────┐
   │  Drop old columns                                        │
   │  Remove deprecated tables                                │
   │  Drop unused indexes                                     │
   └──────────────────────────────────────────────────────────┘
```

### Migration Commands

```bash
# Run pending migrations
cd services/tenant-management-service
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Check migration status
npm run migrate:status
```

### Pre-Deployment Checklist

- [ ] Migration tested in staging
- [ ] Rollback plan documented
- [ ] Backup created
- [ ] Estimated downtime (if any)
- [ ] Post-migration validation queries ready

---

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

```bash
#!/bin/bash
# rollback-immediate.sh

# 1. Switch ECS to previous task definition
PREVIOUS_TASK=$(aws ecs describe-services \
  --cluster arc-saas-prod \
  --services tenant-management \
  --query 'services[0].deployments[1].taskDefinition' \
  --output text)

aws ecs update-service \
  --cluster arc-saas-prod \
  --service tenant-management \
  --task-definition $PREVIOUS_TASK \
  --force-new-deployment

# 2. Monitor rollback
aws ecs wait services-stable \
  --cluster arc-saas-prod \
  --services tenant-management
```

### Helm Rollback

```bash
# List release history
helm history arc-saas -n production

# Rollback to previous revision
helm rollback arc-saas 1 -n production

# Rollback to specific revision
helm rollback arc-saas 5 -n production
```

### Database Rollback

```bash
# Rollback last migration
npm run migrate:rollback

# Restore from backup (if needed)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier arc-saas-prod-restored \
  --db-snapshot-identifier arc-saas-prod-pre-deploy-snapshot
```

---

## Monitoring & Validation

### Deployment Metrics to Watch

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | > 1% | Investigate |
| Error Rate | > 5% | Rollback |
| P95 Latency | > 2s | Investigate |
| P99 Latency | > 5s | Rollback |
| CPU Usage | > 80% | Scale up |
| Memory Usage | > 85% | Scale up |

### Health Check Endpoints

```bash
# Application health
curl -s https://api.arc-saas.example.com/health | jq

# Database connectivity
curl -s https://api.arc-saas.example.com/health/db | jq

# Redis connectivity
curl -s https://api.arc-saas.example.com/health/redis | jq

# Temporal connectivity
curl -s https://api.arc-saas.example.com/health/temporal | jq
```

### Post-Deployment Validation Script

```bash
#!/bin/bash
# validate-deployment.sh

echo "Running post-deployment validation..."

# 1. Health check
echo "Checking health endpoint..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://api.arc-saas.example.com/health)
if [ "$HEALTH" != "200" ]; then
  echo "FAILED: Health check returned $HEALTH"
  exit 1
fi

# 2. API smoke test
echo "Running API smoke tests..."
./scripts/smoke-test.sh https://api.arc-saas.example.com

# 3. Check error rate
echo "Checking error rate in CloudWatch..."
ERROR_RATE=$(aws cloudwatch get-metric-statistics \
  --namespace "AWS/ApplicationELB" \
  --metric-name "HTTPCode_Target_5XX_Count" \
  --dimensions Name=LoadBalancer,Value=arc-saas-prod \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text)

if [ "$ERROR_RATE" -gt 10 ]; then
  echo "WARNING: High error rate detected: $ERROR_RATE"
fi

# 4. Synthetic transactions
echo "Running synthetic transactions..."
./scripts/synthetic-test.sh

echo "Deployment validation complete!"
```

### CloudWatch Dashboard

Create a deployment dashboard with:

1. **Request metrics**: Total requests, error rate, latency percentiles
2. **Infrastructure**: CPU, memory, network I/O
3. **Application**: Active connections, queue depth, cache hit rate
4. **Business metrics**: Tenant provisioning time, API response times

### Alerting

```hcl
# Terraform CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "deployment_errors" {
  alarm_name          = "arc-saas-deployment-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "High 5XX error rate during deployment"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}
```

---

## Quick Reference

### Deployment Decision Tree

```
Is this a major version with breaking changes?
├── YES → Blue-Green Deployment
└── NO
    ├── Is this a high-risk change?
    │   ├── YES → Canary Deployment (5% → 25% → 50% → 100%)
    │   └── NO → Rolling Update
    └── Does this include database migrations?
        ├── YES → Ensure backward compatibility first
        └── NO → Standard deployment
```

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | PagerDuty | Immediate |
| Platform Team Lead | Slack #platform | 15 min |
| Database Admin | Slack #dba | 15 min |
| Security Team | Slack #security | If security-related |

---

## Appendix: Terraform Commands

```bash
# Initialize workspace
terraform init

# Select environment
terraform workspace select prod

# Plan changes
terraform plan -var-file=prod.tfvars -out=plan.out

# Apply changes
terraform apply plan.out

# Destroy (with confirmation)
terraform destroy -var-file=prod.tfvars
```

## Appendix: Helm Commands

```bash
# Install/upgrade release
helm upgrade --install arc-saas ./charts/tenant-management-service \
  -f values-prod.yaml \
  -n production

# Check release status
helm status arc-saas -n production

# View release history
helm history arc-saas -n production

# Rollback
helm rollback arc-saas 1 -n production

# Uninstall
helm uninstall arc-saas -n production
```
