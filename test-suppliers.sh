#!/bin/bash
# Test script for supplier API verification

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
echo "=== 1. Check CNS Service Health ==="
curl -s "http://localhost:27200/health"

echo ""
echo ""
echo "=== 2. Check Available Suppliers ==="
curl -s "http://localhost:27200/api/suppliers/available" -H "Authorization: Bearer $TOKEN"

echo ""
echo ""
echo "=== 3. Check Supplier Health Status ==="
curl -s "http://localhost:27200/api/suppliers/health" -H "Authorization: Bearer $TOKEN"

echo ""
echo ""
echo "=== 4. Test Supplier Search (STM32F407VGT6) ==="
curl -s -X POST "http://localhost:27200/api/suppliers/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mpn": "STM32F407VGT6", "manufacturer": "STMicroelectronics", "limit": 3}'

echo ""
echo ""
echo "=== 5. Test Supplier Details (GET endpoint) ==="
curl -s "http://localhost:27200/api/suppliers/details?mpn=STM32F407VGT6&manufacturer=STMicroelectronics" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== 6. Test Circuit Breaker Status ==="
curl -s "http://localhost:27200/api/suppliers/circuit-breaker/status" -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Supplier API Verification Complete ==="
