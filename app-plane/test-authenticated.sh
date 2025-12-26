#!/bin/bash
# CNS Projects Alignment - Authenticated Testing Script

echo "=================================================================="
echo "CNS Projects Alignment - Authenticated Access Testing"
echo "=================================================================="

# Load JWT token
source jwt-token.txt

# Test data from database
PROJECT_ID="2dd7883f-2581-4dd4-90ef-3d429353b7f6"
BOM_ID="ebea1f29-f1f2-4cf5-9444-10ae56db49ed"
WORKSPACE_ID="c13f4caa-fee3-4e9b-805c-a8282bfd59ed"
ORG_ID="a0000000-0000-0000-0000-000000000000"

echo ""
echo "Test Credentials:"
echo "Email: admin@cbp.local"
echo "Password: Test123!@#"
echo "Organization ID: $ORG_ID"
echo "Token: ${TOKEN:0:50}..."
echo ""

echo "=================================================================="
echo "PHASE 2 TESTING: BOM Read Endpoints (WITH AUTH)"
echo "=================================================================="

echo ""
echo "Test 1: GET /boms/{bom_id}/line_items (with auth)"
echo "Response:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/line_items?page=1&page_size=3" \
  | python -m json.tool | head -50

echo ""
echo ""
echo "Test 2: GET /boms/{bom_id}/enrichment/status (with auth)"
echo "Response:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/enrichment/status" \
  | python -m json.tool

echo ""
echo ""
echo "Test 3: GET /boms/{bom_id}/components (with auth)"
echo "Response:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/components?page=1&page_size=3" \
  | python -m json.tool | head -50

echo ""
echo ""
echo "=================================================================="
echo "PHASE 3 TESTING: Workspace Endpoints (WITH AUTH)"
echo "=================================================================="

echo ""
echo "Test 4: GET /workspaces/{workspace_id} (with auth)"
echo "Response:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID" \
  | python -m json.tool

echo ""
echo ""
echo "=================================================================="
echo "CHECKING SERVICE LOGS"
echo "=================================================================="

echo ""
echo "Recent BOM operations:"
docker logs app-plane-cns-service 2>&1 | grep -E "\[BOM" | tail -10

echo ""
echo "Recent Workspace operations:"
docker logs app-plane-cns-service 2>&1 | grep -E "\[Workspaces\]" | tail -10

echo ""
echo "=================================================================="
echo "TESTS COMPLETE"
echo "=================================================================="
