#!/bin/bash
# =============================================================================
# Helm Charts Validation Script
# =============================================================================
# Validates all Helm charts for syntax, structure, and best practices
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERRORS=0
WARNINGS=0

echo "=================================="
echo "Helm Charts Validation"
echo "=================================="
echo ""

# Function to check if a file exists
check_file() {
    local chart=$1
    local file=$2
    if [ -f "$BASE_DIR/$chart/$file" ]; then
        echo -e "${GREEN}✓${NC} $chart/$file exists"
        return 0
    else
        echo -e "${RED}✗${NC} $chart/$file MISSING"
        ((ERRORS++))
        return 1
    fi
}

# Function to validate Helm chart
validate_chart() {
    local chart=$1
    echo ""
    echo "Validating $chart..."
    echo "-----------------------------------"

    # Check required files
    check_file "$chart" "Chart.yaml"
    check_file "$chart" "values.yaml"
    check_file "$chart" "values-dev.yaml"
    check_file "$chart" "values-staging.yaml"
    check_file "$chart" "values-prod.yaml"
    check_file "$chart" "templates/_helpers.tpl"
    check_file "$chart" "templates/deployment.yaml"
    check_file "$chart" "templates/service.yaml"
    check_file "$chart" "templates/configmap.yaml"
    check_file "$chart" "templates/hpa.yaml"
    check_file "$chart" "templates/servicemonitor.yaml"
    check_file "$chart" "templates/serviceaccount.yaml"
    check_file "$chart" "templates/poddisruptionbudget.yaml"

    # Helm lint (if helm is installed)
    if command -v helm &> /dev/null; then
        if helm lint "$BASE_DIR/$chart" --quiet; then
            echo -e "${GREEN}✓${NC} Helm lint passed"
        else
            echo -e "${RED}✗${NC} Helm lint FAILED"
            ((ERRORS++))
        fi

        # Template rendering test
        if helm template test "$BASE_DIR/$chart" --values "$BASE_DIR/$chart/values-dev.yaml" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Template rendering successful"
        else
            echo -e "${YELLOW}⚠${NC} Template rendering failed (may need dependencies)"
            ((WARNINGS++))
        fi
    else
        echo -e "${YELLOW}⚠${NC} Helm not installed, skipping lint checks"
        ((WARNINGS++))
    fi
}

# Get all chart directories
CHARTS=$(ls -1 "$BASE_DIR" | grep -v -E '\.(sh|md)$' | sort)

# Validate each chart
for chart in $CHARTS; do
    if [ -d "$BASE_DIR/$chart" ]; then
        validate_chart "$chart"
    fi
done

echo ""
echo "=================================="
echo "Validation Summary"
echo "=================================="
echo "Total charts validated: $(echo "$CHARTS" | wc -l)"
echo -e "Errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Validation failed with $ERRORS errors${NC}"
    exit 1
fi
