#!/bin/bash
# =============================================================================
# Quick Installation Script for Ananta Platform
# =============================================================================
# Usage: ./quick-install.sh <environment> [service1] [service2] ...
# Example: ./quick-install.sh dev
# Example: ./quick-install.sh dev tenant-management-service admin-app
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
NAMESPACE="ananta-${ENVIRONMENT}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TAG=${IMAGE_TAG:-latest}

# Service groups
INFRASTRUCTURE_SERVICES="temporal supabase novu"
CONTROL_PLANE_SERVICES="tenant-management-service temporal-worker-service subscription-service orchestrator-service admin-app"
APP_PLANE_SERVICES="cns-service cns-dashboard customer-portal backstage-portal audit-logger middleware-api novu-consumer"

ALL_SERVICES="$INFRASTRUCTURE_SERVICES $CONTROL_PLANE_SERVICES $APP_PLANE_SERVICES"

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    print_success "kubectl found"

    # Check helm
    if ! command -v helm &> /dev/null; then
        print_error "helm is not installed"
        exit 1
    fi
    print_success "helm found"

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    print_success "Kubernetes cluster accessible"
}

create_namespace() {
    print_header "Creating Namespace: $NAMESPACE"

    if kubectl get namespace $NAMESPACE &> /dev/null; then
        print_info "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace $NAMESPACE
        print_success "Created namespace $NAMESPACE"
    fi
}

check_secrets() {
    local service=$1
    local secret_name="${service}-secrets"

    if kubectl get secret $secret_name -n $NAMESPACE &> /dev/null; then
        return 0
    else
        return 1
    fi
}

install_service() {
    local service=$1
    local chart_dir="$BASE_DIR/$service"
    local values_file="values-${ENVIRONMENT}.yaml"

    print_header "Installing $service"

    # Check if chart exists
    if [ ! -d "$chart_dir" ]; then
        print_error "Chart directory not found: $chart_dir"
        return 1
    fi

    # Check if values file exists
    if [ ! -f "$chart_dir/$values_file" ]; then
        print_error "Values file not found: $chart_dir/$values_file"
        return 1
    fi

    # Check secrets (except for some services that don't need them)
    if [[ ! "$service" =~ ^(admin-app|cns-dashboard|customer-portal)$ ]]; then
        if ! check_secrets "$service"; then
            print_error "Secrets not found for $service. Create secret: ${service}-secrets"
            print_info "Skipping $service (create secrets first)"
            return 1
        fi
    fi

    # Install or upgrade
    if helm list -n $NAMESPACE | grep -q "^$service\s"; then
        print_info "Upgrading existing release..."
        helm upgrade $service $chart_dir \
            --namespace $NAMESPACE \
            --values $chart_dir/values.yaml \
            --values $chart_dir/$values_file \
            --set image.tag=$IMAGE_TAG \
            --wait \
            --timeout 5m
        print_success "Upgraded $service"
    else
        print_info "Installing new release..."
        helm install $service $chart_dir \
            --namespace $NAMESPACE \
            --values $chart_dir/values.yaml \
            --values $chart_dir/$values_file \
            --set image.tag=$IMAGE_TAG \
            --wait \
            --timeout 5m
        print_success "Installed $service"
    fi
}

install_all_services() {
    local services_to_install="$1"

    for service in $services_to_install; do
        install_service "$service" || true
    done
}

show_status() {
    print_header "Deployment Status"

    echo "Pods:"
    kubectl get pods -n $NAMESPACE

    echo ""
    echo "Services:"
    kubectl get svc -n $NAMESPACE

    echo ""
    echo "Ingresses:"
    kubectl get ingress -n $NAMESPACE
}

show_help() {
    cat << EOF
Ananta Platform Quick Installation Script

Usage: $0 <environment> [service1] [service2] ...

Environments:
  dev         Development environment
  staging     Staging environment
  prod        Production environment

Service Groups:
  infrastructure    Install infrastructure services (temporal, supabase, novu)
  control-plane     Install control plane services
  app-plane         Install app plane services
  all               Install all services (default)

Individual Services:
  $ALL_SERVICES

Examples:
  $0 dev                              # Install all services in dev
  $0 dev tenant-management-service    # Install single service
  $0 dev control-plane                # Install control plane services
  $0 staging infrastructure           # Install infrastructure in staging
  $0 prod all                         # Install everything in production

Environment Variables:
  IMAGE_TAG=v1.0.0                   # Override image tag (default: latest)

EOF
}

# Main
main() {
    if [ "$ENVIRONMENT" = "help" ] || [ "$ENVIRONMENT" = "-h" ] || [ "$ENVIRONMENT" = "--help" ]; then
        show_help
        exit 0
    fi

    if [ -z "$ENVIRONMENT" ]; then
        print_error "Environment not specified"
        show_help
        exit 1
    fi

    check_prerequisites
    create_namespace

    # Determine which services to install
    if [ $# -eq 1 ]; then
        # No specific services, install all
        print_info "Installing all services in $ENVIRONMENT environment"
        install_all_services "$INFRASTRUCTURE_SERVICES"
        install_all_services "$CONTROL_PLANE_SERVICES"
        install_all_services "$APP_PLANE_SERVICES"
    else
        shift # Remove environment argument

        # Process service groups and individual services
        for arg in "$@"; do
            case $arg in
                infrastructure)
                    install_all_services "$INFRASTRUCTURE_SERVICES"
                    ;;
                control-plane)
                    install_all_services "$CONTROL_PLANE_SERVICES"
                    ;;
                app-plane)
                    install_all_services "$APP_PLANE_SERVICES"
                    ;;
                all)
                    install_all_services "$ALL_SERVICES"
                    ;;
                *)
                    install_service "$arg"
                    ;;
            esac
        done
    fi

    show_status

    print_header "Installation Complete"
    print_success "Services deployed to namespace: $NAMESPACE"
    print_info "Check logs: kubectl logs -n $NAMESPACE deployment/<service-name>"
    print_info "Port-forward: kubectl port-forward -n $NAMESPACE svc/<service-name> <local-port>:<service-port>"
}

main "$@"
