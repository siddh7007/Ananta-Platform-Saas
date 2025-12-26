#!/bin/bash
# =============================================================================
# Alerting Infrastructure Validation Script
# =============================================================================
# Validates that SLO tracking and alerting infrastructure is properly configured
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
print_header() {
    echo ""
    echo "========================================================================"
    echo "  $1"
    echo "========================================================================"
}

check_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

# =============================================================================
# 1. Check File Existence
# =============================================================================
print_header "1. Checking Required Files"

# Prometheus alert files
if [ -f "prometheus/alerts/slos.yml" ]; then
    check_pass "SLO recording rules file exists"
else
    check_fail "Missing prometheus/alerts/slos.yml"
fi

if [ -f "prometheus/alerts/critical.yml" ]; then
    check_pass "Critical alert rules file exists"
else
    check_fail "Missing prometheus/alerts/critical.yml"
fi

if [ -f "prometheus/alerts/ananta-platform.yml" ]; then
    check_pass "Platform alert rules file exists"
else
    check_fail "Missing prometheus/alerts/ananta-platform.yml"
fi

# AlertManager configs
if [ -f "alertmanager/alertmanager.yml" ]; then
    check_pass "Development AlertManager config exists"
else
    check_fail "Missing alertmanager/alertmanager.yml"
fi

if [ -f "alertmanager/alertmanager-production.yml" ]; then
    check_pass "Production AlertManager config exists"
else
    check_fail "Missing alertmanager/alertmanager-production.yml"
fi

# Secrets directory
if [ -d "alertmanager/secrets" ]; then
    check_pass "Secrets directory exists"

    if [ -f "alertmanager/secrets/.gitignore" ]; then
        check_pass "Secrets .gitignore exists (security)"
    else
        check_warn "Missing alertmanager/secrets/.gitignore - secrets may be committed!"
    fi
else
    check_fail "Missing alertmanager/secrets directory"
fi

# Documentation
if [ -f "SLO-ALERTING-GUIDE.md" ]; then
    check_pass "SLO/Alerting guide exists"
else
    check_warn "Missing SLO-ALERTING-GUIDE.md documentation"
fi

# =============================================================================
# 2. Validate YAML Syntax
# =============================================================================
print_header "2. Validating YAML Syntax"

# Check if docker is available for validation
if command -v docker &> /dev/null; then
    # Validate Prometheus config
    if docker run --rm -v "$(pwd)/prometheus:/etc/prometheus" prom/prometheus:v2.47.0 \
        promtool check config /etc/prometheus/prometheus.yml &> /dev/null; then
        check_pass "Prometheus config syntax valid"
    else
        check_fail "Prometheus config has syntax errors"
    fi

    # Validate alert rules
    if docker run --rm -v "$(pwd)/prometheus:/etc/prometheus" prom/prometheus:v2.47.0 \
        promtool check rules /etc/prometheus/alerts/*.yml &> /dev/null; then
        check_pass "Alert rules syntax valid"
    else
        check_fail "Alert rules have syntax errors"
    fi

    # Validate AlertManager config
    if docker run --rm -v "$(pwd)/alertmanager:/etc/alertmanager" prom/alertmanager:v0.26.0 \
        amtool check-config /etc/alertmanager/alertmanager.yml &> /dev/null; then
        check_pass "AlertManager dev config syntax valid"
    else
        check_fail "AlertManager dev config has syntax errors"
    fi

    if docker run --rm -v "$(pwd)/alertmanager:/etc/alertmanager" prom/alertmanager:v0.26.0 \
        amtool check-config /etc/alertmanager/alertmanager-production.yml &> /dev/null 2>&1; then
        check_pass "AlertManager production config syntax valid"
    else
        check_warn "AlertManager production config validation failed (may need env vars)"
    fi
else
    check_warn "Docker not available - skipping YAML validation"
fi

# =============================================================================
# 3. Check Running Services
# =============================================================================
print_header "3. Checking Running Services"

if command -v curl &> /dev/null; then
    # Check Prometheus
    if curl -s http://localhost:9090/-/healthy &> /dev/null; then
        check_pass "Prometheus is running and healthy"

        # Check if rules are loaded
        RULES_COUNT=$(curl -s http://localhost:9090/api/v1/rules | jq '.data.groups | length' 2>/dev/null || echo "0")
        if [ "$RULES_COUNT" -gt 0 ]; then
            check_pass "Prometheus has $RULES_COUNT rule groups loaded"
        else
            check_warn "Prometheus has no alert rules loaded"
        fi
    else
        check_warn "Prometheus is not running (expected if docker-compose not started)"
    fi

    # Check AlertManager
    if curl -s http://localhost:9093/-/healthy &> /dev/null; then
        check_pass "AlertManager is running and healthy"

        # Check active alerts
        ALERTS_COUNT=$(curl -s http://localhost:9093/api/v1/alerts | jq '. | length' 2>/dev/null || echo "0")
        if [ "$ALERTS_COUNT" -eq 0 ]; then
            check_pass "No active alerts (good!)"
        else
            check_warn "There are $ALERTS_COUNT active alerts"
        fi
    else
        check_warn "AlertManager is not running (expected if docker-compose not started)"
    fi

    # Check Grafana
    if curl -s http://localhost:3001/api/health &> /dev/null; then
        check_pass "Grafana is running and healthy"
    else
        check_warn "Grafana is not running (expected if docker-compose not started)"
    fi
else
    check_warn "curl not available - skipping service health checks"
fi

# =============================================================================
# 4. Validate Alert Rule Content
# =============================================================================
print_header "4. Validating Alert Rule Content"

# Check for critical SLO rules
if grep -q "slo:control_plane:availability:ratio" prometheus/alerts/slos.yml 2>/dev/null; then
    check_pass "Availability SLO recording rule exists"
else
    check_fail "Missing availability SLO recording rule"
fi

if grep -q "slo:control_plane:error_budget:remaining" prometheus/alerts/slos.yml 2>/dev/null; then
    check_pass "Error budget recording rule exists"
else
    check_fail "Missing error budget recording rule"
fi

if grep -q "slo:control_plane:error_budget:burn_rate" prometheus/alerts/slos.yml 2>/dev/null; then
    check_pass "Burn rate recording rule exists"
else
    check_fail "Missing burn rate recording rule"
fi

# Check for critical alerts
if grep -q "ServiceDown" prometheus/alerts/critical.yml 2>/dev/null; then
    check_pass "ServiceDown critical alert exists"
else
    check_fail "Missing ServiceDown critical alert"
fi

if grep -q "HighErrorRate" prometheus/alerts/critical.yml 2>/dev/null; then
    check_pass "HighErrorRate alert exists"
else
    check_fail "Missing HighErrorRate alert"
fi

if grep -q "ErrorBudgetBurningFast" prometheus/alerts/critical.yml 2>/dev/null; then
    check_pass "ErrorBudgetBurningFast alert exists"
else
    check_fail "Missing ErrorBudgetBurningFast alert"
fi

if grep -q "DatabaseConnectionPoolExhausted" prometheus/alerts/critical.yml 2>/dev/null; then
    check_pass "DatabaseConnectionPoolExhausted alert exists"
else
    check_fail "Missing DatabaseConnectionPoolExhausted alert"
fi

# =============================================================================
# 5. Check AlertManager Receivers
# =============================================================================
print_header "5. Checking AlertManager Configuration"

if grep -q "pagerduty-critical" alertmanager/alertmanager-production.yml 2>/dev/null; then
    check_pass "PagerDuty receiver configured"
else
    check_warn "PagerDuty receiver not configured"
fi

if grep -q "slack-critical" alertmanager/alertmanager-production.yml 2>/dev/null; then
    check_pass "Slack critical receiver configured"
else
    check_warn "Slack critical receiver not configured"
fi

if grep -q "inhibit_rules" alertmanager/alertmanager-production.yml 2>/dev/null; then
    check_pass "Inhibition rules configured"
else
    check_warn "No inhibition rules (alert spam possible)"
fi

# =============================================================================
# 6. Check Secrets Configuration
# =============================================================================
print_header "6. Checking Secrets Configuration"

if [ -f "alertmanager/secrets/pagerduty_key.example" ]; then
    check_pass "PagerDuty key example file exists"
else
    check_warn "Missing pagerduty_key.example"
fi

if [ -f "alertmanager/secrets/pagerduty_key" ]; then
    check_pass "PagerDuty key file exists"

    # Check if it's not the example value
    if grep -q "YOUR_PAGERDUTY" alertmanager/secrets/pagerduty_key 2>/dev/null; then
        check_warn "PagerDuty key appears to be placeholder value"
    fi
else
    check_warn "PagerDuty key file not configured (production deployment will fail)"
fi

if [ -f "alertmanager/secrets/slack_critical_webhook" ]; then
    check_pass "Slack critical webhook file exists"

    # Check if it's a valid Slack webhook URL
    if grep -q "hooks.slack.com/services/" alertmanager/secrets/slack_critical_webhook 2>/dev/null; then
        if grep -q "YOUR/" alertmanager/secrets/slack_critical_webhook 2>/dev/null; then
            check_warn "Slack webhook appears to be placeholder value"
        else
            check_pass "Slack webhook appears valid"
        fi
    else
        check_warn "Slack webhook doesn't look like a valid URL"
    fi
else
    check_warn "Slack webhook file not configured (production deployment will fail)"
fi

# =============================================================================
# 7. Check Terraform Module
# =============================================================================
print_header "7. Checking Terraform Monitoring Module"

TERRAFORM_DIR="../infrastructure/terraform/modules/monitoring"

if [ -d "$TERRAFORM_DIR" ]; then
    check_pass "Terraform monitoring module directory exists"

    if [ -f "$TERRAFORM_DIR/main.tf" ]; then
        check_pass "Terraform main.tf exists"
    else
        check_fail "Missing Terraform main.tf"
    fi

    if [ -f "$TERRAFORM_DIR/variables.tf" ]; then
        check_pass "Terraform variables.tf exists"
    else
        check_fail "Missing Terraform variables.tf"
    fi

    if [ -f "$TERRAFORM_DIR/outputs.tf" ]; then
        check_pass "Terraform outputs.tf exists"
    else
        check_fail "Missing Terraform outputs.tf"
    fi

    if [ -f "$TERRAFORM_DIR/lambda/pagerduty_forwarder.py" ]; then
        check_pass "PagerDuty Lambda function exists"
    else
        check_fail "Missing PagerDuty Lambda function"
    fi

    if [ -f "$TERRAFORM_DIR/lambda/slack_forwarder.py" ]; then
        check_pass "Slack Lambda function exists"
    else
        check_fail "Missing Slack Lambda function"
    fi
else
    check_fail "Terraform monitoring module not found"
fi

# =============================================================================
# 8. Check Environment Configuration
# =============================================================================
print_header "8. Checking Environment Configuration"

if [ -f ".env.example" ]; then
    check_pass ".env.example exists"
else
    check_warn "Missing .env.example"
fi

if [ -f ".env" ]; then
    check_pass ".env file exists"

    # Check for required variables
    if grep -q "SMTP_HOST" .env 2>/dev/null; then
        check_pass "SMTP_HOST configured in .env"
    else
        check_warn "SMTP_HOST not found in .env"
    fi

    if grep -q "DEFAULT_EMAIL" .env 2>/dev/null; then
        check_pass "DEFAULT_EMAIL configured in .env"
    else
        check_warn "DEFAULT_EMAIL not found in .env"
    fi
else
    check_warn ".env file not created (copy from .env.example)"
fi

# =============================================================================
# Summary
# =============================================================================
print_header "Validation Summary"

echo ""
echo "Results:"
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}All checks passed! Alerting infrastructure is properly configured.${NC}"
        exit 0
    else
        echo -e "${YELLOW}All critical checks passed, but there are warnings to address.${NC}"
        echo "Review warnings above before production deployment."
        exit 0
    fi
else
    echo -e "${RED}Some checks failed. Please fix the issues above before deploying.${NC}"
    exit 1
fi
