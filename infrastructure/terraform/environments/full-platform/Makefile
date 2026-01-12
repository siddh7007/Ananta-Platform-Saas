# Ananta Platform SaaS - Terraform Makefile
# Convenience commands for managing the full platform deployment

.PHONY: help init plan apply destroy validate format clean status outputs

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Ananta Platform SaaS - Terraform Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

init: ## Initialize Terraform
	@echo "$(BLUE)Initializing Terraform...$(NC)"
	terraform init
	@echo "$(GREEN)Terraform initialized successfully$(NC)"

validate: ## Validate Terraform configuration
	@echo "$(BLUE)Validating Terraform configuration...$(NC)"
	terraform validate
	@echo "$(GREEN)Configuration is valid$(NC)"

format: ## Format Terraform files
	@echo "$(BLUE)Formatting Terraform files...$(NC)"
	terraform fmt -recursive
	@echo "$(GREEN)Files formatted$(NC)"

plan: ## Create Terraform plan
	@echo "$(BLUE)Creating Terraform plan...$(NC)"
	terraform plan -out=tfplan
	@echo "$(GREEN)Plan created: tfplan$(NC)"
	@echo "$(YELLOW)Review the plan above, then run 'make apply' to apply changes$(NC)"

plan-destroy: ## Create Terraform destroy plan
	@echo "$(BLUE)Creating Terraform destroy plan...$(NC)"
	terraform plan -destroy -out=tfplan-destroy
	@echo "$(YELLOW)Review the plan above, then run 'make destroy' to destroy resources$(NC)"

apply: ## Apply Terraform plan
	@echo "$(BLUE)Applying Terraform plan...$(NC)"
	@if [ ! -f tfplan ]; then \
		echo "$(RED)Error: tfplan not found. Run 'make plan' first.$(NC)"; \
		exit 1; \
	fi
	terraform apply tfplan
	@rm -f tfplan
	@echo "$(GREEN)Platform deployed successfully!$(NC)"
	@echo "$(YELLOW)Run 'make outputs' to see service endpoints$(NC)"

apply-auto: ## Plan and apply without confirmation (DANGEROUS!)
	@echo "$(YELLOW)WARNING: This will apply changes without confirmation!$(NC)"
	terraform apply -auto-approve
	@echo "$(GREEN)Platform deployed successfully!$(NC)"

destroy: ## Destroy all resources
	@echo "$(RED)WARNING: This will destroy ALL resources!$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to cancel, or wait 10 seconds to continue...$(NC)"
	@sleep 10
	terraform destroy
	@echo "$(GREEN)All resources destroyed$(NC)"

destroy-force: ## Force destroy all resources (DANGEROUS!)
	@echo "$(RED)DANGER: Force destroying all resources!$(NC)"
	terraform destroy -auto-approve
	@echo "$(GREEN)All resources destroyed$(NC)"

outputs: ## Show Terraform outputs
	@echo "$(BLUE)Terraform Outputs:$(NC)"
	@terraform output

outputs-json: ## Show Terraform outputs in JSON format
	@terraform output -json

status: ## Show platform deployment status
	@echo "$(BLUE)Platform Deployment Status:$(NC)"
	@terraform output -json platform_status | jq -r '.'

endpoints: ## Show all service endpoints
	@echo "$(BLUE)Service Endpoints:$(NC)"
	@echo ""
	@echo "$(GREEN)Infrastructure:$(NC)"
	@terraform output -json infrastructure_endpoints | jq -r 'to_entries[] | "  \(.key): \(.value)"'
	@echo ""
	@echo "$(GREEN)Control Plane:$(NC)"
	@terraform output -json control_plane_endpoints | jq -r 'to_entries[] | "  \(.key): \(.value)"'
	@echo ""
	@echo "$(GREEN)App Plane:$(NC)"
	@terraform output -json app_plane_endpoints | jq -r 'to_entries[] | "  \(.key): \(.value)"'
	@echo ""
	@echo "$(GREEN)Observability:$(NC)"
	@terraform output -json observability_endpoints | jq -r 'to_entries[] | "  \(.key): \(.value)"'

quick-access: ## Show quick access URLs
	@echo "$(BLUE)Quick Access URLs:$(NC)"
	@terraform output -json quick_access_urls | jq -r '.description'
	@echo ""
	@terraform output -json quick_access_urls | jq -r 'to_entries[] | select(.key != "description") | "$(GREEN)\(.value.description)$(NC)\n  \(.value.url)\n"'

credentials: ## Show admin credentials (SENSITIVE!)
	@echo "$(RED)SENSITIVE: Admin Credentials$(NC)"
	@terraform output -json admin_credentials | jq -r '.'

connections: ## Show connection strings (SENSITIVE!)
	@echo "$(RED)SENSITIVE: Connection Strings$(NC)"
	@terraform output -json connection_strings | jq -r '.'

clean: ## Clean Terraform cache and plan files
	@echo "$(BLUE)Cleaning Terraform files...$(NC)"
	rm -rf .terraform
	rm -f .terraform.lock.hcl
	rm -f tfplan tfplan-destroy
	rm -f *.log
	@echo "$(GREEN)Cleaned successfully$(NC)"

refresh: ## Refresh Terraform state
	@echo "$(BLUE)Refreshing Terraform state...$(NC)"
	terraform refresh
	@echo "$(GREEN)State refreshed$(NC)"

state-list: ## List all resources in state
	@echo "$(BLUE)Resources in Terraform state:$(NC)"
	@terraform state list

state-show: ## Show details of a specific resource (usage: make state-show RESOURCE=module.database.helm_release.postgresql)
	@if [ -z "$(RESOURCE)" ]; then \
		echo "$(RED)Error: RESOURCE not specified$(NC)"; \
		echo "Usage: make state-show RESOURCE=module.database.helm_release.postgresql"; \
		exit 1; \
	fi
	terraform state show $(RESOURCE)

graph: ## Generate dependency graph
	@echo "$(BLUE)Generating dependency graph...$(NC)"
	terraform graph | dot -Tpng > graph.png
	@echo "$(GREEN)Graph saved to graph.png$(NC)"

cost: ## Estimate infrastructure cost (requires infracost)
	@echo "$(BLUE)Estimating infrastructure cost...$(NC)"
	@if ! command -v infracost &> /dev/null; then \
		echo "$(RED)Error: infracost not installed$(NC)"; \
		echo "Install from: https://www.infracost.io/docs/"; \
		exit 1; \
	fi
	infracost breakdown --path .

cost-diff: ## Show cost difference (requires infracost and tfplan)
	@echo "$(BLUE)Calculating cost difference...$(NC)"
	@if [ ! -f tfplan ]; then \
		echo "$(RED)Error: tfplan not found. Run 'make plan' first.$(NC)"; \
		exit 1; \
	fi
	infracost diff --path tfplan

watch-pods: ## Watch all pods across namespaces
	@kubectl get pods --all-namespaces -w

watch-namespace: ## Watch pods in specific namespace (usage: make watch-namespace NS=control-plane)
	@if [ -z "$(NS)" ]; then \
		echo "$(RED)Error: NS not specified$(NC)"; \
		echo "Usage: make watch-namespace NS=control-plane"; \
		exit 1; \
	fi
	kubectl get pods -n $(NS) -w

logs: ## View logs for a service (usage: make logs SERVICE=tenant-management NS=control-plane)
	@if [ -z "$(SERVICE)" ] || [ -z "$(NS)" ]; then \
		echo "$(RED)Error: SERVICE or NS not specified$(NC)"; \
		echo "Usage: make logs SERVICE=tenant-management NS=control-plane"; \
		exit 1; \
	fi
	kubectl logs -f -l app=$(SERVICE) -n $(NS)

shell: ## Get shell in a pod (usage: make shell POD=tenant-management-xxx NS=control-plane)
	@if [ -z "$(POD)" ] || [ -z "$(NS)" ]; then \
		echo "$(RED)Error: POD or NS not specified$(NC)"; \
		echo "Usage: make shell POD=tenant-management-xxx NS=control-plane"; \
		exit 1; \
	fi
	kubectl exec -it $(POD) -n $(NS) -- /bin/bash

port-forward: ## Port forward to a service (usage: make port-forward SERVICE=postgresql NS=database-system PORT=5432)
	@if [ -z "$(SERVICE)" ] || [ -z "$(NS)" ] || [ -z "$(PORT)" ]; then \
		echo "$(RED)Error: SERVICE, NS, or PORT not specified$(NC)"; \
		echo "Usage: make port-forward SERVICE=postgresql NS=database-system PORT=5432"; \
		exit 1; \
	fi
	kubectl port-forward -n $(NS) svc/$(SERVICE) $(PORT):$(PORT)

check-health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo ""
	@echo "$(GREEN)Namespaces:$(NC)"
	@kubectl get namespaces | grep -E 'control-plane|app-plane|auth-system|temporal-system|notifications|monitoring-system|database-system|cache-system|argocd'
	@echo ""
	@echo "$(GREEN)Pods (should all be Running):$(NC)"
	@kubectl get pods --all-namespaces | grep -E 'control-plane|app-plane|auth-system|temporal-system|notifications|monitoring-system|database-system|cache-system|argocd'
	@echo ""
	@echo "$(GREEN)Services:$(NC)"
	@kubectl get services --all-namespaces | grep -E 'control-plane|app-plane|auth-system|temporal-system|notifications|monitoring-system|database-system|cache-system|argocd'

backup-state: ## Backup Terraform state
	@echo "$(BLUE)Backing up Terraform state...$(NC)"
	@mkdir -p backups
	terraform state pull > backups/terraform.tfstate.backup-$(shell date +%Y%m%d-%H%M%S)
	@echo "$(GREEN)State backed up to backups/$(NC)"

setup: init validate ## Setup: Initialize and validate
	@echo "$(GREEN)Setup complete!$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Copy terraform.tfvars.example to terraform.tfvars"
	@echo "  2. Edit terraform.tfvars with your configuration"
	@echo "  3. Run 'make plan' to see what will be created"
	@echo "  4. Run 'make apply' to deploy the platform"

deploy: plan apply ## Full deployment: plan + apply

docs: ## Generate documentation
	@echo "$(BLUE)Generating Terraform documentation...$(NC)"
	@if ! command -v terraform-docs &> /dev/null; then \
		echo "$(RED)Error: terraform-docs not installed$(NC)"; \
		echo "Install from: https://terraform-docs.io/"; \
		exit 1; \
	fi
	terraform-docs markdown table . > TERRAFORM.md
	@echo "$(GREEN)Documentation saved to TERRAFORM.md$(NC)"

# Development shortcuts
dev-init: ## Initialize for development environment
	@echo "$(BLUE)Setting up development environment...$(NC)"
	@if [ ! -f terraform.tfvars ]; then \
		cp terraform.tfvars.example terraform.tfvars; \
		echo "$(GREEN)Created terraform.tfvars from example$(NC)"; \
		echo "$(YELLOW)Please edit terraform.tfvars with your values$(NC)"; \
	else \
		echo "$(YELLOW)terraform.tfvars already exists$(NC)"; \
	fi
	make init
	@echo "$(GREEN)Development environment ready!$(NC)"

prod-check: ## Pre-production deployment checklist
	@echo "$(BLUE)Production Deployment Checklist:$(NC)"
	@echo ""
	@echo "$(YELLOW)Security:$(NC)"
	@echo "  [ ] All passwords changed from defaults"
	@echo "  [ ] TLS enabled for all services"
	@echo "  [ ] Network policies configured"
	@echo "  [ ] RBAC configured in Keycloak"
	@echo ""
	@echo "$(YELLOW)High Availability:$(NC)"
	@echo "  [ ] PostgreSQL replication enabled (3+ replicas)"
	@echo "  [ ] Redis Sentinel enabled (3+ replicas)"
	@echo "  [ ] Multiple replicas for all services"
	@echo ""
	@echo "$(YELLOW)Backup & Recovery:$(NC)"
	@echo "  [ ] Database backups configured"
	@echo "  [ ] Backup retention policy set"
	@echo "  [ ] Disaster recovery plan documented"
	@echo "  [ ] Terraform state in remote backend (S3/GCS)"
	@echo ""
	@echo "$(YELLOW)Monitoring:$(NC)"
	@echo "  [ ] Prometheus alerts configured"
	@echo "  [ ] Grafana dashboards imported"
	@echo "  [ ] Log aggregation working (Loki)"
	@echo "  [ ] Distributed tracing enabled (Tempo)"
	@echo ""
	@echo "$(YELLOW)Performance:$(NC)"
	@echo "  [ ] Resource limits tuned for production"
	@echo "  [ ] Autoscaling configured"
	@echo "  [ ] Storage classes optimized (SSD/NVMe)"
	@echo ""
	@echo "$(GREEN)Run 'make plan' to review changes$(NC)"
