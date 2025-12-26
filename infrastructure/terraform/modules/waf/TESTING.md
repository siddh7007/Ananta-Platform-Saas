# WAF Module Testing Guide

## Pre-Deployment Validation

### 1. Terraform Validation

```bash
cd infrastructure/terraform/modules/waf

# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Format check
terraform fmt -check -recursive

# Security scan with tfsec
tfsec .

# Security scan with checkov
checkov -d .
```

### 2. Example Testing

```bash
# Test basic example
cd examples/basic
terraform init
terraform plan -var="certificate_arn=arn:aws:acm:..."

# Test advanced example
cd ../advanced
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform plan
```

## Post-Deployment Testing

### 1. Verify WAF Association

```bash
# Check WAF association with ALB
aws wafv2 list-web-acls --scope REGIONAL --region us-east-1

# Get Web ACL details
aws wafv2 get-web-acl \
  --scope REGIONAL \
  --id <web-acl-id> \
  --name <web-acl-name> \
  --region us-east-1

# List associated resources
aws wafv2 list-resources-for-web-acl \
  --web-acl-arn <web-acl-arn> \
  --region us-east-1
```

### 2. Test Rate Limiting

```bash
# Install hey for load testing
# macOS: brew install hey
# Linux: go install github.com/rakyll/hey@latest

# Test with normal load (should succeed)
hey -n 100 -c 10 https://your-alb-endpoint.com/

# Test rate limiting (should get blocked)
hey -n 3000 -c 100 -q 100 https://your-alb-endpoint.com/

# Expected: Some requests return 429 (Too Many Requests)
```

### 3. Test SQL Injection Protection

```bash
# Test SQLi attempt (should be blocked)
curl -v "https://your-alb-endpoint.com/?id=1' OR '1'='1"

# Expected: 403 Forbidden response
# Check WAF logs for BLOCK action
```

### 4. Test IP Blocking

```bash
# If you added your IP to blocked list
curl -v https://your-alb-endpoint.com/

# Expected: 403 Forbidden response

# Verify in CloudWatch Logs
aws logs filter-log-events \
  --log-group-name aws-waf-logs-<name-prefix> \
  --filter-pattern "BLOCK" \
  --region us-east-1
```

### 5. Monitor CloudWatch Metrics

```bash
# Get allowed requests count
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name AllowedRequests \
  --dimensions Name=WebACL,Value=<web-acl-name> Name=Region,Value=us-east-1 Name=Rule,Value=ALL \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region us-east-1

# Get blocked requests count
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=WebACL,Value=<web-acl-name> Name=Region,Value=us-east-1 Name=Rule,Value=ALL \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region us-east-1
```

### 6. Analyze WAF Logs

```bash
# Query CloudWatch Logs Insights
aws logs start-query \
  --log-group-name aws-waf-logs-<name-prefix> \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string '
    fields @timestamp, httpRequest.clientIp, action, terminatingRuleId
    | filter action = "BLOCK"
    | stats count() by terminatingRuleId
  ' \
  --region us-east-1

# Get query results
aws logs get-query-results \
  --query-id <query-id> \
  --region us-east-1
```

### 7. Test Alarm Functionality

```bash
# Trigger high blocked requests alarm
# Run load test that exceeds threshold
hey -n 5000 -c 200 https://your-alb-endpoint.com/?malicious=payload

# Check alarm state
aws cloudwatch describe-alarms \
  --alarm-names <name-prefix>-waf-blocked-requests-high \
  --region us-east-1

# Verify SNS notification (check email)
```

## Automated Testing Scripts

### test-waf-rules.sh

```bash
#!/bin/bash
set -e

ALB_ENDPOINT="${1}"
if [ -z "$ALB_ENDPOINT" ]; then
  echo "Usage: $0 <alb-endpoint>"
  exit 1
fi

echo "Testing WAF protection for: $ALB_ENDPOINT"

# Test 1: Normal request (should succeed)
echo -n "Test 1 - Normal request: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$ALB_ENDPOINT/")
if [ "$STATUS" -eq 200 ]; then
  echo "PASS (200)"
else
  echo "FAIL ($STATUS)"
fi

# Test 2: SQL Injection (should block)
echo -n "Test 2 - SQL Injection: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$ALB_ENDPOINT/?id=1' OR '1'='1")
if [ "$STATUS" -eq 403 ]; then
  echo "PASS (403 Blocked)"
else
  echo "FAIL ($STATUS - Expected 403)"
fi

# Test 3: XSS Attempt (should block)
echo -n "Test 3 - XSS Attempt: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$ALB_ENDPOINT/?name=<script>alert('xss')</script>")
if [ "$STATUS" -eq 403 ]; then
  echo "PASS (403 Blocked)"
else
  echo "FAIL ($STATUS - Expected 403)"
fi

# Test 4: Large Body (should block if > limit)
echo -n "Test 4 - Large Body: "
PAYLOAD=$(python3 -c "print('A' * 10000)")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -d "$PAYLOAD" "https://$ALB_ENDPOINT/")
if [ "$STATUS" -eq 403 ] || [ "$STATUS" -eq 413 ]; then
  echo "PASS ($STATUS Blocked)"
else
  echo "INFO ($STATUS - May not be blocked depending on limits)"
fi

echo "WAF testing complete"
```

### monitor-waf-metrics.sh

```bash
#!/bin/bash

WEB_ACL_NAME="${1}"
REGION="${2:-us-east-1}"

if [ -z "$WEB_ACL_NAME" ]; then
  echo "Usage: $0 <web-acl-name> [region]"
  exit 1
fi

echo "Monitoring WAF metrics for: $WEB_ACL_NAME"
echo "Region: $REGION"
echo ""

while true; do
  ALLOWED=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/WAFV2 \
    --metric-name AllowedRequests \
    --dimensions Name=WebACL,Value=$WEB_ACL_NAME Name=Region,Value=$REGION Name=Rule,Value=ALL \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum \
    --region $REGION \
    --output text \
    --query 'Datapoints[0].Sum')

  BLOCKED=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/WAFV2 \
    --metric-name BlockedRequests \
    --dimensions Name=WebACL,Value=$WEB_ACL_NAME Name=Region,Value=$REGION Name=Rule,Value=ALL \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum \
    --region $REGION \
    --output text \
    --query 'Datapoints[0].Sum')

  clear
  echo "WAF Metrics (Last 5 minutes)"
  echo "=============================="
  echo "Allowed Requests: ${ALLOWED:-0}"
  echo "Blocked Requests: ${BLOCKED:-0}"
  echo ""
  echo "Updated: $(date)"
  echo "Press Ctrl+C to exit"

  sleep 30
done
```

## Integration Testing

### Terraform Test (Experimental)

Create `tests/waf_test.tftest.hcl`:

```hcl
run "setup" {
  command = apply

  variables {
    name_prefix = "test-waf"
    alb_arn     = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test/1234567890"
    rate_limit  = 1000
  }
}

run "verify_waf_created" {
  command = plan

  assert {
    condition     = output.web_acl_id != ""
    error_message = "WAF Web ACL was not created"
  }

  assert {
    condition     = output.web_acl_capacity > 0
    error_message = "WAF capacity should be greater than 0"
  }
}

run "verify_logging" {
  command = plan

  variables {
    enable_logging = true
  }

  assert {
    condition     = output.log_group_name != null
    error_message = "Log group should be created when logging is enabled"
  }
}
```

Run tests:
```bash
terraform test
```

## Performance Testing

### Load Test with ab (Apache Bench)

```bash
# Install ab
# Ubuntu: sudo apt-get install apache2-utils
# macOS: brew install apache2-utils

# Normal load
ab -n 1000 -c 10 https://your-alb-endpoint.com/

# Heavy load (test rate limiting)
ab -n 5000 -c 100 https://your-alb-endpoint.com/
```

### Load Test with wrk

```bash
# Install wrk
# macOS: brew install wrk
# Linux: git clone https://github.com/wg/wrk && make

# 30 second test, 10 threads, 100 connections
wrk -t10 -c100 -d30s https://your-alb-endpoint.com/

# With custom script for POST requests
wrk -t10 -c100 -d30s -s post.lua https://your-alb-endpoint.com/
```

## Cleanup

```bash
# Destroy test resources
cd examples/advanced
terraform destroy

# Verify WAF deletion
aws wafv2 list-web-acls --scope REGIONAL --region us-east-1
```

## Troubleshooting

### False Positives

If legitimate requests are blocked:

1. Check WAF logs for the blocking rule
2. Review the request pattern
3. Add exclusions to the rule (requires module enhancement)
4. Adjust rate limits if needed

### No Metrics

If metrics aren't showing:

1. Verify WAF association: `aws wafv2 list-resources-for-web-acl`
2. Check if requests are reaching ALB
3. Ensure CloudWatch metrics are enabled in WAF config
4. Wait 5-10 minutes for metrics to propagate

### Logs Not Appearing

If logs aren't in CloudWatch:

1. Verify logging configuration is enabled
2. Check log group exists
3. Verify IAM permissions for WAF to write to CloudWatch
4. Generate some traffic to trigger logging

## Cost Estimation

Run cost estimation before deployment:

```bash
# Install infracost
# macOS: brew install infracost
# Linux: curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh

# Generate cost estimate
infracost breakdown --path .

# Compare with previous state
infracost diff --path .
```

Expected monthly costs:
- Web ACL: $5
- Rules (6 managed + 1 custom): $7
- Requests (1M): $0.60
- CloudWatch Logs (10GB): ~$5
- **Total**: ~$18/month (excluding request costs)
