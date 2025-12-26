#!/bin/bash
# Control Plane Integration Test Script
# Tests all proxy endpoints with manual verification

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"
TOKEN="${TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo -e "${RED}ERROR: TOKEN environment variable not set${NC}"
  echo ""
  echo "To get a token:"
  echo "1. Login to Keycloak: http://localhost:8180/realms/ananta-saas"
  echo "2. Copy access token from browser DevTools"
  echo "3. Export TOKEN=<your-token>"
  echo ""
  exit 1
fi

echo "================================================"
echo "Control Plane Integration Test"
echo "================================================"
echo "Dashboard URL: $DASHBOARD_URL"
echo "Token: ${TOKEN:0:20}...${TOKEN: -20}"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local expected_status="$5"

  TESTS_RUN=$((TESTS_RUN + 1))

  echo -e "${YELLOW}[TEST $TESTS_RUN] $name${NC}"
  echo "  $method $path"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$DASHBOARD_URL$path" \
      -H "Authorization: Bearer $TOKEN")
  elif [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$DASHBOARD_URL$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  elif [ "$method" = "PATCH" ]; then
    response=$(curl -s -w "\n%{http_code}" -X PATCH "$DASHBOARD_URL$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  elif [ "$method" = "DELETE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$DASHBOARD_URL$path" \
      -H "Authorization: Bearer $TOKEN")
  fi

  # Extract status code (last line)
  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} - Status: $status_code"
    TESTS_PASSED=$((TESTS_PASSED + 1))

    # Show response preview (first 200 chars)
    if [ -n "$body" ]; then
      preview=$(echo "$body" | head -c 200)
      echo "  Response: $preview..."
    fi
  else
    echo -e "  ${RED}✗ FAIL${NC} - Expected: $expected_status, Got: $status_code"
    TESTS_FAILED=$((TESTS_FAILED + 1))

    if [ -n "$body" ]; then
      echo "  Error: $body"
    fi
  fi

  echo ""
}

echo "================================================"
echo "Phase 1: Plans Endpoint"
echo "================================================"
echo ""

test_endpoint \
  "List plans (authenticated)" \
  "GET" \
  "/api/control-plane/plans" \
  "" \
  "200"

test_endpoint \
  "List plans with pagination" \
  "GET" \
  "/api/control-plane/plans?limit=5&skip=0" \
  "" \
  "200"

echo "================================================"
echo "Phase 2: Subscriptions Endpoint"
echo "================================================"
echo ""

test_endpoint \
  "List subscriptions" \
  "GET" \
  "/api/control-plane/subscriptions" \
  "" \
  "200"

test_endpoint \
  "List subscriptions with filters" \
  "GET" \
  "/api/control-plane/subscriptions?status=active&limit=10" \
  "" \
  "200"

# Note: Skipping CREATE/UPDATE/DELETE tests to avoid side effects
echo -e "${YELLOW}[SKIP] Create/Update/Delete subscription tests (would modify data)${NC}"
echo ""

echo "================================================"
echo "Phase 3: User Invitations Endpoint"
echo "================================================"
echo ""

test_endpoint \
  "List invitations" \
  "GET" \
  "/api/control-plane/user-invitations" \
  "" \
  "200"

test_endpoint \
  "List invitations with status filter" \
  "GET" \
  "/api/control-plane/user-invitations?status=pending" \
  "" \
  "200"

# Note: Skipping CREATE/UPDATE/DELETE tests
echo -e "${YELLOW}[SKIP] Create/Update/Delete invitation tests (would modify data)${NC}"
echo ""

echo "================================================"
echo "Phase 4: Billing Analytics Endpoint"
echo "================================================"
echo ""

test_endpoint \
  "Get usage metrics" \
  "GET" \
  "/api/control-plane/billing-analytics?endpoint=usage" \
  "" \
  "200"

# Note: These require super_admin role
echo -e "${YELLOW}[INFO] Revenue/MRR/Churn endpoints require super_admin role${NC}"
echo ""

test_endpoint \
  "Get revenue metrics (may fail if not super_admin)" \
  "GET" \
  "/api/control-plane/billing-analytics?endpoint=revenue" \
  "" \
  "200"

test_endpoint \
  "Get MRR metrics (may fail if not super_admin)" \
  "GET" \
  "/api/control-plane/billing-analytics?endpoint=mrr" \
  "" \
  "200"

test_endpoint \
  "Get churn metrics (may fail if not super_admin)" \
  "GET" \
  "/api/control-plane/billing-analytics?endpoint=churn" \
  "" \
  "200"

echo "================================================"
echo "Phase 5: Error Handling Tests"
echo "================================================"
echo ""

test_endpoint \
  "Request without authentication" \
  "GET" \
  "/api/control-plane/plans" \
  "" \
  "401"

# Override TOKEN temporarily
OLD_TOKEN=$TOKEN
TOKEN=""
curl -s -o /dev/null -w "%{http_code}" "$DASHBOARD_URL/api/control-plane/plans" > /dev/null
TOKEN=$OLD_TOKEN

test_endpoint \
  "Invalid billing endpoint parameter" \
  "GET" \
  "/api/control-plane/billing-analytics?endpoint=invalid" \
  "" \
  "400"

echo "================================================"
echo "Test Summary"
echo "================================================"
echo ""
echo "Total Tests:  $TESTS_RUN"
echo -e "Passed:       ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:       ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
