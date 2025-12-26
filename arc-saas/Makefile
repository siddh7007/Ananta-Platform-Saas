# =============================================================================
# ARC SaaS Development Commands
# =============================================================================

.PHONY: help up down restart logs ps clean dev services novu temporal

# Default target
help:
	@echo ""
	@echo "ARC SaaS Development Commands"
	@echo "=============================="
	@echo ""
	@echo "Infrastructure:"
	@echo "  make up          - Start all infrastructure (postgres, redis, temporal, etc.)"
	@echo "  make down        - Stop all containers"
	@echo "  make restart     - Restart all containers"
	@echo "  make logs        - View all logs"
	@echo "  make ps          - List running containers"
	@echo "  make clean       - Stop and remove all containers + volumes"
	@echo ""
	@echo "Selective Start:"
	@echo "  make core        - Start core only (postgres, redis)"
	@echo "  make temporal    - Start Temporal stack"
	@echo "  make novu        - Start Novu notification stack"
	@echo "  make keycloak    - Start Keycloak IdP"
	@echo "  make observe     - Start observability (Jaeger)"
	@echo ""
	@echo "Services:"
	@echo "  make services    - Start all ARC SaaS services"
	@echo "  make dev         - Start infrastructure + run services locally"
	@echo ""
	@echo "Database:"
	@echo "  make db-shell    - Open PostgreSQL shell"
	@echo "  make db-reset    - Reset database (WARNING: deletes data)"
	@echo ""
	@echo "URLs:"
	@echo "  PostgreSQL:      localhost:5432"
	@echo "  Redis:           localhost:6379"
	@echo "  Temporal UI:     http://localhost:8088"
	@echo "  Keycloak:        http://localhost:8180"
	@echo "  Novu Dashboard:  http://localhost:4200"
	@echo "  Novu API:        http://localhost:3000"
	@echo "  Jaeger UI:       http://localhost:16686"
	@echo ""

# =============================================================================
# Infrastructure Commands
# =============================================================================

# Start all infrastructure
up:
	docker-compose up -d postgres redis temporal temporal-postgresql temporal-ui jaeger
	@echo ""
	@echo "Infrastructure started!"
	@echo "  - PostgreSQL:    localhost:5432"
	@echo "  - Redis:         localhost:6379"
	@echo "  - Temporal:      localhost:7233"
	@echo "  - Temporal UI:   http://localhost:8088"
	@echo "  - Jaeger:        http://localhost:16686"

# Stop all containers
down:
	docker-compose down

# Restart all
restart:
	docker-compose restart

# View logs
logs:
	docker-compose logs -f

# List containers
ps:
	docker-compose ps

# Clean everything including volumes
clean:
	docker-compose down -v --remove-orphans
	@echo "All containers and volumes removed"

# =============================================================================
# Selective Start Commands
# =============================================================================

# Start core infrastructure only
core:
	docker-compose up -d postgres redis
	@echo "Core infrastructure started (PostgreSQL + Redis)"

# Start Temporal stack
temporal:
	docker-compose up -d temporal-postgresql temporal temporal-ui
	@echo "Temporal started - UI at http://localhost:8088"

# Start Novu notification stack
novu:
	docker-compose up -d novu-mongodb novu-redis novu-api novu-worker novu-web
	@echo "Novu started:"
	@echo "  - Dashboard: http://localhost:4200"
	@echo "  - API:       http://localhost:3000"

# Start Keycloak
keycloak:
	docker-compose up -d postgres keycloak
	@echo "Keycloak started at http://localhost:8180"
	@echo "  Admin: admin / admin"

# Start observability stack
observe:
	docker-compose up -d jaeger
	@echo "Jaeger started at http://localhost:16686"

# =============================================================================
# Full Stack
# =============================================================================

# Start all infrastructure + Novu + Keycloak
all:
	docker-compose up -d postgres redis temporal-postgresql temporal temporal-ui jaeger keycloak novu-mongodb novu-redis novu-api novu-worker novu-web
	@echo ""
	@echo "Full stack started!"
	@make urls

# Start services (requires docker build)
services:
	docker-compose --profile services up -d
	@echo "Services started"

# =============================================================================
# Development Mode
# =============================================================================

# Start infrastructure and run services locally
dev: up
	@echo ""
	@echo "Infrastructure ready! Now run services locally:"
	@echo ""
	@echo "Terminal 1: cd services/tenant-management-service && npm run start:dev"
	@echo "Terminal 2: cd services/subscription-service && npm run start:dev"
	@echo "Terminal 3: cd services/temporal-worker-service && npm run start:dev"
	@echo ""

# =============================================================================
# Database Commands
# =============================================================================

# Open PostgreSQL shell
db-shell:
	docker exec -it arc-saas-postgres psql -U postgres -d arc_saas

# Reset database
db-reset:
	docker-compose down postgres
	docker volume rm arc-saas_postgres-data || true
	docker-compose up -d postgres
	@echo "Database reset complete"

# Create a new tenant schema
db-create-tenant:
	@read -p "Enter tenant key: " key; \
	docker exec -it arc-saas-postgres psql -U postgres -d arc_saas -c "SELECT create_tenant_schema('$$key');"

# =============================================================================
# Temporal Commands
# =============================================================================

# Create arc-saas namespace in Temporal
temporal-namespace:
	docker exec arc-saas-temporal temporal operator namespace create arc-saas
	@echo "Namespace 'arc-saas' created"

# List Temporal namespaces
temporal-namespaces:
	docker exec arc-saas-temporal temporal operator namespace list

# List workflows
temporal-workflows:
	docker exec arc-saas-temporal temporal workflow list --namespace arc-saas

# =============================================================================
# Utility Commands
# =============================================================================

# Show all URLs
urls:
	@echo ""
	@echo "Service URLs:"
	@echo "============="
	@echo "PostgreSQL:      localhost:5432 (postgres/postgres)"
	@echo "Redis:           localhost:6379"
	@echo "Temporal UI:     http://localhost:8088"
	@echo "Keycloak:        http://localhost:8180 (admin/admin)"
	@echo "Novu Dashboard:  http://localhost:4200"
	@echo "Novu API:        http://localhost:3000"
	@echo "Jaeger UI:       http://localhost:16686"
	@echo ""

# Health check
health:
	@echo "Checking services..."
	@docker exec arc-saas-postgres pg_isready -U postgres && echo "PostgreSQL: OK" || echo "PostgreSQL: FAIL"
	@docker exec arc-saas-redis redis-cli ping | grep -q PONG && echo "Redis: OK" || echo "Redis: FAIL"
	@curl -s http://localhost:8088 > /dev/null && echo "Temporal UI: OK" || echo "Temporal UI: FAIL"
	@curl -s http://localhost:16686 > /dev/null && echo "Jaeger: OK" || echo "Jaeger: FAIL"
