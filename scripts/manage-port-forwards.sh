#!/bin/bash
# Port-Forward Management Script (Bash version)
# Usage: ./manage-port-forwards.sh [start|stop|restart|status]

set -e

ACTION=${1:-status}
KUBECTL="e:/Work/Ananta-Platform-Saas/kubectl.exe"

# Define all port-forwards
declare -A PORT_FORWARDS=(
    ["customer-portal"]="app-plane:customer-portal:27100:27100"
    ["cns-service"]="app-plane:cns-service:27200:27200"
    ["tenant-management"]="control-plane:tenant-management-service:14000:14000"
    ["keycloak"]="auth-system:keycloak:8180:8080"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

stop_all_port_forwards() {
    echo -e "${YELLOW}[STOP] Killing all kubectl port-forward processes...${NC}"

    # Kill all kubectl processes
    pkill -f "kubectl.*port-forward" 2>/dev/null || true

    # Wait for ports to be released
    sleep 2
    echo -e "${GREEN}[OK] All port-forwards stopped${NC}"
}

start_all_port_forwards() {
    echo -e "${YELLOW}[START] Starting all port-forwards...${NC}"

    for name in "${!PORT_FORWARDS[@]}"; do
        IFS=':' read -r ns svc local remote <<< "${PORT_FORWARDS[$name]}"

        # Check if port is already in use
        if netstat -an 2>/dev/null | grep -q ":${local}.*LISTEN"; then
            echo -e "  ${YELLOW}[SKIP] $name - Port $local already in use${NC}"
            continue
        fi

        # Start port-forward in background
        "$KUBECTL" port-forward -n "$ns" "svc/$svc" "${local}:${remote}" &> "/tmp/pf-${name}.log" &
        PID=$!

        # Save PID to file for tracking
        echo "$PID" > "/tmp/pf-${name}.pid"

        echo -e "  ${GREEN}[OK] $name - Forwarding localhost:$local -> $ns/$svc:$remote (PID: $PID)${NC}"
    done

    sleep 2
}

show_status() {
    echo -e "\n${CYAN}=== Port-Forward Status ===${NC}\n"

    for name in "${!PORT_FORWARDS[@]}"; do
        IFS=':' read -r ns svc local remote <<< "${PORT_FORWARDS[$name]}"

        # Check if port is listening
        if netstat -an 2>/dev/null | grep -q ":${local}.*LISTEN"; then
            # Check if it's our kubectl process
            PID_FILE="/tmp/pf-${name}.pid"
            if [ -f "$PID_FILE" ]; then
                PID=$(cat "$PID_FILE")
                if ps -p "$PID" > /dev/null 2>&1; then
                    echo -e "  ${GREEN}[RUNNING]${NC} $name - localhost:$local (PID: $PID)"
                else
                    echo -e "  ${RED}[CONFLICT]${NC} $name - localhost:$local (different process)"
                fi
            else
                echo -e "  ${RED}[UNKNOWN]${NC} $name - localhost:$local (no PID file)"
            fi
        else
            echo -e "  ${GRAY}[STOPPED]${NC} $name - localhost:$local"
        fi
    done

    # Show running kubectl port-forward processes
    echo -e "\n${CYAN}=== Running kubectl port-forward processes ===${NC}"
    ps aux | grep -E "kubectl.*port-forward" | grep -v grep || echo "  (none)"
}

# Main execution
case "$ACTION" in
    stop)
        stop_all_port_forwards
        ;;
    start)
        start_all_port_forwards
        show_status
        ;;
    restart)
        stop_all_port_forwards
        start_all_port_forwards
        show_status
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
