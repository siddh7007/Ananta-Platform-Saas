#!/bin/bash

TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJRZVB1SFJuSmZUWE1VeHhWVUo2R0I4MldpQTRrTmYtVmZYU3ktMXdOLVpVIn0.eyJleHAiOjE3NjYxMzYxMjEsImlhdCI6MTc2NjEzNjA2MSwianRpIjoiNTRhOGYwMWItNGI0My00MmQ4LWJlZTQtYjY1YWY3MDRmM2VlIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MTgwL3JlYWxtcy9tYXN0ZXIiLCJzdWIiOiI2MWE5OGMwNS1mYjcwLTQ4Y2QtYTRmZS0yN2JkNmFjNTJiOGEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJhZG1pbi1jbGkiLCJzZXNzaW9uX3N0YXRlIjoiM2I1MGU5YTAtZGY1Zi00MDRjLWEzZmUtZmRlZjNkOWU0YTYwIiwiYWNyIjoiMSIsInNjb3BlIjoicHJvZmlsZSBlbWFpbCIsInNpZCI6IjNiNTBlOWEwLWRmNWYtNDA0Yy1hM2ZlLWZkZWYzZDllNGE2MCIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWRtaW4ifQ.kQsN8gTw-YYf-NBRfyvwHFzPS-8OI4H1X3CALgSTCcOUXZGGbUMYS1D_7OFrQUZONToJdyQ0qY3cjqDVvnvwaLYpXP5rX3pAq725XTfDyXtnbd0wbzSR88149AssLYn_lGNtAsbeDHqigbNnyJY8k2t5enB3q_uGnFYSTLbcy7lEjtvUpAu0qi3ArohGeDw1TORIMg3KTzSUlvRQ8_JyLNwPk95oJXnhCTVOy5u4EtOQay9U1-z9-4HkUHhKag4sRpLFSmU8hY1pwAOzaXnpV4W9mSF6nDXO-EfkoeGx4CIUsuwvz9JrmvOaDzDS_NFJKyG-gMllWeQhZmcrJBipKg"

echo "==================================================="
echo "Control Plane Integration Tests"
echo "==================================================="
echo ""

echo "[TEST 1] GET /api/control-plane/plans"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/plans \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

echo "[TEST 2] GET /api/control-plane/subscriptions"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/subscriptions \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

echo "[TEST 3] GET /api/control-plane/user-invitations"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/user-invitations \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

echo "[TEST 4] GET /api/control-plane/billing-analytics?endpoint=usage"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "http://localhost:27400/api/control-plane/billing-analytics?endpoint=usage" \
  -H "Authorization: Bearer $TOKEN"
echo "---------------------------------------------------"
echo ""

echo "[TEST 5] GET /api/control-plane/plans (without auth - expect 401)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:27400/api/control-plane/plans
echo "---------------------------------------------------"
echo ""

echo "==================================================="
echo "Tests Complete"
echo "==================================================="
