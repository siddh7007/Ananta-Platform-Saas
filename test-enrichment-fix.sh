#!/bin/bash
# Test enrichment endpoint after fix

echo "=== Getting Fresh Token ==="
TOKEN_RESPONSE=$(curl -s -X POST "http://localhost:8180/realms/ananta-saas/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=cbpadmin" \
  -d "password=Test123!")

TOKEN=$(echo "$TOKEN_RESPONSE" | python -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get access token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "Got token: ${TOKEN:0:50}..."

BOM_ID="ebea1f29-f1f2-4cf5-9444-10ae56db49ed"
ORG_ID="c13f4caa-fee3-4e9b-805c-a8282bfd59ed"

echo ""
echo "=== Testing Enrichment Start Endpoint (with 15s timeout) ==="
echo "BOM_ID: $BOM_ID"
echo "ORG_ID: $ORG_ID"
echo ""

timeout 15 curl -s -X POST "http://localhost:27200/api/boms/${BOM_ID}/enrichment/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"organization_id\": \"$ORG_ID\", \"priority\": 5}"

RESULT=$?
echo ""
if [ $RESULT -eq 124 ]; then
  echo "ERROR: Request timed out after 15 seconds"
  exit 1
elif [ $RESULT -ne 0 ]; then
  echo "ERROR: Request failed with exit code $RESULT"
  exit 1
else
  echo "SUCCESS: Request completed without timeout"
fi

echo ""
echo "=== Test Complete ==="
