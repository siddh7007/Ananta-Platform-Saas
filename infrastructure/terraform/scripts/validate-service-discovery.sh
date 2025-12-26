#!/bin/bash
# =============================================================================
# Service Discovery Validation Script
# =============================================================================
# This script validates AWS Cloud Map service discovery deployment
# and tests DNS resolution from ECS tasks.
#
# Usage:
#   ./validate-service-discovery.sh <environment> <cluster-name>
#
# Example:
#   ./validate-service-discovery.sh dev ananta-dev-cluster
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-dev}"
CLUSTER_NAME="${2:-ananta-${ENVIRONMENT}-cluster}"
REGION="${AWS_REGION:-us-east-1}"
NAMESPACE_NAME="${ENVIRONMENT}-ananta.local"

# Expected services
SERVICES=(
    "tenant-management-service:14000"
    "cns-service:27200"
    "orchestrator-service:14001"
    "subscription-service:14002"
    "keycloak:8080"
    "temporal:7233"
    "temporal-ui:8080"
    "novu:3000"
)

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}Service Discovery Validation - Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Function: Print status
# -----------------------------------------------------------------------------
print_status() {
    local status=$1
    local message=$2

    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✓${NC} $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $message"
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗${NC} $message"
    else
        echo -e "${BLUE}→${NC} $message"
    fi
}

# -----------------------------------------------------------------------------
# Step 1: Check AWS CLI
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    print_status "FAIL" "AWS CLI not found. Please install it first."
    exit 1
fi
print_status "OK" "AWS CLI installed"

if ! command -v jq &> /dev/null; then
    print_status "WARN" "jq not found. Install for better output formatting."
fi

echo ""

# -----------------------------------------------------------------------------
# Step 2: Verify Cloud Map Namespace
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 2: Verifying Cloud Map namespace...${NC}"

NAMESPACE_ID=$(aws servicediscovery list-namespaces \
    --region "$REGION" \
    --query "Namespaces[?Name=='${NAMESPACE_NAME}'].Id" \
    --output text 2>/dev/null || echo "")

if [ -z "$NAMESPACE_ID" ]; then
    print_status "FAIL" "Namespace '${NAMESPACE_NAME}' not found"
    echo ""
    echo "Run 'terraform apply' to create the service discovery infrastructure."
    exit 1
fi

print_status "OK" "Namespace found: ${NAMESPACE_NAME}"
print_status "INFO" "Namespace ID: ${NAMESPACE_ID}"

echo ""

# -----------------------------------------------------------------------------
# Step 3: Verify Service Discovery Services
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 3: Verifying registered services...${NC}"

REGISTERED_SERVICES=$(aws servicediscovery list-services \
    --region "$REGION" \
    --filters "Name=NAMESPACE_ID,Values=${NAMESPACE_ID}" \
    --query "Services[].Name" \
    --output text)

SERVICE_COUNT=$(echo "$REGISTERED_SERVICES" | wc -w)
print_status "INFO" "Found ${SERVICE_COUNT} registered services"

for service_entry in "${SERVICES[@]}"; do
    service_name="${service_entry%%:*}"

    if echo "$REGISTERED_SERVICES" | grep -q "$service_name"; then
        print_status "OK" "Service registered: ${service_name}"
    else
        print_status "FAIL" "Service NOT registered: ${service_name}"
    fi
done

echo ""

# -----------------------------------------------------------------------------
# Step 4: Check Service Instances
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 4: Checking service instances...${NC}"

for service_entry in "${SERVICES[@]}"; do
    service_name="${service_entry%%:*}"

    SERVICE_ID=$(aws servicediscovery list-services \
        --region "$REGION" \
        --filters "Name=NAMESPACE_ID,Values=${NAMESPACE_ID}" \
        --query "Services[?Name=='${service_name}'].Id" \
        --output text 2>/dev/null || echo "")

    if [ -z "$SERVICE_ID" ]; then
        print_status "WARN" "${service_name}: Service not found"
        continue
    fi

    INSTANCE_COUNT=$(aws servicediscovery list-instances \
        --region "$REGION" \
        --service-id "$SERVICE_ID" \
        --query "Instances | length(@)" \
        --output text 2>/dev/null || echo "0")

    if [ "$INSTANCE_COUNT" -gt 0 ]; then
        print_status "OK" "${service_name}: ${INSTANCE_COUNT} instance(s) registered"
    else
        print_status "WARN" "${service_name}: No instances registered"
    fi
done

echo ""

# -----------------------------------------------------------------------------
# Step 5: Verify ECS Cluster
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 5: Verifying ECS cluster...${NC}"

CLUSTER_EXISTS=$(aws ecs describe-clusters \
    --region "$REGION" \
    --clusters "$CLUSTER_NAME" \
    --query "clusters[0].clusterName" \
    --output text 2>/dev/null || echo "None")

if [ "$CLUSTER_EXISTS" = "None" ] || [ -z "$CLUSTER_EXISTS" ]; then
    print_status "FAIL" "ECS cluster '${CLUSTER_NAME}' not found"
    exit 1
fi

print_status "OK" "ECS cluster found: ${CLUSTER_NAME}"

RUNNING_TASKS=$(aws ecs list-tasks \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --desired-status RUNNING \
    --query "taskArns | length(@)" \
    --output text 2>/dev/null || echo "0")

print_status "INFO" "Running tasks: ${RUNNING_TASKS}"

echo ""

# -----------------------------------------------------------------------------
# Step 6: Test DNS Resolution (if possible)
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 6: Testing DNS resolution from ECS task...${NC}"

# Get a running task from tenant-management service
TASK_ARN=$(aws ecs list-tasks \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --service-name "${ENVIRONMENT}-ananta-tenant-management" \
    --desired-status RUNNING \
    --query "taskArns[0]" \
    --output text 2>/dev/null || echo "None")

if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
    print_status "WARN" "No running tasks found for tenant-management service"
    print_status "INFO" "Skipping DNS resolution tests"
else
    print_status "OK" "Found running task: ${TASK_ARN}"

    # Check if ECS Exec is enabled
    EXEC_ENABLED=$(aws ecs describe-services \
        --region "$REGION" \
        --cluster "$CLUSTER_NAME" \
        --services "${ENVIRONMENT}-ananta-tenant-management" \
        --query "services[0].enableExecuteCommand" \
        --output text 2>/dev/null || echo "false")

    if [ "$EXEC_ENABLED" = "true" ]; then
        print_status "OK" "ECS Exec enabled - can test DNS resolution"

        echo ""
        echo -e "${YELLOW}To test DNS resolution manually, run:${NC}"
        echo ""
        echo "aws ecs execute-command \\"
        echo "  --region ${REGION} \\"
        echo "  --cluster ${CLUSTER_NAME} \\"
        echo "  --task ${TASK_ARN} \\"
        echo "  --container tenant-management-service \\"
        echo "  --interactive \\"
        echo "  --command \"/bin/sh\""
        echo ""
        echo "Then inside the container:"
        echo "  nslookup keycloak.${NAMESPACE_NAME}"
        echo "  curl http://keycloak.${NAMESPACE_NAME}:8080/health"
    else
        print_status "WARN" "ECS Exec not enabled - cannot test DNS resolution"
        print_status "INFO" "Enable ECS Exec to test DNS from tasks"
    fi
fi

echo ""

# -----------------------------------------------------------------------------
# Step 7: Summary
# -----------------------------------------------------------------------------
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

if [ -n "$NAMESPACE_ID" ]; then
    echo -e "${GREEN}✓ Cloud Map namespace configured${NC}"
else
    echo -e "${RED}✗ Cloud Map namespace NOT configured${NC}"
fi

if [ "$SERVICE_COUNT" -ge 8 ]; then
    echo -e "${GREEN}✓ All expected services registered${NC}"
else
    echo -e "${YELLOW}⚠ Only ${SERVICE_COUNT}/8 services registered${NC}"
fi

if [ "$RUNNING_TASKS" -gt 0 ]; then
    echo -e "${GREEN}✓ ECS tasks running${NC}"
else
    echo -e "${YELLOW}⚠ No ECS tasks running${NC}"
fi

echo ""
echo -e "${BLUE}Service Discovery Endpoints:${NC}"
for service_entry in "${SERVICES[@]}"; do
    service_name="${service_entry%%:*}"
    port="${service_entry##*:}"
    echo "  • http://${service_name}.${NAMESPACE_NAME}:${port}"
done

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Update application environment variables to use service discovery endpoints"
echo "  2. Redeploy ECS services with updated configuration"
echo "  3. Test inter-service communication"
echo "  4. Monitor CloudWatch Logs for errors"

echo ""
echo -e "${GREEN}Validation complete!${NC}"
