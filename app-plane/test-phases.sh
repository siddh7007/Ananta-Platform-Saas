#!/bin/bash
# CNS Projects Alignment - Phase 1-3 Testing Script

echo "==================================================================="
echo "CNS Projects Alignment - Phases 1-3 Testing"
echo "==================================================================="

# Test data from database
PROJECT_ID="2dd7883f-2581-4dd4-90ef-3d429353b7f6"
BOM_ID="ebea1f29-f1f2-4cf5-9444-10ae56db49ed"
WORKSPACE_ID="c13f4caa-fee3-4e9b-805c-a8282bfd59ed"

echo ""
echo "Getting JWT token from Keycloak..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "username=cbpadmin" \
  -d "password=cbpadmin123" \
  -d "grant_type=password")

TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "None" ]; then
    echo "ERROR: Failed to get JWT token"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo "Token received: ${TOKEN:0:50}..."

echo ""
echo "==================================================================="
echo "PHASE 2 TESTING: BOM Read Endpoints"
echo "==================================================================="

echo ""
echo "Test 1: GET /boms/{bom_id}/line_items (with auth)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/line_items?page=1&page_size=5" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data, indent=2)[:500])" 2>/dev/null || echo "Request failed"

echo ""
echo ""
echo "Test 2: GET /boms/{bom_id}/enrichment/status (with auth)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/enrichment/status" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data, indent=2)[:500])" 2>/dev/null || echo "Request failed"

echo ""
echo ""
echo "Test 3: GET /boms/{bom_id}/components (with auth)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/boms/$BOM_ID/components?page=1&page_size=5" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data, indent=2)[:500])" 2>/dev/null || echo "Request failed"

echo ""
echo ""
echo "Test 4: GET /boms/{bom_id}/line_items (WITHOUT auth - should fail 401)"
curl -s "http://localhost:27200/api/boms/$BOM_ID/line_items" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data, indent=2))" 2>/dev/null || echo "Request failed"

echo ""
echo ""
echo "==================================================================="
echo "PHASE 3 TESTING: Workspace Endpoints"
echo "==================================================================="

echo ""
echo "Test 5: GET /workspaces/{workspace_id} (with auth)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:27200/api/workspaces/$WORKSPACE_ID" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data, indent=2)[:500])" 2>/dev/null || echo "Request failed"

echo ""
echo ""
echo "Test 6: GET /workspaces/{workspace_id} (WITHOUT auth - should fail 401)"
curl -s "http://localhost:27200/api/workspaces/$WORKSPACE_ID" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data, indent=2))" 2>/dev/null || echo "Request failed"

echo ""
echo ""
echo "==================================================================="
echo "CHECKING SERVICE LOGS"
echo "==================================================================="

echo ""
echo "Recent BOM operations:"
docker logs app-plane-cns-service 2>&1 | grep -E "\[BOM|bom_id=$BOM_ID" | tail -10

echo ""
echo "Recent Workspace operations:"
docker logs app-plane-cns-service 2>&1 | grep -E "\[Workspaces\]|workspace_id=$WORKSPACE_ID" | tail -10

echo ""
echo "==================================================================="
echo "TESTS COMPLETE"
echo "==================================================================="
