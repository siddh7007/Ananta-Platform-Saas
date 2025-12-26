#!/bin/bash
# =============================================================================
# VPC Endpoints Validation Script
# =============================================================================
# Tests VPC endpoint connectivity and DNS resolution
#
# Usage:
#   ./test-vpc-endpoints.sh <vpc-id> <region>
#   Example: ./test-vpc-endpoints.sh vpc-0123456789abcdef us-east-1
# =============================================================================

set -e

VPC_ID="${1}"
REGION="${2:-us-east-1}"

if [ -z "$VPC_ID" ]; then
    echo "Error: VPC ID required"
    echo "Usage: $0 <vpc-id> [region]"
    exit 1
fi

echo "=========================================="
echo "VPC Endpoints Validation"
echo "=========================================="
echo "VPC ID: $VPC_ID"
echo "Region: $REGION"
echo ""

# -----------------------------------------------------------------------------
# 1. List all VPC endpoints
# -----------------------------------------------------------------------------

echo "[1/5] Listing VPC Endpoints..."
echo "----------------------------------------"

ENDPOINTS=$(aws ec2 describe-vpc-endpoints \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'VpcEndpoints[*].[ServiceName,VpcEndpointType,State,VpcEndpointId]' \
    --output table)

if [ -z "$ENDPOINTS" ]; then
    echo "WARNING: No VPC endpoints found in VPC $VPC_ID"
else
    echo "$ENDPOINTS"
fi
echo ""

# -----------------------------------------------------------------------------
# 2. Check Gateway Endpoints
# -----------------------------------------------------------------------------

echo "[2/5] Validating Gateway Endpoints..."
echo "----------------------------------------"

S3_ENDPOINT=$(aws ec2 describe-vpc-endpoints \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=service-name,Values=com.amazonaws.$REGION.s3" \
    --query 'VpcEndpoints[0].VpcEndpointId' \
    --output text)

if [ "$S3_ENDPOINT" != "None" ]; then
    echo "✓ S3 Gateway Endpoint: $S3_ENDPOINT"
else
    echo "✗ S3 Gateway Endpoint: NOT FOUND"
fi

DYNAMODB_ENDPOINT=$(aws ec2 describe-vpc-endpoints \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=service-name,Values=com.amazonaws.$REGION.dynamodb" \
    --query 'VpcEndpoints[0].VpcEndpointId' \
    --output text)

if [ "$DYNAMODB_ENDPOINT" != "None" ]; then
    echo "✓ DynamoDB Gateway Endpoint: $DYNAMODB_ENDPOINT"
else
    echo "✗ DynamoDB Gateway Endpoint: NOT FOUND"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. Check Interface Endpoints
# -----------------------------------------------------------------------------

echo "[3/5] Validating Interface Endpoints..."
echo "----------------------------------------"

INTERFACE_SERVICES=(
    "ecr.api"
    "ecr.dkr"
    "secretsmanager"
    "logs"
    "ssm"
    "ssmmessages"
    "ec2messages"
    "sts"
)

for service in "${INTERFACE_SERVICES[@]}"; do
    ENDPOINT=$(aws ec2 describe-vpc-endpoints \
        --region "$REGION" \
        --filters "Name=vpc-id,Values=$VPC_ID" "Name=service-name,Values=com.amazonaws.$REGION.$service" \
        --query 'VpcEndpoints[0].[VpcEndpointId,State]' \
        --output text)

    if [ "$ENDPOINT" != "None" ]; then
        ENDPOINT_ID=$(echo "$ENDPOINT" | awk '{print $1}')
        STATE=$(echo "$ENDPOINT" | awk '{print $2}')
        if [ "$STATE" = "available" ]; then
            echo "✓ $service: $ENDPOINT_ID (available)"
        else
            echo "⚠ $service: $ENDPOINT_ID ($STATE)"
        fi
    else
        echo "✗ $service: NOT FOUND"
    fi
done
echo ""

# -----------------------------------------------------------------------------
# 4. Check VPC Endpoint Security Group
# -----------------------------------------------------------------------------

echo "[4/5] Checking VPC Endpoint Security Group..."
echo "----------------------------------------"

# Get security group from any interface endpoint
SG_ID=$(aws ec2 describe-vpc-endpoints \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=vpc-endpoint-type,Values=Interface" \
    --query 'VpcEndpoints[0].Groups[0].GroupId' \
    --output text)

if [ "$SG_ID" != "None" ]; then
    echo "Security Group ID: $SG_ID"
    echo ""
    echo "Ingress Rules:"
    aws ec2 describe-security-groups \
        --region "$REGION" \
        --group-ids "$SG_ID" \
        --query 'SecurityGroups[0].IpPermissions[*].[IpProtocol,FromPort,ToPort,IpRanges[0].CidrIp]' \
        --output table
    echo ""
else
    echo "✗ No security group found for interface endpoints"
fi

# -----------------------------------------------------------------------------
# 5. Cost Estimation
# -----------------------------------------------------------------------------

echo "[5/5] Cost Estimation (Monthly)"
echo "----------------------------------------"

# Count endpoints
GATEWAY_COUNT=$(aws ec2 describe-vpc-endpoints \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=vpc-endpoint-type,Values=Gateway" \
    --query 'length(VpcEndpoints)' \
    --output text)

INTERFACE_COUNT=$(aws ec2 describe-vpc-endpoints \
    --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=vpc-endpoint-type,Values=Interface" \
    --query 'length(VpcEndpoints)' \
    --output text)

GATEWAY_COST=0
INTERFACE_BASE_COST=$(echo "$INTERFACE_COUNT * 7.30" | bc)

echo "Gateway Endpoints: $GATEWAY_COUNT (FREE)"
echo "Interface Endpoints: $INTERFACE_COUNT"
echo ""
echo "Estimated Monthly Costs:"
echo "  - Gateway Endpoints: \$0.00 (FREE)"
echo "  - Interface Endpoints (base): \$$INTERFACE_BASE_COST"
echo "  - Data Processing: \$0.01/GB (variable)"
echo ""
echo "Total Base Cost: \$$INTERFACE_BASE_COST/month"
echo ""
echo "Note: Data processing charges are additional at \$0.01/GB"
echo "      NAT Gateway costs: \$0.045/GB + \$32.85/month"
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo "=========================================="
echo "Validation Complete"
echo "=========================================="
echo ""
echo "To test DNS resolution from an ECS task:"
echo "  1. Connect to an ECS task:"
echo "     aws ecs execute-command --cluster <cluster-name> \\"
echo "       --task <task-id> --container <container-name> \\"
echo "       --interactive --command '/bin/bash'"
echo ""
echo "  2. Test endpoint DNS:"
echo "     nslookup ecr.api.$REGION.amazonaws.com"
echo "     # Should return private IP (10.0.x.x)"
echo ""
echo "  3. Test connectivity:"
echo "     curl -I https://ecr.api.$REGION.amazonaws.com"
echo ""
