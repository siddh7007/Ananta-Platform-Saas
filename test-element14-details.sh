#!/bin/bash
# Test script for Element14 API detailed data extraction

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

echo ""
echo "=== Test Element14 Supplier Details (STM32F407VGT6) ==="
curl -s "http://localhost:27200/api/suppliers/details?mpn=STM32F407VGT6&manufacturer=STMicroelectronics&supplier=element14" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

echo ""
echo "=== Test Element14 Supplier Details (172287-1103 - Connector) ==="
curl -s "http://localhost:27200/api/suppliers/details?mpn=172287-1103&manufacturer=Molex&supplier=element14" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

echo ""
echo "=== Element14 Details Test Complete ==="
