# Secrets Rotation Quick Reference

Quick command reference for managing secrets rotation in Ananta Platform SaaS.

## Common Operations

### Check Rotation Status

```bash
# List all secrets with rotation status
aws secretsmanager list-secrets \
  --region us-east-1 \
  --query 'SecretList[?contains(Name, `ananta`)].{Name:Name,Rotation:RotationEnabled,NextRotation:NextRotationDate}' \
  --output table
```

### Manually Trigger Rotation

```bash
# Rotate specific secret
aws secretsmanager rotate-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1

# Rotate all database secrets
for SECRET in control-plane-db app-plane-db components-db; do
  aws secretsmanager rotate-secret \
    --secret-id "ananta/prod/${SECRET}" \
    --region us-east-1
done
```

### View Secret Value

```bash
# Get full secret as JSON
aws secretsmanager get-secret-value \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq

# Get just password
aws secretsmanager get-secret-value \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.password'

# Get connection string
aws secretsmanager get-secret-value \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1 \
  --query 'SecretString' \
  --output text | jq -r '.connection_string'
```

### View Rotation Logs

```bash
# Tail logs (follow)
aws logs tail /aws/lambda/prod-secrets-rotation \
  --follow \
  --region us-east-1

# View last 100 lines
aws logs tail /aws/lambda/prod-secrets-rotation \
  --since 1h \
  --region us-east-1

# Filter errors only
aws logs tail /aws/lambda/prod-secrets-rotation \
  --since 1h \
  --filter-pattern "ERROR" \
  --region us-east-1
```

### Check Lambda Status

```bash
# Get Lambda configuration
aws lambda get-function \
  --function-name prod-secrets-rotation \
  --region us-east-1

# Check VPC configuration
aws lambda get-function-configuration \
  --function-name prod-secrets-rotation \
  --region us-east-1 \
  --query 'VpcConfig'

# List recent invocations
aws lambda list-invocations \
  --function-name prod-secrets-rotation \
  --region us-east-1
```

## Troubleshooting

### Rotation Stuck

```bash
# Cancel rotation
aws secretsmanager cancel-rotate-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1

# Wait 5 minutes, then retry
sleep 300
aws secretsmanager rotate-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1
```

### Application Can't Connect

```bash
# Check current version
aws secretsmanager describe-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1 \
  --query 'VersionIdsToStages'

# Test database connection
DB_HOST=$(aws secretsmanager get-secret-value \
  --secret-id "ananta/prod/control-plane-db" \
  --query 'SecretString' --output text | jq -r '.host')
DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id "ananta/prod/control-plane-db" \
  --query 'SecretString' --output text | jq -r '.password')

psql -h $DB_HOST -U postgres -d arc_saas -c "SELECT 1"
# Enter $DB_PASS when prompted
```

### Rollback to Previous Version

```bash
# Get previous version ID
PREVIOUS=$(aws secretsmanager describe-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --region us-east-1 \
  --query 'VersionIdsToStages[?contains(Value, `AWSPREVIOUS`)].Key | [0]' \
  --output text)

# Move AWSCURRENT to previous version
aws secretsmanager update-secret-version-stage \
  --secret-id "ananta/prod/control-plane-db" \
  --version-stage AWSCURRENT \
  --move-to-version-id $PREVIOUS \
  --region us-east-1

# Restart affected services
aws ecs update-service \
  --cluster prod-cluster \
  --service tenant-management-service \
  --force-new-deployment
```

### Check Lambda Permissions

```bash
# Get Lambda role
ROLE_NAME=$(aws lambda get-function-configuration \
  --function-name prod-secrets-rotation \
  --query 'Role' --output text | cut -d'/' -f2)

# List role policies
aws iam list-role-policies \
  --role-name $ROLE_NAME

# Get inline policy
aws iam get-role-policy \
  --role-name $ROLE_NAME \
  --policy-name prod-secrets-rotation-policy
```

### View CloudWatch Metrics

```bash
# Rotation function invocations (last 24h)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=prod-secrets-rotation \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Errors (last 24h)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=prod-secrets-rotation \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Monitoring

### Set Up Alerts

```bash
# Create SNS topic
aws sns create-topic \
  --name secrets-rotation-alerts \
  --region us-east-1

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:secrets-rotation-alerts \
  --protocol email \
  --notification-endpoint ops@example.com

# Create alarm for failures
aws cloudwatch put-metric-alarm \
  --alarm-name secrets-rotation-failures \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=prod-secrets-rotation \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:secrets-rotation-alerts
```

### Dashboard Query

```bash
# Get rotation success rate (last 7 days)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=prod-secrets-rotation \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum \
  --query 'Datapoints[*].[Timestamp,Sum]' \
  --output table
```

## Maintenance

### Update Rotation Schedule

```bash
# Change rotation to every 60 days
aws secretsmanager rotate-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --rotation-rules AutomaticallyAfterDays=60 \
  --region us-east-1
```

### Disable Rotation

```bash
# Disable automatic rotation
aws secretsmanager delete-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --force-delete-without-recovery \
  --region us-east-1

# Note: This deletes the secret. To just disable rotation,
# use Terraform to set enable_rotation = false
```

### Update Lambda Code

```bash
# Rebuild layer
cd infrastructure/terraform/modules/secrets/lambda
./build-layer.sh

# Update Lambda via Terraform
cd ../../../environments/prod
terraform apply -target=module.secrets.aws_lambda_function.rotation
```

### Test Connection from Lambda VPC

```bash
# Create test Lambda in same VPC
cat > test-connection.py <<'EOF'
import psycopg2
import json

def lambda_handler(event, context):
    conn = psycopg2.connect(
        host=event['host'],
        port=event['port'],
        database=event['database'],
        user=event['user'],
        password=event['password']
    )
    with conn.cursor() as cur:
        cur.execute('SELECT version()')
        version = cur.fetchone()[0]
    conn.close()
    return {'statusCode': 200, 'body': json.dumps({'version': version})}
EOF

# Test invoke
aws lambda invoke \
  --function-name test-db-connection \
  --payload '{"host":"db.example.com","port":5432,"database":"arc_saas","user":"postgres","password":"SECRET"}' \
  response.json
```

## Security

### Audit Secret Access

```bash
# Get CloudTrail events for secret access
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=ananta/prod/control-plane-db \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --region us-east-1 \
  --query 'Events[*].[EventTime,EventName,Username]' \
  --output table
```

### Rotate KMS Key

```bash
# Create new key version (automatic)
aws kms create-key \
  --description "Secrets Manager encryption key v2" \
  --region us-east-1

# Update secret to use new key
aws secretsmanager update-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --kms-key-id "arn:aws:kms:us-east-1:ACCOUNT_ID:key/NEW_KEY_ID" \
  --region us-east-1
```

### Review IAM Permissions

```bash
# List who can access secrets
aws iam get-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/prod-secrets-access-policy \
  --version-id v1 \
  --query 'PolicyVersion.Document' \
  --output json | jq

# List roles attached to policy
aws iam list-entities-for-policy \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/prod-secrets-access-policy
```

## Emergency Procedures

### Complete Rotation Failure

```bash
# 1. Disable rotation
aws secretsmanager cancel-rotate-secret \
  --secret-id "ananta/prod/control-plane-db"

# 2. Manually change password in database
psql -h $DB_HOST -U postgres -d arc_saas -c "ALTER USER postgres WITH PASSWORD 'NEW_SECURE_PASSWORD'"

# 3. Update secret with new password
aws secretsmanager put-secret-value \
  --secret-id "ananta/prod/control-plane-db" \
  --secret-string "{\"host\":\"$DB_HOST\",\"port\":5432,\"dbname\":\"arc_saas\",\"username\":\"postgres\",\"password\":\"NEW_SECURE_PASSWORD\"}"

# 4. Restart applications
aws ecs update-service --cluster prod-cluster --service tenant-management-service --force-new-deployment
```

### Compromised Credentials

```bash
# 1. Immediate rotation
aws secretsmanager rotate-secret \
  --secret-id "ananta/prod/control-plane-db" \
  --rotation-rules AutomaticallyAfterDays=1

# 2. Review access logs
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=ananta/prod/control-plane-db \
  --start-time $(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S)

# 3. Revoke old versions
# (Old versions auto-expire, but can force delete)

# 4. Notify security team
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:security-alerts \
  --message "SECURITY: Database credentials rotated due to compromise"
```

## Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Secrets Manager
alias sm-list='aws secretsmanager list-secrets --region us-east-1'
alias sm-get='aws secretsmanager get-secret-value --region us-east-1 --secret-id'
alias sm-rotate='aws secretsmanager rotate-secret --region us-east-1 --secret-id'
alias sm-logs='aws logs tail /aws/lambda/prod-secrets-rotation --follow --region us-east-1'

# Functions
sm-password() {
  aws secretsmanager get-secret-value \
    --secret-id "$1" \
    --region us-east-1 \
    --query 'SecretString' \
    --output text | jq -r '.password'
}

sm-status() {
  aws secretsmanager describe-secret \
    --secret-id "$1" \
    --region us-east-1 \
    --query '{Rotation:RotationEnabled,Next:NextRotationDate,LastRotation:LastRotatedDate}'
}
```

## Additional Resources

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Rotation Lambda Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [PostgreSQL ALTER USER](https://www.postgresql.org/docs/current/sql-alteruser.html)
- [Ananta Platform Runbooks](../../docs/runbooks/)

---

**Last Updated**: 2025-12-21
