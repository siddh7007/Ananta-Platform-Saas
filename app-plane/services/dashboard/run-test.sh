#!/bin/bash

# Get fresh token
echo "Getting fresh Keycloak token..."
TOKEN=$(powershell -ExecutionPolicy Bypass -File "e:/Work/Ananta-Platform-Saas/app-plane/services/dashboard/get-token.ps1" 2>&1 | grep -E "^eyJ" | head -1)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token!"
  exit 1
fi

echo "Token obtained. Testing on port 27400..."
echo ""

echo "==================================================="
echo "[TEST 1] GET /api/control-plane/plans"
echo "==================================================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "==================================================="
echo "[TEST 2] GET /api/control-plane/subscriptions"
echo "==================================================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/subscriptions \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "==================================================="
echo "[TEST 3] GET /api/control-plane/user-invitations"
echo "==================================================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/user-invitations \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "==================================================="
echo "[TEST 4] GET /api/control-plane/billing-analytics?endpoint=usage"
echo "==================================================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "http://localhost:27400/api/control-plane/billing-analytics?endpoint=usage" \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "==================================================="
echo "[TEST 5] GET /api/control-plane/plans (no auth - expect 401)"
echo "==================================================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/plans
echo ""

echo "==================================================="
echo "All tests complete!"
echo "==================================================="
