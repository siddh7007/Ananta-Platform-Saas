#!/bin/bash
# =============================================================================
# SLO Implementation Validation Script
# =============================================================================
# Validates that SLO recording rules, alerts, and dashboard are properly
# deployed and collecting data.
#
# Usage:
#   chmod +x validate-slo-implementation.sh
#   ./validate-slo-implementation.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SLO Implementation Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Test 1: Verify Prometheus is Running
# =============================================================================
echo -e "${BLUE}[1/8] Checking Prometheus connectivity...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$PROMETHEUS_URL/api/v1/status/config" | grep -q "200"; then
    echo -e "${GREEN}✓ Prometheus is accessible at $PROMETHEUS_URL${NC}"
else
    echo -e "${RED}✗ Prometheus is not accessible at $PROMETHEUS_URL${NC}"
    echo -e "${YELLOW}  Ensure Prometheus is running: docker-compose ps prometheus${NC}"
    exit 1
fi

# =============================================================================
# Test 2: Verify SLO Recording Rules are Loaded
# =============================================================================
echo -e "${BLUE}[2/8] Checking SLO recording rules...${NC}"

EXPECTED_GROUPS=(
    "slo_tenant_management"
    "slo_keycloak"
    "slo_cns_service"
    "slo_temporal"
    "slo_database"
    "slo_redis"
    "slo_rabbitmq"
    "slo_error_budget"
    "slo_burn_rate"
    "slo_plane_level"
    "slo_violation_alerts"
)

MISSING_GROUPS=()
FOUND_GROUPS=0

for group in "${EXPECTED_GROUPS[@]}"; do
    if curl -s "$PROMETHEUS_URL/api/v1/rules" | jq -e ".data.groups[] | select(.name == \"$group\")" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Found rule group: $group${NC}"
        ((FOUND_GROUPS++))
    else
        echo -e "${RED}  ✗ Missing rule group: $group${NC}"
        MISSING_GROUPS+=("$group")
    fi
done

echo -e "${BLUE}  Summary: $FOUND_GROUPS/${#EXPECTED_GROUPS[@]} rule groups loaded${NC}"

if [ ${#MISSING_GROUPS[@]} -gt 0 ]; then
    echo -e "${YELLOW}  Missing groups: ${MISSING_GROUPS[*]}${NC}"
    echo -e "${YELLOW}  Action: Restart Prometheus to reload rules${NC}"
fi

# =============================================================================
# Test 3: Verify Recording Rules are Producing Data
# =============================================================================
echo -e "${BLUE}[3/8] Checking if recording rules are producing data...${NC}"

METRICS_TO_CHECK=(
    "slo:tenant_mgmt:availability:ratio_5m"
    "slo:cns:availability:ratio_5m"
    "slo:control_plane:error_budget:remaining"
    "slo:app_plane:error_budget:remaining"
    "slo:tenant_mgmt:burn_rate:1h"
)

DATA_METRICS=0

for metric in "${METRICS_TO_CHECK[@]}"; do
    RESULT=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=$metric" | jq -r '.data.result | length')
    if [ "$RESULT" -gt 0 ]; then
        VALUE=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=$metric" | jq -r '.data.result[0].value[1]')
        echo -e "${GREEN}  ✓ $metric = $VALUE${NC}"
        ((DATA_METRICS++))
    else
        echo -e "${YELLOW}  ⚠ $metric has no data${NC}"
    fi
done

echo -e "${BLUE}  Summary: $DATA_METRICS/${#METRICS_TO_CHECK[@]} metrics have data${NC}"

if [ $DATA_METRICS -lt ${#METRICS_TO_CHECK[@]} ]; then
    echo -e "${YELLOW}  Metrics without data may indicate:${NC}"
    echo -e "${YELLOW}    1. Services not exporting required metrics (check /metrics endpoints)${NC}"
    echo -e "${YELLOW}    2. Prometheus not scraping services (check /targets)${NC}"
    echo -e "${YELLOW}    3. Not enough time elapsed for data collection (wait 5-10 minutes)${NC}"
fi

# =============================================================================
# Test 4: Verify Alert Rules are Loaded
# =============================================================================
echo -e "${BLUE}[4/8] Checking SLO alert rules...${NC}"

EXPECTED_ALERTS=(
    "TenantManagementFastBurn"
    "CNSServiceFastBurn"
    "KeycloakFastBurn"
    "TenantManagementMediumBurn"
    "CNSServiceMediumBurn"
    "TenantManagementBudgetExhausted"
    "CNSServiceBudgetExhausted"
    "ErrorBudgetLow"
    "TenantManagementHighLatency"
    "CNSEnrichmentSlowLatency"
    "CNSLowMatchRate"
)

FOUND_ALERTS=0

for alert in "${EXPECTED_ALERTS[@]}"; do
    if curl -s "$PROMETHEUS_URL/api/v1/rules" | jq -e ".data.groups[].rules[] | select(.name == \"$alert\")" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Found alert: $alert${NC}"
        ((FOUND_ALERTS++))
    else
        echo -e "${RED}  ✗ Missing alert: $alert${NC}"
    fi
done

echo -e "${BLUE}  Summary: $FOUND_ALERTS/${#EXPECTED_ALERTS[@]} alerts loaded${NC}"

# =============================================================================
# Test 5: Check for Firing Alerts
# =============================================================================
echo -e "${BLUE}[5/8] Checking for active SLO violation alerts...${NC}"

FIRING_ALERTS=$(curl -s "$PROMETHEUS_URL/api/v1/alerts" | jq -r '.data.alerts[] | select(.state == "firing" and (.labels.alertname | test(".*Burn.*|.*Budget.*|.*Latency.*|.*MatchRate.*"))) | .labels.alertname' 2>/dev/null || echo "")

if [ -z "$FIRING_ALERTS" ]; then
    echo -e "${GREEN}  ✓ No SLO violation alerts currently firing${NC}"
else
    echo -e "${RED}  ⚠ SLO violation alerts currently firing:${NC}"
    echo "$FIRING_ALERTS" | while read -r alert; do
        echo -e "${RED}    - $alert${NC}"
    done
    echo -e "${YELLOW}  Action: Investigate alerts in Prometheus (/alerts) or AlertManager${NC}"
fi

# =============================================================================
# Test 6: Verify Service Metrics Export
# =============================================================================
echo -e "${BLUE}[6/8] Checking if services are exporting required metrics...${NC}"

SERVICES=(
    "http://localhost:14000:tenant-management-service"
    "http://localhost:27200:cns-service"
)

METRICS_OK=0

for service_spec in "${SERVICES[@]}"; do
    IFS=':' read -r url name <<< "$service_spec"

    if curl -s -o /dev/null -w "%{http_code}" "$url/metrics" | grep -q "200"; then
        # Check for required metrics
        METRICS=$(curl -s "$url/metrics")

        HAS_REQUESTS=false
        HAS_DURATION=false

        if echo "$METRICS" | grep -q "http_requests_total"; then
            HAS_REQUESTS=true
        fi

        if echo "$METRICS" | grep -q "http_request_duration_seconds"; then
            HAS_DURATION=true
        fi

        if [ "$HAS_REQUESTS" = true ] && [ "$HAS_DURATION" = true ]; then
            echo -e "${GREEN}  ✓ $name exports required metrics${NC}"
            ((METRICS_OK++))
        else
            echo -e "${YELLOW}  ⚠ $name is missing metrics:${NC}"
            [ "$HAS_REQUESTS" = false ] && echo -e "${YELLOW}    - http_requests_total${NC}"
            [ "$HAS_DURATION" = false ] && echo -e "${YELLOW}    - http_request_duration_seconds${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ $name /metrics endpoint not accessible at $url${NC}"
    fi
done

# =============================================================================
# Test 7: Verify Prometheus Scrape Targets
# =============================================================================
echo -e "${BLUE}[7/8] Checking Prometheus scrape targets...${NC}"

TARGETS=$(curl -s "$PROMETHEUS_URL/api/v1/targets" | jq -r '.data.activeTargets[] | select(.labels.job | test(".*tenant.*|.*cns.*")) | "\(.labels.job):\(.health)"')

if [ -z "$TARGETS" ]; then
    echo -e "${YELLOW}  ⚠ No relevant targets found. Check prometheus.yml scrape configs.${NC}"
else
    echo "$TARGETS" | while IFS=':' read -r job health; do
        if [ "$health" = "up" ]; then
            echo -e "${GREEN}  ✓ $job is UP${NC}"
        else
            echo -e "${RED}  ✗ $job is DOWN${NC}"
        fi
    done
fi

# =============================================================================
# Test 8: Verify Grafana Dashboard Exists (Optional)
# =============================================================================
echo -e "${BLUE}[8/8] Checking Grafana dashboard (optional)...${NC}"

if curl -s -o /dev/null -w "%{http_code}" "$GRAFANA_URL/api/health" | grep -q "200"; then
    # Try to find dashboard by UID
    DASHBOARD_FOUND=$(curl -s "$GRAFANA_URL/api/dashboards/uid/ananta-slo-overview" -u admin:admin 2>/dev/null | jq -r '.dashboard.title' 2>/dev/null || echo "")

    if [ -n "$DASHBOARD_FOUND" ]; then
        echo -e "${GREEN}  ✓ Grafana dashboard found: $DASHBOARD_FOUND${NC}"
        echo -e "${GREEN}    URL: $GRAFANA_URL/d/ananta-slo-overview${NC}"
    else
        echo -e "${YELLOW}  ⚠ Grafana dashboard not imported yet${NC}"
        echo -e "${YELLOW}    Import: shared-monitoring/grafana/dashboards/slo-overview-dashboard.json${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Grafana not accessible at $GRAFANA_URL (optional)${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}========================================${NC}"

TOTAL_CHECKS=8
PASSED_CHECKS=0

[ $FOUND_GROUPS -eq ${#EXPECTED_GROUPS[@]} ] && ((PASSED_CHECKS++))
[ $DATA_METRICS -eq ${#METRICS_TO_CHECK[@]} ] && ((PASSED_CHECKS++))
[ $FOUND_ALERTS -eq ${#EXPECTED_ALERTS[@]} ] && ((PASSED_CHECKS++))
[ -z "$FIRING_ALERTS" ] && ((PASSED_CHECKS++))
[ $METRICS_OK -gt 0 ] && ((PASSED_CHECKS++))

if [ $PASSED_CHECKS -ge 5 ]; then
    echo -e "${GREEN}✓ SLO implementation is functional ($PASSED_CHECKS/$TOTAL_CHECKS checks passed)${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "  1. Open SLO dashboard: $GRAFANA_URL/d/ananta-slo-overview"
    echo -e "  2. Review error budgets for all services"
    echo -e "  3. Verify burn rates are < 3x"
    echo -e "  4. Set up AlertManager routing for SLO alerts"
    echo ""
    exit 0
else
    echo -e "${RED}✗ SLO implementation has issues ($PASSED_CHECKS/$TOTAL_CHECKS checks passed)${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "  1. Restart Prometheus: docker-compose restart prometheus"
    echo -e "  2. Check Prometheus logs: docker logs shared-prometheus"
    echo -e "  3. Verify rule syntax: promtool check rules prometheus/alerts/slos.yml"
    echo -e "  4. Check service instrumentation (see docs/SLO-IMPLEMENTATION-SUMMARY.md)"
    echo ""
    exit 1
fi
