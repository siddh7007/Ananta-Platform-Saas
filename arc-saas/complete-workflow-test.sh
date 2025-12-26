#!/bin/bash

# Complete Tenant Provisioning Workflow Test
# Tests the entire flow from lead creation to provisioning trigger

set -e

BASE_URL="http://127.0.0.1:14000"
TIMESTAMP=$(date +%s)
SHORT_TS="${TIMESTAMP: -6}"
TEST_EMAIL="test${SHORT_TS}@acme.com"
TEST_KEY="acme${SHORT_TS: -4}"  # Max 10 chars
TEST_COMPANY="Acme Corp"

echo "==========================================="
echo "Complete Tenant Provisioning Workflow Test"
echo "==========================================="
echo ""
echo "Test Configuration:"
echo "  Email: $TEST_EMAIL"
echo "  Tenant Key: $TEST_KEY"
echo "  Company: $TEST_COMPANY"
echo "  Timestamp: $TIMESTAMP"
echo ""

# Step 1: Create Lead
echo "========== STEP 1: Create Lead =========="
LEAD_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/leads" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"firstName\": \"John\",
    \"lastName\": \"Doe\",
    \"companyName\": \"$TEST_COMPANY\",
    \"address\": {
      \"country\": \"US\",
      \"address\": \"100 Main St\",
      \"city\": \"Boston\",
      \"state\": \"MA\",
      \"zip\": \"02101\"
    }
  }")

HTTP_STATUS=$(echo "$LEAD_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
LEAD_BODY=$(echo "$LEAD_RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo "$LEAD_BODY" | jq '.'

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ ERROR: Failed to create lead"
  exit 1
fi

LEAD_ID=$(echo "$LEAD_BODY" | jq -r '.id')
VALIDATION_TOKEN=$(echo "$LEAD_BODY" | jq -r '.key')

echo ""
echo "✅ Lead created successfully"
echo "   Lead ID: $LEAD_ID"
echo "   Validation Token: ${VALIDATION_TOKEN:0:20}..."
echo ""
sleep 1

# Step 2: Verify Lead
echo "========== STEP 2: Verify Lead =========="
VERIFY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/leads/$LEAD_ID/verify" \
  -H "Authorization: Bearer $VALIDATION_TOKEN" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$VERIFY_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
VERIFY_BODY=$(echo "$VERIFY_RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo "$VERIFY_BODY" | jq '.'

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ ERROR: Failed to verify lead"
  exit 1
fi

JWT_TOKEN=$(echo "$VERIFY_BODY" | jq -r '.token')

echo ""
echo "✅ Lead verified successfully"
echo "   JWT Token: ${JWT_TOKEN:0:50}..."
echo ""
sleep 1

# Step 3: Create Tenant from Lead
echo "========== STEP 3: Create Tenant =========="
TENANT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/leads/$LEAD_ID/tenants" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"key\": \"$TEST_KEY\",
    \"name\": \"$TEST_COMPANY\",
    \"domains\": [\"acme.com\"]
  }")

HTTP_STATUS=$(echo "$TENANT_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
TENANT_BODY=$(echo "$TENANT_RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo "$TENANT_BODY" | jq '.'

if [ "$HTTP_STATUS" != "200" ]; then
  echo "⚠️  WARNING: Tenant creation returned non-200 status"
  echo ""
  echo "Checking if this is expected (tenant already exists)..."

  # Try to find tenant ID from database or continue
  TENANT_ID=$(echo "$TENANT_BODY" | jq -r '.id // empty')

  if [ -z "$TENANT_ID" ]; then
    echo "❌ ERROR: Could not create or find tenant"
    echo ""
    echo "Possible causes:"
    echo "1. Tenant already exists for this lead"
    echo "2. Invalid tenant key format"
    echo "3. Permission issue"
    echo ""
    echo "Attempting to decode JWT to find tenant ID..."

    # Decode JWT to get tenant ID
    JWT_PAYLOAD=$(echo "$JWT_TOKEN" | cut -d'.' -f2)
    # Add padding if needed
    while [ $((${#JWT_PAYLOAD} % 4)) -ne 0 ]; do
      JWT_PAYLOAD="${JWT_PAYLOAD}="
    done
    DECODED=$(echo "$JWT_PAYLOAD" | base64 -d 2>/dev/null | jq '.')
    echo "$DECODED"

    TENANT_ID=$(echo "$DECODED" | jq -r '.userTenantId // .id')
    echo ""
    echo "Extracted Tenant/User ID from JWT: $TENANT_ID"
  fi
else
  TENANT_ID=$(echo "$TENANT_BODY" | jq -r '.id')
  TENANT_STATUS=$(echo "$TENANT_BODY" | jq -r '.status')

  echo ""
  echo "✅ Tenant created successfully"
  echo "   Tenant ID: $TENANT_ID"
  echo "   Tenant Status: $TENANT_STATUS"
fi

echo ""
sleep 1

# Step 4: Check Tenant in Database
echo "========== STEP 4: Verify Tenant in Database =========="
echo "Checking PostgreSQL for tenant record..."
TENANT_DB_CHECK=$(docker exec arc-saas-postgres psql -U postgres -d arc_saas -t -c "SELECT id, key, name, status FROM main.tenants WHERE id = '$TENANT_ID' OR lead_id = '$LEAD_ID';" 2>&1)

if echo "$TENANT_DB_CHECK" | grep -q "ERROR"; then
  echo "⚠️  Could not query database"
else
  echo "$TENANT_DB_CHECK"

  if [ -n "$TENANT_DB_CHECK" ] && [ "$TENANT_DB_CHECK" != "" ]; then
    echo "✅ Tenant found in database"
  else
    echo "⚠️  Tenant not found in database for Lead ID: $LEAD_ID"
  fi
fi

echo ""
sleep 1

# Step 5: Trigger Provisioning (will likely fail without admin token)
echo "========== STEP 5: Trigger Provisioning =========="
echo "NOTE: This step requires admin JWT token with ProvisionTenant permission"
echo ""

SUB_ID="sub-${TIMESTAMP}"
PLAN_ID="plan-${TIMESTAMP}"
START_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
END_DATE=$(date -u -d '+1 year' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+1y +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "2026-12-05T00:00:00Z")

PROVISION_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/tenants/$TENANT_ID/provision" \
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
      \"description\": \"Enterprise tier\",
      \"price\": 999.00,
      \"currencyId\": \"usd\",
      \"tier\": \"enterprise\",
      \"billingCycleId\": \"annual\",
      \"metaData\": {
        \"pipelineName\": \"enterprise-pipeline\"
      }
    }
  }")

HTTP_STATUS=$(echo "$PROVISION_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
PROVISION_BODY=$(echo "$PROVISION_RESPONSE" | sed '$d')

echo "Response Status: $HTTP_STATUS"
echo "$PROVISION_BODY" | jq '.'

if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo ""
  echo "✅ Provisioning workflow triggered successfully!"
  echo "   Workflow ID: provision-tenant-$TENANT_ID"
  echo ""
  echo "Monitor workflow:"
  echo "  temporal workflow describe --workflow-id provision-tenant-$TENANT_ID --namespace arc-saas"
  echo "  Temporal UI: http://localhost:8080"
elif [ "$HTTP_STATUS" = "401" ]; then
  echo ""
  echo "⚠️  Provisioning trigger failed: Unauthorized (Expected)"
  echo ""
  echo "This is expected - the lead JWT token doesn't have ProvisionTenant permission."
  echo "To trigger provisioning, you need an admin JWT token."
  echo ""
  echo "Manual trigger command:"
  echo "  curl -X POST \"$BASE_URL/tenants/$TENANT_ID/provision\" \\"
  echo "       -H \"Authorization: Bearer {ADMIN_JWT}\" \\"
  echo "       -H \"Content-Type: application/json\" \\"
  echo "       -d '{...subscription data...}'"
else
  echo ""
  echo "❌ Provisioning trigger failed with status: $HTTP_STATUS"
fi

echo ""
echo "==========================================="
echo "Test Summary"
echo "==========================================="
echo "Lead ID:        $LEAD_ID"
echo "Tenant ID:      $TENANT_ID"
echo "Tenant Key:     $TEST_KEY"
echo "Email:          $TEST_EMAIL"
echo "JWT Token:      ${JWT_TOKEN:0:50}..."
echo ""
echo "Next Steps:"
echo "1. Generate admin JWT token"
echo "2. Trigger provisioning with admin token"
echo "3. Monitor Temporal workflow in UI"
echo "4. Verify Keycloak realm: tenant-$TEST_KEY"
echo "5. Verify admin user in Keycloak: $TEST_EMAIL"
echo "==========================================="
