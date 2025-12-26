#!/bin/bash
set -e

echo "Provisioning test tenant with notifications..."

# Create tenant in database
echo "1. Creating tenant in database..."
docker exec arc-saas-postgres psql -U postgres -d arc_saas <<SQL
BEGIN;

DELETE FROM main.contacts WHERE tenant_id = 'dd000000-0000-0000-0000-000000000001';
DELETE FROM main.tenants WHERE id = 'dd000000-0000-0000-0000-000000000001';

INSERT INTO main.tenants (id, key, name, status, created_on, modified_on)
VALUES (
  'dd000000-0000-0000-0000-000000000001',
  'testcorp',
  'Test Corporation',
  1,
  NOW(),
  NOW()
);

INSERT INTO main.contacts (
  id, tenant_id, email, first_name, last_name, is_primary, created_on
)
VALUES (
  gen_random_uuid(),
  'dd000000-0000-0000-0000-000000000001',
  'admin@testcorp.com',
  'Test',
  'Admin',
  true,
  NOW()
);

COMMIT;
SQL

echo "✅ Tenant created"

# Generate admin JWT
echo "2. Generating admin JWT..."
cd services/tenant-management-service
ADMIN_JWT=$(node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({id: 'admin', userTenantId: 'admin', permissions: ['10216']}, 'your-jwt-secret-key-here', {expiresIn: '2h', issuer: 'arc-saas'}));")

echo "✅ JWT generated"

# Trigger provisioning
echo "3. Triggering provisioning workflow..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:14000/tenants/dd000000-0000-0000-0000-000000000001/provision" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sub-testcorp-001",
    "subscriberId": "dd000000-0000-0000-0000-000000000001",
    "planId": "plan-enterprise",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2026-01-01T00:00:00Z",
    "status": 1,
    "plan": {
      "id": "plan-enterprise",
      "name": "Enterprise Plan",
      "description": "Enterprise tier",
      "price": 999.00,
      "currencyId": "usd",
      "tier": "enterprise",
      "billingCycleId": "annual",
      "metaData": {
        "pipelineName": "enterprise-pipeline"
      }
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Provisioning started successfully!"
else
  echo "⚠️  Provisioning request returned: $HTTP_CODE"
  echo "Response: $BODY"
fi

echo ""
echo "4. Waiting for workflow to complete (15 seconds)..."
sleep 15

echo ""
echo "5. Checking results..."

# Check tenant status
TENANT_STATUS=$(docker exec arc-saas-postgres psql -U postgres -d arc_saas -t -c "SELECT status FROM main.tenants WHERE id = 'dd000000-0000-0000-0000-000000000001';" | xargs)
echo "Tenant status: $TENANT_STATUS (2 = ACTIVE)"

# Check if Keycloak realm exists
REALM_CHECK=$(curl -s http://localhost:8180/realms/tenant-testcorp/.well-known/openid-configuration | jq -r '.issuer' 2>/dev/null)
if [ "$REALM_CHECK" != "null" ] && [ ! -z "$REALM_CHECK" ]; then
  echo "✅ Keycloak realm created: $REALM_CHECK"
else
  echo "⚠️  Keycloak realm not found (may still be provisioning)"
fi

echo ""
echo "========================================="
echo "✅ Test Tenant Provisioning Complete!"
echo "========================================="
echo ""
echo "Tenant ID: dd000000-0000-0000-0000-000000000001"
echo "Tenant Key: testcorp"
echo "Admin Email: admin@testcorp.com"
echo ""
echo "Check notifications:"
echo "  1. Open Admin Portal: http://localhost:5000"
echo "  2. Login with: admin / admin123"
echo "  3. Look for notification bell 🔔"
echo "  4. Check Novu Dashboard: http://localhost:14200"
echo "=========================================
"
