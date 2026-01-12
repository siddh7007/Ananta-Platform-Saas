#!/bin/bash
# ==============================================================================
# RabbitMQ Streams Initialization Script
# ==============================================================================
# This script creates the required RabbitMQ streams and exchanges for the
# Ananta Platform BOM processing workflow.
#
# Usage:
#   ./init-streams.sh [RABBITMQ_HOST] [RABBITMQ_USER] [RABBITMQ_PASS]
#
# Environment Variables (optional):
#   RABBITMQ_HOST - RabbitMQ hostname (default: localhost or rabbitmq)
#   RABBITMQ_MANAGEMENT_PORT - Management API port (default: 15672)
#   RABBITMQ_USER - Username (default: guest)
#   RABBITMQ_PASS - Password (default: guest)
#
# Required Streams:
#   1. stream.platform.admin     - Platform admin notifications
#   2. stream.platform.bom       - BOM workflow updates
#   3. stream.bom.progress       - Real-time BOM processing progress
#   4. stream.enrichment.updates - Component enrichment progress
#   5. stream.workflow.events    - Temporal workflow status events
#   6. stream.webhook.events     - External webhook delivery
#
# Required Exchanges:
#   1. platform.events          - Fanout exchange for platform-wide events
# ==============================================================================

set -e

# Configuration
RABBITMQ_HOST="${RABBITMQ_HOST:-${1:-rabbitmq}}"
RABBITMQ_MANAGEMENT_PORT="${RABBITMQ_MANAGEMENT_PORT:-15672}"
RABBITMQ_USER="${RABBITMQ_USER:-${2:-guest}}"
RABBITMQ_PASS="${RABBITMQ_PASS:-${3:-guest}}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for RabbitMQ to be ready
wait_for_rabbitmq() {
    local max_attempts=30
    local attempt=0

    log_info "Waiting for RabbitMQ at ${RABBITMQ_HOST}:${RABBITMQ_MANAGEMENT_PORT}..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf -u "${RABBITMQ_USER}:${RABBITMQ_PASS}" \
           "http://${RABBITMQ_HOST}:${RABBITMQ_MANAGEMENT_PORT}/api/overview" > /dev/null 2>&1; then
            log_success "RabbitMQ is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        log_info "Attempt $attempt/$max_attempts - waiting 2s..."
        sleep 2
    done

    log_error "RabbitMQ not ready after $max_attempts attempts"
    return 1
}

# Create a stream queue
create_stream() {
    local stream_name=$1
    local description=$2

    log_info "Creating stream: $stream_name"

    local response=$(curl -sf -u "${RABBITMQ_USER}:${RABBITMQ_PASS}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d '{"auto_delete":false,"durable":true,"arguments":{"x-queue-type":"stream"}}' \
        "http://${RABBITMQ_HOST}:${RABBITMQ_MANAGEMENT_PORT}/api/queues/%2F/${stream_name}" \
        -w "%{http_code}" -o /dev/null 2>/dev/null)

    case $response in
        201|204)
            log_success "Created: $stream_name ($description)"
            return 0
            ;;
        409)
            log_warning "Already exists: $stream_name"
            return 0
            ;;
        *)
            log_error "Failed to create $stream_name (HTTP $response)"
            return 1
            ;;
    esac
}

# Create an exchange
create_exchange() {
    local exchange_name=$1
    local exchange_type=$2
    local description=$3

    log_info "Creating exchange: $exchange_name ($exchange_type)"

    local response=$(curl -sf -u "${RABBITMQ_USER}:${RABBITMQ_PASS}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d "{\"type\":\"${exchange_type}\",\"auto_delete\":false,\"durable\":true}" \
        "http://${RABBITMQ_HOST}:${RABBITMQ_MANAGEMENT_PORT}/api/exchanges/%2F/${exchange_name}" \
        -w "%{http_code}" -o /dev/null 2>/dev/null)

    case $response in
        201|204)
            log_success "Created exchange: $exchange_name ($description)"
            return 0
            ;;
        409)
            log_warning "Exchange already exists: $exchange_name"
            return 0
            ;;
        *)
            log_error "Failed to create exchange $exchange_name (HTTP $response)"
            return 1
            ;;
    esac
}

# Create binding between exchange and stream
create_binding() {
    local exchange_name=$1
    local queue_name=$2
    local routing_key=$3

    log_info "Creating binding: $exchange_name -> $queue_name (key: $routing_key)"

    local response=$(curl -sf -u "${RABBITMQ_USER}:${RABBITMQ_PASS}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"routing_key\":\"${routing_key}\"}" \
        "http://${RABBITMQ_HOST}:${RABBITMQ_MANAGEMENT_PORT}/api/bindings/%2F/e/${exchange_name}/q/${queue_name}" \
        -w "%{http_code}" -o /dev/null 2>/dev/null)

    case $response in
        201|204)
            log_success "Created binding: $exchange_name -> $queue_name"
            return 0
            ;;
        *)
            log_error "Failed to create binding (HTTP $response)"
            return 1
            ;;
    esac
}

# Main execution
echo "=============================================="
echo " RabbitMQ Streams Initialization"
echo "=============================================="
echo "Host: ${RABBITMQ_HOST}:${RABBITMQ_MANAGEMENT_PORT}"
echo ""

# Wait for RabbitMQ
wait_for_rabbitmq || exit 1

# Track failures
FAILURES=0

# Create exchanges
log_info "Creating exchanges..."
create_exchange "platform.events" "fanout" "Platform-wide event broadcast" || FAILURES=$((FAILURES + 1))
create_exchange "bom.events" "topic" "BOM-specific events with routing" || FAILURES=$((FAILURES + 1))
create_exchange "enrichment.events" "topic" "Enrichment workflow events" || FAILURES=$((FAILURES + 1))

echo ""

# Create streams
log_info "Creating streams..."
create_stream "stream.platform.admin" "Platform admin notifications" || FAILURES=$((FAILURES + 1))
create_stream "stream.platform.bom" "BOM workflow updates" || FAILURES=$((FAILURES + 1))
create_stream "stream.bom.progress" "Real-time BOM processing progress" || FAILURES=$((FAILURES + 1))
create_stream "stream.enrichment.updates" "Component enrichment progress" || FAILURES=$((FAILURES + 1))
create_stream "stream.workflow.events" "Temporal workflow status events" || FAILURES=$((FAILURES + 1))
create_stream "stream.webhook.events" "External webhook delivery" || FAILURES=$((FAILURES + 1))

echo ""

# Create bindings
log_info "Creating bindings..."
create_binding "platform.events" "stream.platform.admin" "" || FAILURES=$((FAILURES + 1))
create_binding "platform.events" "stream.platform.bom" "" || FAILURES=$((FAILURES + 1))
create_binding "bom.events" "stream.bom.progress" "bom.progress.#" || FAILURES=$((FAILURES + 1))
create_binding "enrichment.events" "stream.enrichment.updates" "enrichment.#" || FAILURES=$((FAILURES + 1))

echo ""
echo "=============================================="
echo " Initialization Summary"
echo "=============================================="

if [ $FAILURES -eq 0 ]; then
    log_success "All streams and exchanges created successfully!"
    exit 0
else
    log_error "$FAILURES operations failed"
    exit 1
fi
