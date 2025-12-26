#!/bin/bash

# Get fresh token
echo "Getting fresh token..."
TOKEN=$(powershell -ExecutionPolicy Bypass -File "e:/Work/Ananta-Platform-Saas/app-plane/services/dashboard/get-token.ps1" 2>&1 | grep -E "^eyJ" | head -1)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token!"
  exit 1
fi

echo "Token obtained. Running tests..."
echo ""
echo "==================================================="
echo "Control Plane Integration Tests"
echo "==================================================="
echo ""

# Test 1
echo "[TEST 1] GET /api/control-plane/plans"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

# Test 2
echo "[TEST 2] GET /api/control-plane/subscriptions"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/subscriptions \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

# Test 3
echo "[TEST 3] GET /api/control-plane/user-invitations"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/user-invitations \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

# Test 4
echo "[TEST 4] GET /api/control-plane/billing-analytics?endpoint=usage"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "http://localhost:27400/api/control-plane/billing-analytics?endpoint=usage" \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

# Test 5 - No auth (should fail)
echo "[TEST 5] GET /api/control-plane/plans (no auth - expect 401)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/plans
echo "---------------------------------------------------"
echo ""

echo "==================================================="
echo "Tests Complete"
echo "==================================================="