#!/bin/bash
# SSE Enrichment Stream Test Script (curl-based)
# Usage: ./test-sse-enrichment.sh <bom_id> [token]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
CNS_API_URL="${CNS_API_URL:-http://localhost:27200}"
BOM_ID="${1}"
TOKEN="${2}"
TIMEOUT=300

# Validate arguments
if [ -z "$BOM_ID" ]; then
    echo -e "${RED}ERROR: BOM ID required${NC}"
    echo "Usage: $0 <bom_id> [token]"
    echo ""
    echo "Examples:"
    echo "  $0 abc123-def456-ghi789"
    echo "  $0 abc123-def456-ghi789 your-admin-token"
    echo "  $0 abc123-def456-ghi789 eyJhbGciOiJSUzI1NiIs..."
    exit 1
fi

# Print header
echo -e "${BLUE}${BOLD}============================================================${NC}"
echo -e "${BLUE}${BOLD}SSE Enrichment Stream Test (curl)${NC}"
echo -e "${BLUE}${BOLD}============================================================${NC}"
echo ""
echo -e "${BLUE}BOM ID:${NC} $BOM_ID"
echo -e "${BLUE}API URL:${NC} $CNS_API_URL"
echo -e "${BLUE}Timeout:${NC} ${TIMEOUT}s"
echo ""

# Build stream URL
STREAM_URL="${CNS_API_URL}/api/enrichment/stream/${BOM_ID}"
if [ -n "$TOKEN" ]; then
    STREAM_URL="${STREAM_URL}?token=${TOKEN}"
    echo -e "${BLUE}Auth:${NC} Token provided (${#TOKEN} chars)"
else
    echo -e "${YELLOW}WARNING: No token provided - authentication will fail${NC}"
fi
echo ""

# Test health endpoint first
echo -e "${YELLOW}Testing health endpoint...${NC}"
HEALTH_URL="${CNS_API_URL}/api/enrichment/health"
HTTP_CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" "$HEALTH_URL" 2>&1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}  Status: OK${NC}"
    cat /tmp/health.json | grep -o '"status":"[^"]*"' | sed 's/"status":"/  Status: /' | sed 's/"$//'
    cat /tmp/health.json | grep -o '"redis":"[^"]*"' | sed 's/"redis":"/  Redis: /' | sed 's/"$//'
else
    echo -e "${RED}  Health check failed: HTTP $HTTP_CODE${NC}"
    cat /tmp/health.json 2>/dev/null || echo ""
fi
rm -f /tmp/health.json
echo ""

# Connect to SSE stream
echo -e "${YELLOW}Connecting to SSE stream...${NC}"
echo -e "${BLUE}URL: $STREAM_URL${NC}"
echo ""
echo -e "${BLUE}${BOLD}============================================================${NC}"
echo -e "${GREEN}Streaming events (press Ctrl+C to stop):${NC}"
echo -e "${BLUE}${BOLD}============================================================${NC}"
echo ""

# Use curl with --no-buffer for SSE streaming
# -N/--no-buffer disables buffering for real-time output
# -H "Accept: text/event-stream" sets proper SSE headers
curl -N \
    -H "Accept: text/event-stream" \
    -H "Cache-Control: no-cache" \
    --max-time "$TIMEOUT" \
    "$STREAM_URL" 2>&1 | while IFS= read -r line; do

    # Parse SSE format
    if [[ "$line" =~ ^event:\ (.+)$ ]]; then
        # Event line
        EVENT_TYPE="${BASH_REMATCH[1]}"
        echo -e "\n${BOLD}[Event: $EVENT_TYPE]${NC}"

    elif [[ "$line" =~ ^data:\ (.+)$ ]]; then
        # Data line
        DATA="${BASH_REMATCH[1]}"

        # Try to pretty-print JSON
        if command -v jq &> /dev/null; then
            echo "$DATA" | jq '.' 2>/dev/null || echo "  $DATA"
        else
            echo "  $DATA"
        fi

        # Extract key info for known events
        if echo "$DATA" | grep -q '"event_type":"enrichment.started"'; then
            TOTAL=$(echo "$DATA" | grep -o '"total_items":[0-9]*' | grep -o '[0-9]*')
            echo -e "${GREEN}  Starting enrichment of $TOTAL items${NC}"

        elif echo "$DATA" | grep -q '"event_type":"progress"'; then
            ENRICHED=$(echo "$DATA" | grep -o '"enriched_items":[0-9]*' | grep -o '[0-9]*' | head -1)
            TOTAL=$(echo "$DATA" | grep -o '"total_items":[0-9]*' | grep -o '[0-9]*' | head -1)
            PERCENT=$(echo "$DATA" | grep -o '"percent_complete":[0-9.]*' | grep -o '[0-9.]*')
            echo -e "${GREEN}  Progress: $ENRICHED/$TOTAL ($PERCENT%)${NC}"

        elif echo "$DATA" | grep -q '"event_type":"enrichment.completed"'; then
            echo -e "${GREEN}${BOLD}  Enrichment completed successfully!${NC}"

        elif echo "$DATA" | grep -q '"event_type":"enrichment.failed"'; then
            ERROR=$(echo "$DATA" | grep -o '"error":"[^"]*"' | sed 's/"error":"//' | sed 's/"$//')
            echo -e "${RED}${BOLD}  Enrichment failed: $ERROR${NC}"

        elif echo "$DATA" | grep -q '"type":"stream_end"'; then
            echo -e "${YELLOW}  Stream ended by server${NC}"
        fi

    elif [[ "$line" =~ ^:\ keepalive$ ]]; then
        # Keepalive comment (don't print)
        :

    elif [[ -n "$line" ]]; then
        # Other line
        echo "  $line"
    fi
done

echo ""
echo -e "${BLUE}${BOLD}============================================================${NC}"
echo -e "${GREEN}Stream test completed${NC}"
echo -e "${BLUE}${BOLD}============================================================${NC}"
