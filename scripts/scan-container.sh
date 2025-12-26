#!/bin/bash
# =============================================================================
# Container Security Scan Script
# =============================================================================
# Local testing script for container security scanning
# Matches GitHub Actions workflow scanning process
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCAN_RESULTS_DIR="${PROJECT_ROOT}/scan-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Scanning tools
TRIVY_VERSION="latest"
GRYPE_VERSION="latest"
SYFT_VERSION="latest"

# Default values
SEVERITY_THRESHOLD="HIGH,CRITICAL"
SCAN_TYPE="all"  # hadolint, trivy, grype, sbom, all
OUTPUT_FORMAT="table"  # table, json, sarif

# =============================================================================
# Functions
# =============================================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] IMAGE

Scan a Docker image for security vulnerabilities and best practices.

OPTIONS:
    -h, --help              Show this help message
    -t, --type TYPE         Scan type: hadolint, trivy, grype, sbom, all (default: all)
    -s, --severity LEVEL    Severity threshold: LOW, MEDIUM, HIGH, CRITICAL (default: HIGH,CRITICAL)
    -o, --output FORMAT     Output format: table, json, sarif (default: table)
    -d, --dockerfile PATH   Path to Dockerfile (required for hadolint)
    -r, --results-dir PATH  Directory to save results (default: ./scan-results)
    -v, --verbose           Verbose output

EXAMPLES:
    # Scan all aspects of an image
    $(basename "$0") my-image:latest

    # Only run Trivy vulnerability scan
    $(basename "$0") -t trivy my-image:latest

    # Scan with custom severity threshold
    $(basename "$0") -s CRITICAL my-image:latest

    # Scan and save results to JSON
    $(basename "$0") -o json -r ./results my-image:latest

    # Lint Dockerfile only
    $(basename "$0") -t hadolint -d ./Dockerfile

SCAN TYPES:
    hadolint    - Dockerfile best practices linting
    trivy       - Comprehensive vulnerability scanning
    grype       - Exploit-focused vulnerability scanning
    sbom        - Generate Software Bill of Materials
    all         - Run all scans (default)

EOF
}

check_dependencies() {
    print_header "Checking Dependencies"

    local missing_deps=0

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        missing_deps=1
    else
        print_success "Docker: $(docker --version)"
    fi

    # Check jq (optional but recommended)
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed (optional, improves JSON output)"
    else
        print_success "jq: $(jq --version)"
    fi

    if [ $missing_deps -eq 1 ]; then
        print_error "Missing required dependencies. Please install them and try again."
        exit 1
    fi

    echo ""
}

run_hadolint() {
    local dockerfile=$1
    local output_file="${SCAN_RESULTS_DIR}/hadolint_${TIMESTAMP}.txt"

    print_header "Running Hadolint - Dockerfile Linting"

    if [ ! -f "$dockerfile" ]; then
        print_error "Dockerfile not found: $dockerfile"
        return 1
    fi

    print_info "Scanning: $dockerfile"
    print_info "Output: $output_file"

    mkdir -p "$SCAN_RESULTS_DIR"

    # Run Hadolint
    if docker run --rm -i \
        -v "${PROJECT_ROOT}/.hadolint.yaml:/root/.config/hadolint.yaml:ro" \
        hadolint/hadolint:latest-alpine < "$dockerfile" > "$output_file" 2>&1; then
        print_success "Hadolint scan passed - No issues found"
    else
        print_warning "Hadolint found issues. See: $output_file"
        cat "$output_file"
    fi

    echo ""
}

run_trivy() {
    local image=$1
    local output_file="${SCAN_RESULTS_DIR}/trivy_${TIMESTAMP}"

    print_header "Running Trivy - Vulnerability Scanner"

    print_info "Scanning image: $image"
    print_info "Severity: $SEVERITY_THRESHOLD"
    print_info "Output: ${output_file}.${OUTPUT_FORMAT}"

    mkdir -p "$SCAN_RESULTS_DIR"

    # Determine output format
    local format_arg="table"
    local output_path="${output_file}.txt"

    case "$OUTPUT_FORMAT" in
        json)
            format_arg="json"
            output_path="${output_file}.json"
            ;;
        sarif)
            format_arg="sarif"
            output_path="${output_file}.sarif"
            ;;
    esac

    # Run Trivy scan
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "${PROJECT_ROOT}/.trivyignore:/root/.trivyignore:ro" \
        -v "${SCAN_RESULTS_DIR}:/output" \
        aquasec/trivy:${TRIVY_VERSION} image \
        --severity "$SEVERITY_THRESHOLD" \
        --format "$format_arg" \
        --output "/output/$(basename "$output_path")" \
        --timeout 10m \
        "$image"

    if [ -f "$output_path" ]; then
        print_success "Trivy scan complete"

        # Display summary if table format
        if [ "$OUTPUT_FORMAT" = "table" ]; then
            cat "$output_path"
        fi

        # Display critical CVE count if JSON format
        if [ "$OUTPUT_FORMAT" = "json" ] && command -v jq &> /dev/null; then
            local critical_count=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$output_path")
            local high_count=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$output_path")

            if [ "$critical_count" -gt 0 ] || [ "$high_count" -gt 0 ]; then
                print_warning "Found $critical_count CRITICAL and $high_count HIGH vulnerabilities"
            else
                print_success "No critical or high vulnerabilities found"
            fi
        fi
    else
        print_error "Trivy scan failed"
        return 1
    fi

    echo ""
}

run_grype() {
    local image=$1
    local output_file="${SCAN_RESULTS_DIR}/grype_${TIMESTAMP}"

    print_header "Running Grype - Vulnerability Scanner"

    print_info "Scanning image: $image"
    print_info "Output: ${output_file}.${OUTPUT_FORMAT}"

    mkdir -p "$SCAN_RESULTS_DIR"

    # Determine output format
    local format_arg="table"
    local output_path="${output_file}.txt"

    case "$OUTPUT_FORMAT" in
        json)
            format_arg="json"
            output_path="${output_file}.json"
            ;;
        sarif)
            format_arg="sarif"
            output_path="${output_file}.sarif"
            ;;
    esac

    # Run Grype scan
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "${SCAN_RESULTS_DIR}:/output" \
        anchore/grype:${GRYPE_VERSION} \
        "$image" \
        -o "$format_arg" \
        --file "/output/$(basename "$output_path")"

    if [ -f "$output_path" ]; then
        print_success "Grype scan complete"

        # Display summary if table format
        if [ "$OUTPUT_FORMAT" = "table" ]; then
            cat "$output_path"
        fi
    else
        print_error "Grype scan failed"
        return 1
    fi

    echo ""
}

generate_sbom() {
    local image=$1
    local output_file="${SCAN_RESULTS_DIR}/sbom_${TIMESTAMP}.spdx.json"

    print_header "Generating SBOM - Software Bill of Materials"

    print_info "Analyzing image: $image"
    print_info "Format: SPDX JSON"
    print_info "Output: $output_file"

    mkdir -p "$SCAN_RESULTS_DIR"

    # Generate SBOM with Syft
    docker run --rm \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "${SCAN_RESULTS_DIR}:/output" \
        anchore/syft:${SYFT_VERSION} \
        "$image" \
        -o spdx-json \
        --file "/output/$(basename "$output_file")"

    if [ -f "$output_file" ]; then
        print_success "SBOM generated successfully"

        # Display package count if jq is available
        if command -v jq &> /dev/null; then
            local package_count=$(jq '.packages | length' "$output_file")
            print_info "Total packages: $package_count"

            # List top-level packages
            print_info "Sample packages:"
            jq -r '.packages[0:5] | .[] | "  - \(.name) (\(.versionInfo))"' "$output_file" || true
        fi
    else
        print_error "SBOM generation failed"
        return 1
    fi

    echo ""
}

scan_image() {
    local image=$1
    local dockerfile=${2:-}

    print_header "Container Security Scan"
    echo -e "${BLUE}Image:${NC} $image"
    echo -e "${BLUE}Timestamp:${NC} $TIMESTAMP"
    echo -e "${BLUE}Scan Type:${NC} $SCAN_TYPE"
    echo ""

    case "$SCAN_TYPE" in
        hadolint)
            if [ -z "$dockerfile" ]; then
                print_error "Dockerfile path required for hadolint scan (-d flag)"
                exit 1
            fi
            run_hadolint "$dockerfile"
            ;;

        trivy)
            run_trivy "$image"
            ;;

        grype)
            run_grype "$image"
            ;;

        sbom)
            generate_sbom "$image"
            ;;

        all)
            if [ -n "$dockerfile" ]; then
                run_hadolint "$dockerfile"
            fi
            run_trivy "$image"
            run_grype "$image"
            generate_sbom "$image"
            ;;

        *)
            print_error "Unknown scan type: $SCAN_TYPE"
            usage
            exit 1
            ;;
    esac

    print_header "Scan Complete"
    print_success "Results saved to: $SCAN_RESULTS_DIR"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    local image=""
    local dockerfile=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -t|--type)
                SCAN_TYPE="$2"
                shift 2
                ;;
            -s|--severity)
                SEVERITY_THRESHOLD="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            -d|--dockerfile)
                dockerfile="$2"
                shift 2
                ;;
            -r|--results-dir)
                SCAN_RESULTS_DIR="$2"
                shift 2
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            -*)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                image="$1"
                shift
                ;;
        esac
    done

    # Validate inputs
    if [ -z "$image" ] && [ "$SCAN_TYPE" != "hadolint" ]; then
        print_error "Image name required"
        usage
        exit 1
    fi

    # Run scans
    check_dependencies
    scan_image "$image" "$dockerfile"
}

# Run main function
main "$@"
