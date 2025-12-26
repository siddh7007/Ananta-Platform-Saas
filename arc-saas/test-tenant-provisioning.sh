#!/bin/bash

# Tenant Provisioning Test Script
# This script tests the complete tenant provisioning flow

set -e

BASE_URL="http://127.0.0.1:14000"
TIMESTAMP=$(date +%s)
# Tenant key must be max 10 characters, lowercase alphanumeric only
SHORT_TS="${TIMESTAMP: -6}"
TEST_EMAIL="admin-test-${TIMESTAMP}@testcorp.com"
TEST_KEY="test${SHORT_TS}"
TEST_COMPANY="TestCorp ${TIMESTAMP}"

echo "========================================="
echo "Tenant Provisioning Test"
echo "========================================="
echo ""
echo "Test Parameters:"
echo "  Email: $TEST_EMAIL"
echo "  Tenant Key: $TEST_KEY"
echo "  Company: $TEST_COMPANY"
echo ""

# Step 1: Create Lead
echo "Step 1: Creating Lead..."
LEAD_RESPONSE=$(curl -s -X POST "$BASE_URL/leads" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"firstName\": \"Test\",
    \"lastName\": \"Admin\",
    \"companyName\": \"$TEST_COMPANY\",
    \"address\": {
      \"country\": \"US\",
      \"address\": \"123 Test St\",
      \"city\": \"Seattle\",
      \"state\": \"WA\",
      \"zip\": \"98101\"
    }
  }")

echo "$LEAD_RESPONSE" | jq
LEAD_ID=$(echo "$LEAD_RESPONSE" | jq -r '.id')
VALIDATION_TOKEN=$(echo "$LEAD_RESPONSE" | jq -r '.key')

if [ "$LEAD_ID" = "null" ]; then
  echo "ERROR: Failed to create lead"
  exit 1
fi

echo ""
echo "✅ Lead created successfully"
echo "   Lead ID: $LEAD_ID"
echo "   Validation Token: ${VALIDATION_TOKEN:0:20}..."
echo ""

# Step 2: Verify Lead
echo "Step 2: Verifying Lead..."
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/leads/$LEAD_ID/verify" \
  -H "Authorization: Bearer $VALIDATION_TOKEN" \
  -H "Content-Type: application/json")

echo "$VERIFY_RESPONSE" | jq
JWT_TOKEN=$(echo "$VERIFY_RESPONSE" | jq -r '.token')

if [ "$JWT_TOKEN" = "null" ]; then
  echo "ERROR: Failed to verify lead"
  exit 1
fi

echo ""
echo "✅ Lead verified successfully"
echo "   JWT Token: ${JWT_TOKEN:0:50}..."
echo ""

# Step 3: Create Tenant
echo "Step 3: Creating Tenant..."
TENANT_RESPONSE=$(curl -s -X POST "$BASE_URL/leads/$LEAD_ID/tenants" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"key\": \"$TEST_KEY\",
    \"domains\": [\"testcorp.com\"]
  }")

echo "$TENANT_RESPONSE" | jq
TENANT_ID=$(echo "$TENANT_RESPONSE" | jq -r '.id')

if [ "$TENANT_ID" = "null" ]; then
  echo "ERROR: Failed to create tenant"
  echo "Response: $TENANT_RESPONSE"
  exit 1
fi

TENANT_STATUS=$(echo "$TENANT_RESPONSE" | jq -r '.status')

echo ""
echo "✅ Tenant created successfully"
echo "   Tenant ID: $TENANT_ID"
echo "   Tenant Status: $TENANT_STATUS"
echo ""

# Step 4: Trigger Provisioning
echo "Step 4: Triggering Provisioning Workflow..."
echo "NOTE: This requires admin JWT token with ProvisionTenant permission"
echo ""

# Generate subscription data
SUB_ID=$(uuidgen 2>/dev/null || echo "sub-$(date +%s)")
PLAN_ID=$(uuidgen 2>/dev/null || echo "plan-$(date +%s)")
START_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
END_DATE=$(date -u -d '+1 year' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+1y +%Y-%m-%dT%H:%M:%SZ)

echo "Subscription Details:"
echo "  Subscription ID: $SUB_ID"
echo "  Plan ID: $PLAN_ID"
echo "  Start Date: $START_DATE"
echo "  End Date: $END_DATE"
echo ""

# Attempt to trigger provisioning (this may fail due to permission requirements)
PROVISION_RESPONSE=$(curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/provision" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$SUB_ID\",
    \"subscriberId\": \"$TENANT_ID\",
    \"planId\": \"$PLAN_ID\",
    \"startDate\": \"$START_DATE\",
    \"endDate\": \"$END_DATE\",
    \"status\": 1,
    \"plan\": {
      \"id\": \"$PLAN_ID\",
      \"name\": \"Enterprise Plan\",
      \"description\": \"Enterprise tier for testing\",
      \"price\": 999.00,
      \"currencyId\": \"usd\",
      \"tier\": \"enterprise\",
      \"billingCycleId\": \"annual\",
      \"metaData\": {
        \"pipelineName\": \"enterprise-pipeline\"
      }
    }
  }")

echo "$PROVISION_RESPONSE" | jq

if echo "$PROVISION_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo ""
  echo "⚠️  Provisioning trigger failed (expected - requires admin token)"
  echo ""
  echo "To trigger provisioning manually:"
  echo "  1. Generate an admin JWT token with ProvisionTenant permission"
  echo "  2. Run: curl -X POST \"$BASE_URL/tenants/$TENANT_ID/provision\" \\"
  echo "          -H \"Authorization: Bearer {ADMIN_JWT}\" \\"
  echo "          -H \"Content-Type: application/json\" \\"
  echo "          -d '{...subscription data...}'"
else
  echo ""
  echo "✅ Provisioning workflow triggered successfully"
  echo "   Workflow ID: provision-tenant-$TENANT_ID"
  echo ""
  echo "Monitor workflow:"
  echo "  temporal workflow describe --workflow-id provision-tenant-$TENANT_ID --namespace arc-saas"
fi

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Lead ID: $LEAD_ID"
echo "Tenant ID: $TENANT_ID"
echo "Tenant Key: $TEST_KEY"
echo "Tenant Status: $TENANT_STATUS"
echo ""
echo "Next Steps:"
echo "1. Check Temporal UI: http://localhost:8080"
echo "2. Search for workflow: provision-tenant-$TENANT_ID"
echo "3. Check Keycloak for realm: tenant-$TEST_KEY"
echo "4. Verify admin user in Keycloak: $TEST_EMAIL"
echo "========================================="
