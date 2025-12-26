#!/bin/bash

# Test provisioning with tenant created in database

TENANT_ID="aa000000-0000-0000-0000-000000000001"

# Generate fresh JWT with all permissions
cd services/tenant-management-service
JWT_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({
  id: 'admin-user-id',
  userTenantId: 'admin-user-id',
  permissions: ['10200','10201','10202','10203','10204','10205','10206','10207','10208','10209','10210','10211','10212','10213','10214','10215','10216','10220','10221','10222','10223','7001','7002','7004','7008','5321','5322','5323','5324','5325','5326','5327','5328','5329','5331','5332','5333']
}, 'your-jwt-secret-key-here', {
  expiresIn: '2h',
  issuer: 'arc-saas'
});
console.log(token);
")

echo "JWT Token: $JWT_TOKEN"
echo ""

echo "Triggering provisioning..."
curl -v -X POST "http://127.0.0.1:14000/tenants/${TENANT_ID}/provision" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sub-testcorp-001",
    "subscriberId": "aa000000-0000-0000-0000-000000000001",
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
  }'
