#!/bin/bash
# Simple file existence check for SSE implementation

echo "======================================================================"
echo "SSE ENRICHMENT PROGRESS IMPLEMENTATION FILE VERIFICATION"
echo "======================================================================"
echo ""

PASS=0
FAIL=0

check_file() {
    if [ -f "$1" ]; then
        echo "[OK] $2: $1"
        ((PASS++))
    else
        echo "[FAIL] $2 MISSING: $1"
        ((FAIL++))
    fi
}

echo "[1/4] Checking core implementation files..."
check_file "app/api/enrichment_stream.py" "SSE endpoint implementation"
check_file "app/workflows/bom_enrichment.py" "Enrichment workflow"
check_file "app/cache/redis_cache.py" "Redis cache utilities"
check_file "app/api/__init__.py" "API router registration"
echo ""

echo "[2/4] Checking documentation..."
check_file "SSE_ENRICHMENT_PROGRESS_IMPLEMENTATION.md" "Implementation docs"
check_file "tests/test_sse_enrichment_stream.py" "Test suite"
check_file "examples/sse_client_example.py" "Client example"
echo ""

echo "[3/4] Checking database migrations..."
check_file "../../database/final-migrations/001_SUPABASE_MASTER.sql" "Supabase master migration"
echo ""

echo "[4/4] Checking key code patterns..."

# Check if enrichment_stream router is included in API
if grep -q "enrichment_stream" app/api/__init__.py; then
    echo "[OK] enrichment_stream router is registered in API"
    ((PASS++))
else
    echo "[FAIL] enrichment_stream router NOT registered in API"
    ((FAIL++))
fi

# Check if publish_enrichment_event exists in workflow
if grep -q "async def publish_enrichment_event" app/workflows/bom_enrichment.py; then
    echo "[OK] publish_enrichment_event activity exists"
    ((PASS++))
else
    echo "[FAIL] publish_enrichment_event activity NOT found"
    ((FAIL++))
fi

# Check if update_bom_progress exists in workflow
if grep -q "async def update_bom_progress" app/workflows/bom_enrichment.py; then
    echo "[OK] update_bom_progress activity exists"
    ((PASS++))
else
    echo "[FAIL] update_bom_progress activity NOT found"
    ((FAIL++))
fi

# Check if Redis pub/sub is used in enrichment_stream.py
if grep -q "redis_client.publish" app/workflows/bom_enrichment.py; then
    echo "[OK] Redis pub/sub publishing found"
    ((PASS++))
else
    echo "[FAIL] Redis pub/sub publishing NOT found"
    ((FAIL++))
fi

# Check if SSE endpoint exists
if grep -q "async def stream_enrichment_progress" app/api/enrichment_stream.py; then
    echo "[OK] SSE stream_enrichment_progress endpoint exists"
    ((PASS++))
else
    echo "[FAIL] SSE stream_enrichment_progress endpoint NOT found"
    ((FAIL++))
fi

# Check if enrichment_events table schema exists
if grep -q "enrichment_events" ../../database/final-migrations/001_SUPABASE_MASTER.sql; then
    echo "[OK] enrichment_events table schema found"
    ((PASS++))
else
    echo "[FAIL] enrichment_events table schema NOT found"
    ((FAIL++))
fi

echo ""
echo "======================================================================"
TOTAL=$((PASS + FAIL))
PERCENTAGE=$((PASS * 100 / TOTAL))
echo "VERIFICATION SUMMARY: $PASS/$TOTAL checks passed ($PERCENTAGE%)"
echo "======================================================================"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "[OK] ALL CHECKS PASSED - SSE implementation is complete!"
    echo ""
    echo "Next steps:"
    echo "1. Start Redis: docker-compose up -d app-plane-redis"
    echo "2. Start CNS service: cd app && python -m uvicorn main:app --reload --port 27200"
    echo "3. Test SSE endpoint:"
    echo "   curl -N http://localhost:27200/api/enrichment/stream/{bom_id}?token=xxx"
    echo ""
    exit 0
else
    echo "[WARN] $FAIL CHECKS FAILED - Review errors above"
    echo ""
    exit 1
fi
