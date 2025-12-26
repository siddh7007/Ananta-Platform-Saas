# AlertManager Secrets

This directory contains secret credentials for AlertManager notification integrations.

## IMPORTANT: Security Notice

**NEVER commit actual secrets to version control!**

This directory is git-ignored except for `.gitignore`, `README.md`, and `*.example` files.

## Required Secret Files

Create these files with your actual credentials:

### 1. PagerDuty Integration Key

```bash
echo "your-pagerduty-integration-key" > pagerduty_key
chmod 600 pagerduty_key
```

**How to get it:**
1. Log into PagerDuty
2. Go to **Services** → Select your service
3. Click **Integrations** tab
4. Add integration: **Events API v2**
5. Copy the **Integration Key**

### 2. Slack Webhook URLs

```bash
# Critical alerts channel
echo "https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK" > slack_critical_webhook
chmod 600 slack_critical_webhook

# Warning alerts channel
echo "https://hooks.slack.com/services/YOUR/WARNING/WEBHOOK" > slack_warnings_webhook
chmod 600 slack_warnings_webhook

# SLO alerts channel
echo "https://hooks.slack.com/services/YOUR/SLO/WEBHOOK" > slack_slo_webhook
chmod 600 slack_slo_webhook

# Database alerts channel
echo "https://hooks.slack.com/services/YOUR/DATABASE/WEBHOOK" > slack_database_webhook
chmod 600 slack_database_webhook

# Control Plane alerts channel
echo "https://hooks.slack.com/services/YOUR/CONTROL/WEBHOOK" > slack_control_plane_webhook
chmod 600 slack_control_plane_webhook

# App Plane alerts channel
echo "https://hooks.slack.com/services/YOUR/APP/WEBHOOK" > slack_app_plane_webhook
chmod 600 slack_app_plane_webhook

# Infrastructure alerts channel
echo "https://hooks.slack.com/services/YOUR/INFRA/WEBHOOK" > slack_infrastructure_webhook
chmod 600 slack_infrastructure_webhook
```

**How to get it:**
1. Go to your Slack workspace
2. Visit https://api.slack.com/apps
3. Create a new app or select existing
4. Enable **Incoming Webhooks**
5. Click **Add New Webhook to Workspace**
6. Select channel (e.g., `#critical-alerts`)
7. Copy the webhook URL

## File Permissions

Ensure secret files have restricted permissions:

```bash
chmod 600 secrets/*
```

## Example Files

See `*.example` files for format reference:

```bash
cp pagerduty_key.example pagerduty_key
cp slack_critical_webhook.example slack_critical_webhook
# Edit files with actual credentials
```

## Environment Variables (Alternative)

Instead of files, you can use environment variables in `.env`:

```bash
# In shared-monitoring/.env
PAGERDUTY_KEY=your-key-here
SLACK_CRITICAL_WEBHOOK=https://hooks.slack.com/services/...
SLACK_WARNINGS_WEBHOOK=https://hooks.slack.com/services/...
```

Then update `alertmanager-production.yml` to use environment variables:

```yaml
pagerduty_configs:
  - routing_key: ${PAGERDUTY_KEY}

slack_configs:
  - api_url: ${SLACK_CRITICAL_WEBHOOK}
```

## Verification

Test that AlertManager can read secrets:

```bash
# Check files exist
ls -la /etc/alertmanager/secrets/

# Test AlertManager config
docker exec shared-alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Send test alert
docker exec shared-alertmanager amtool alert add test \
  alertname=TestAlert severity=warning \
  --annotation=summary="Test alert" \
  --alertmanager.url=http://localhost:9093
```

## Rotating Secrets

To rotate credentials:

1. Generate new keys in PagerDuty/Slack
2. Update secret files
3. Reload AlertManager config:

```bash
docker exec shared-alertmanager kill -HUP 1
# OR
docker restart shared-alertmanager
```

## Production Deployment

For production, use a proper secrets management system:

- **AWS Secrets Manager** (if running on AWS)
- **HashiCorp Vault**
- **Kubernetes Secrets** (if using K8s)
- **Docker Secrets** (if using Swarm)

Example with AWS Secrets Manager:

```bash
# Store secret
aws secretsmanager create-secret \
  --name ananta/alertmanager/pagerduty-key \
  --secret-string "your-key"

# Retrieve in container
aws secretsmanager get-secret-value \
  --secret-id ananta/alertmanager/pagerduty-key \
  --query SecretString --output text
```

## Troubleshooting

### Alerts not sending to PagerDuty

1. Check secret file exists:
   ```bash
   docker exec shared-alertmanager cat /etc/alertmanager/secrets/pagerduty_key
   ```

2. Verify AlertManager logs:
   ```bash
   docker logs shared-alertmanager | grep -i pagerduty
   ```

3. Test PagerDuty Events API manually:
   ```bash
   curl -X POST https://events.pagerduty.com/v2/enqueue \
     -H 'Content-Type: application/json' \
     -d '{
       "routing_key": "YOUR_KEY",
       "event_action": "trigger",
       "payload": {
         "summary": "Test alert",
         "severity": "critical",
         "source": "test"
       }
     }'
   ```

### Alerts not sending to Slack

1. Check webhook URL is valid (starts with `https://hooks.slack.com/services/`)
2. Test webhook manually:
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
     -d '{"text":"Test from AlertManager"}' \
     https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```
3. Check Slack app permissions

## References

- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [AlertManager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
