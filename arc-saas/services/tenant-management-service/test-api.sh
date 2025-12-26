#!/bin/bash
# API Test Script for Tenant Management Service
# Run with: bash test-api.sh

BASE_URL="http://localhost:14000"
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtYWRtaW4taWQiLCJ1c2VyVGVuYW50SWQiOiJ0ZXN0LWFkbWluLWlkIiwicGVybWlzc2lvbnMiOlsiMTAyMDAiLCIxMDIwMSIsIjEwMjAyIiwiMTAyMDMiLCIxMDIwNCIsIjEwMjA1IiwiMTAyMDYiLCIxMDIwNyIsIjEwMjE2IiwiMTAyMDgiLCIxMDIwOSIsIjEwMjEwIiwiMTAyMTEiLCIxMDIxMiIsIjEwMjEzIiwiMTAyMTQiLCIxMDIxNSIsIjcwMDEiLCI3MDAyIiwiNzAwNCIsIjcwMDgiLCIxMDIyMCIsIjEwMjIxIiwiMTAyMjIiLCIxMDIyMyIsIjEwMzAwIiwiMTAzMDEiLCIxMDMwMiIsIjEwMzAzIiwiMTAzMDQiLCIxMDMwNSIsIjEwMzA2IiwiMTAzMTAiLCIxMDMxMSIsIjEwMzEyIiwiMTAzMTMiLCIxMDMyMCIsIjEwMzIxIiwiMTAzMjIiLCIxMDMyMyIsIjEwMzI0IiwiMTAzMzAiLCI1MzIxIiwiNTMyMiIsIjUzMjMiLCI1MzI0IiwiNTMyNSIsIjUzMjYiLCI1MzI3IiwiNTMyOCIsIjUzMjkiLCI1MzMxIiwiNTMzMiIsIjUzMzMiXSwiaWF0IjoxNzY1MTE4NTU3LCJleHAiOjE4NjUxMjIxNTcsImlzcyI6ImFyYy1zYWFzIn0.qWgUIE8YlSH5IY3DFA0xrURDZtSTkP9HHYMpWH98BPY"

PASSED=0
FAILED=0

test_endpoint() {
    local method=$1
    local path=$2
    local auth=$3
    local expected_status=$4
    local body=$5

    if [ "$auth" = "true" ]; then
        if [ -n "$body" ]; then
            RESPONSE=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$path" \
                -H "Authorization: Bearer $JWT_TOKEN" \
                -H "Content-Type: application/json" \
                -d "$body")
        else
            RESPONSE=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$path" \
                -H "Authorization: Bearer $JWT_TOKEN" \
                -H "Content-Type: application/json")
        fi
    else
        if [ -n "$body" ]; then
            RESPONSE=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$path" \
                -H "Content-Type: application/json" \
                -d "$body")
        else
            RESPONSE=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$path" \
                -H "Content-Type: application/json")
        fi
    fi

    STATUS_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$expected_status" == *","* ]]; then
        # Multiple expected statuses
        if echo "$expected_status" | grep -q "$STATUS_CODE"; then
            echo "[PASS] $method $path -> $STATUS_CODE"
            ((PASSED++))
        else
            echo "[FAIL] $method $path -> $STATUS_CODE (expected: $expected_status)"
            ((FAILED++))
        fi
    else
        if [ "$STATUS_CODE" = "$expected_status" ]; then
            echo "[PASS] $method $path -> $STATUS_CODE"
            ((PASSED++))
        else
            echo "[FAIL] $method $path -> $STATUS_CODE (expected: $expected_status)"
            echo "       Response: $(echo $BODY | head -c 200)"
            ((FAILED++))
        fi
    fi
}

echo "=========================================="
echo "  TENANT MANAGEMENT SERVICE API TESTS"
echo "=========================================="
echo ""

echo "=== PUBLIC ENDPOINTS ==="
test_endpoint "GET" "/health" "false" "200"
test_endpoint "GET" "/ping" "false" "200"
test_endpoint "GET" "/plans" "false" "200"
test_endpoint "GET" "/plans/count" "false" "200"
test_endpoint "GET" "/plans/plan-basic" "false" "200,404"
test_endpoint "GET" "/leads/verify" "false" "400"

echo ""
echo "=== TENANTS ENDPOINTS (Auth Required) ==="
test_endpoint "GET" "/tenants" "true" "200"
test_endpoint "GET" "/tenants/count" "true" "200"
test_endpoint "GET" "/tenants/by-key/testcorp" "true" "200,404,204"
test_endpoint "GET" "/tenants" "false" "401"

echo ""
echo "=== LEADS ENDPOINTS ==="
test_endpoint "GET" "/leads" "true" "200"
test_endpoint "GET" "/leads/count" "true" "200"

echo ""
echo "=== SUBSCRIPTIONS ENDPOINTS ==="
test_endpoint "GET" "/subscriptions" "true" "200"
test_endpoint "GET" "/subscriptions/count" "true" "200"

echo ""
echo "=== INVOICES ENDPOINTS ==="
test_endpoint "GET" "/invoices" "true" "200"
test_endpoint "GET" "/invoices/count" "true" "200"

echo ""
echo "=== USERS ENDPOINTS ==="
test_endpoint "GET" "/users" "true" "200"
test_endpoint "GET" "/users/count" "true" "200"

echo ""
echo "=== TENANT-USERS ENDPOINTS ==="
test_endpoint "GET" "/tenant-users" "true" "200"
test_endpoint "GET" "/tenant-users/count" "true" "200"

echo ""
echo "=== USER-INVITATIONS ENDPOINTS ==="
test_endpoint "GET" "/user-invitations" "true" "200"
test_endpoint "GET" "/user-invitations/count" "true" "200"
test_endpoint "GET" "/user-invitations/by-token/invalid" "false" "404"

echo ""
echo "=== WORKFLOWS ENDPOINTS ==="
test_endpoint "GET" "/workflows" "true" "200"
test_endpoint "GET" "/workflows/count" "true" "200"

echo ""
echo "=== BILLING ANALYTICS ENDPOINTS ==="
test_endpoint "GET" "/billing/metrics" "true" "200"
test_endpoint "GET" "/billing/invoices" "true" "200"
test_endpoint "GET" "/billing/revenue-by-plan" "true" "200"
test_endpoint "GET" "/billing/monthly-revenue" "true" "200"
test_endpoint "GET" "/billing/subscription-growth" "true" "200"

echo ""
echo "=== SETTINGS ENDPOINTS ==="
test_endpoint "GET" "/settings" "true" "200"
test_endpoint "GET" "/settings/count" "true" "200"

echo ""
echo "=== LEAD CREATION TEST ==="
TIMESTAMP=$(date +%s)
test_endpoint "POST" "/leads" "false" "200,201" "{\"firstName\":\"Test\",\"lastName\":\"User\",\"email\":\"test-$TIMESTAMP@example.com\",\"companyName\":\"Test Company $TIMESTAMP\"}"

echo ""
echo "=== SETTING CREATION TEST ==="
test_endpoint "POST" "/settings" "true" "200,201" "{\"configKey\":\"test.key.$TIMESTAMP\",\"configValue\":\"test-value\",\"valueType\":\"string\",\"category\":\"test\"}"

echo ""
echo "=========================================="
echo "  TEST RESULTS"
echo "=========================================="
echo "PASSED: $PASSED"
echo "FAILED: $FAILED"
echo "TOTAL:  $((PASSED + FAILED))"
echo "=========================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
exit 0
