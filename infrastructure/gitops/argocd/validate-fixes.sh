#!/bin/bash
# =============================================================================
# ArgoCD GitOps Configuration - Validation Script
# =============================================================================
# Validates all critical fixes have been applied correctly
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "ArgoCD GitOps Configuration Validator"
echo "========================================"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((ERRORS++))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

# =============================================================================
# Test 1: Check for Handlebars syntax
# =============================================================================
echo "Test 1: Checking for invalid Handlebars syntax..."

if grep -r "{{#eq\|{{#if\|{{/eq\|{{/if" applicationsets/ 2>/dev/null; then
    fail "Found Handlebars syntax in ApplicationSets (should use Go templates)"
else
    pass "No Handlebars syntax found in ApplicationSets"
fi

# =============================================================================
# Test 2: Check for literal string booleans (NOT template strings)
# =============================================================================
echo ""
echo "Test 2: Checking for literal string booleans..."

if grep -r 'autoSync: "true"\|autoSync: "false"' applicationsets/ 2>/dev/null | grep -v '{{'; then
    fail "Found literal quoted boolean values (should be template: '{{autoSync}}')"
else
    pass "No literal quoted boolean values found"
fi

# =============================================================================
# Test 3: Check for placeholder organization
# =============================================================================
echo ""
echo "Test 3: Checking for placeholder 'your-org'..."

if grep -r 'your-org' . 2>/dev/null | grep -v "validate-fixes.sh" | grep -v "FIXES_APPLIED.md" | grep -v "README.md"; then
    fail "Found placeholder 'your-org' in configuration files"
else
    pass "No placeholder 'your-org' found"
fi

# =============================================================================
# Test 4: Check for targetRevision in generators
# =============================================================================
echo ""
echo "Test 4: Checking for targetRevision in environment generators..."

MISSING_TARGET_REV=0
for file in applicationsets/*.yaml; do
    if grep -q "environment: dev" "$file"; then
        if ! grep -A 6 "environment: dev" "$file" | grep -q "targetRevision: develop"; then
            fail "Missing 'targetRevision: develop' in $file"
            ((MISSING_TARGET_REV++))
        fi
    fi
done

if [ $MISSING_TARGET_REV -eq 0 ]; then
    pass "All ApplicationSets have targetRevision in generators"
fi

# =============================================================================
# Test 5: Check for both chartName and chartPath fields in infrastructure-apps
# =============================================================================
echo ""
echo "Test 5: Checking for chart and path fields in infrastructure ApplicationSet..."

if grep -q "chartName:" applicationsets/infrastructure-apps.yaml && grep -q "chartPath:" applicationsets/infrastructure-apps.yaml; then
    pass "Both chartName and chartPath fields found in infrastructure-apps.yaml"
else
    fail "Missing chartName or chartPath fields in infrastructure-apps.yaml"
fi

# =============================================================================
# Test 6: Verify ResourceQuota not blacklisted
# =============================================================================
echo ""
echo "Test 6: Checking ResourceQuota/LimitRange are not blacklisted..."

if grep -q "namespaceResourceBlacklist" projects/ananta-platform.yaml; then
    if grep -A 5 "namespaceResourceBlacklist" projects/ananta-platform.yaml | grep -q "ResourceQuota\|LimitRange"; then
        fail "ResourceQuota or LimitRange still in blacklist"
    else
        warn "namespaceResourceBlacklist section exists but doesn't block ResourceQuota/LimitRange"
    fi
else
    pass "No namespaceResourceBlacklist section (ResourceQuota/LimitRange allowed)"
fi

# =============================================================================
# Test 7: Check for required infrastructure namespaces
# =============================================================================
echo ""
echo "Test 7: Checking for required infrastructure namespace destinations..."

REQUIRED_NS=("keycloak-system" "temporal-system" "rabbitmq-system" "cache-system" "novu-system" "database-system")
MISSING_NS=0

for ns in "${REQUIRED_NS[@]}"; do
    if ! grep -q "namespace: $ns" projects/ananta-platform.yaml; then
        fail "Missing namespace destination: $ns"
        ((MISSING_NS++))
    fi
done

if [ $MISSING_NS -eq 0 ]; then
    pass "All required infrastructure namespaces present"
fi

# =============================================================================
# Test 8: Verify new infrastructure applications exist
# =============================================================================
echo ""
echo "Test 8: Checking for new infrastructure application manifests..."

NEW_APPS=("postgresql" "ingress-nginx" "cert-manager" "novu" "supabase")
MISSING_APPS=0

for app in "${NEW_APPS[@]}"; do
    if [ ! -f "applications/infrastructure/$app.yaml" ]; then
        fail "Missing application manifest: applications/infrastructure/$app.yaml"
        ((MISSING_APPS++))
    fi
done

if [ $MISSING_APPS -eq 0 ]; then
    pass "All new infrastructure application manifests exist"
fi

# =============================================================================
# Test 9: YAML syntax validation
# =============================================================================
echo ""
echo "Test 9: Validating YAML syntax..."

YAML_ERRORS=0

# Check if python is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    warn "Python not found - skipping YAML syntax validation"
    PYTHON_CMD=""
fi

if [ -n "$PYTHON_CMD" ]; then
    for file in projects/*.yaml applicationsets/*.yaml applications/**/*.yaml; do
        if [ -f "$file" ]; then
            if ! $PYTHON_CMD -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
                fail "YAML syntax error in $file"
                ((YAML_ERRORS++))
            fi
        fi
    done

    if [ $YAML_ERRORS -eq 0 ]; then
        pass "All YAML files have valid syntax"
    fi
fi

# =============================================================================
# Test 10: Check for .Values. syntax in individual applications
# =============================================================================
echo ""
echo "Test 10: Checking for invalid .Values. syntax in individual applications..."

INVALID_TEMPLATE_FILES=0
for file in applications/control-plane/*.yaml applications/app-plane/*.yaml; do
    if [ -f "$file" ]; then
        if grep -q "{{.Values\." "$file"; then
            warn "File $file contains Helm template syntax (should be environment-specific or deleted)"
            ((INVALID_TEMPLATE_FILES++))
        fi
    fi
done

if [ $INVALID_TEMPLATE_FILES -eq 0 ]; then
    pass "No invalid Helm template syntax in individual applications"
else
    warn "$INVALID_TEMPLATE_FILES individual application files contain template syntax (recommend using ApplicationSets instead)"
fi

# =============================================================================
# Test 11: Check Go template syntax
# =============================================================================
echo ""
echo "Test 11: Verifying Go template syntax in ApplicationSets..."

GO_TEMPLATE_ERRORS=0
for file in applicationsets/*.yaml; do
    # Check for proper Go template conditionals
    if grep -q "{{-" "$file"; then
        if ! grep -q "{{- if eq" "$file"; then
            fail "Invalid Go template syntax in $file"
            ((GO_TEMPLATE_ERRORS++))
        fi
    fi
done

if [ $GO_TEMPLATE_ERRORS -eq 0 ]; then
    pass "Go template syntax appears correct in ApplicationSets"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================"
echo "Validation Summary"
echo "========================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    echo ""
    echo "The ArgoCD GitOps configuration is ready for deployment."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}Tests passed with $WARNINGS warnings.${NC}"
    echo ""
    echo "The configuration is functional but has minor issues."
    echo "Review warnings above for recommended improvements."
    exit 0
else
    echo -e "${RED}Tests failed: $ERRORS errors, $WARNINGS warnings.${NC}"
    echo ""
    echo "Critical issues must be fixed before deployment."
    echo "Review errors above and apply necessary corrections."
    exit 1
fi
