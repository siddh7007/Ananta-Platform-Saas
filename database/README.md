# Database & Service Initialization - Single Source of Truth

This directory contains **ALL** initialization scripts for databases and services across the Ananta Platform.
These files are referenced by Terraform modules and deployment scripts.

## Directory Structure

```
database/
├── README.md                           # This file
├── migrations/                         # Database schema migrations (SQL)
│   ├── 001_SUPABASE_MASTER.sql        # App Plane - Supabase (Customer data)
│   ├── 002_COMPONENTS_V2_MASTER.sql   # App Plane - Component Catalog
│   ├── 003_ARC_SAAS_MASTER.sql        # Control Plane - Init schemas
│   ├── 004_CONTROL_PLANE_MASTER.sql   # DEPRECATED - overlaps with 003
│   ├── 005_DIRECTUS_ENRICHMENT_TABLES.sql    # Directus enrichment tables
│   └── 006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql # CNS enrichment config
├── keycloak/                           # Keycloak realm exports
│   ├── realm-ananta-saas.json         # Production realm (ananta-saas)
│   └── realm-app-plane.json           # App Plane realm (components-platform)
├── redis/                              # Redis configuration
│   └── redis.conf                     # Redis config with AOF persistence
├── minio/                              # MinIO object storage (S3-compatible)
│   └── init-buckets.sh                # Bucket initialization script
├── rabbitmq/                           # RabbitMQ message broker
│   ├── rabbitmq.conf                  # RabbitMQ configuration
│   └── enabled_plugins                # Enabled plugins list
├── novu/                               # Novu notification infrastructure
│   └── docker-compose.novu.yml        # Novu services compose file
├── master-seed/                        # Seed data scripts
│   └── apply-all-seeds.sh             # Apply seed data to all databases
└── scripts/
    └── apply-all-migrations.sh        # Apply all database migrations
```

## Database Architecture

| Database | Service | Port | Purpose |
|----------|---------|------|---------|
| `arc_saas` | Control Plane PG | 5432 | Tenant management, billing, subscriptions |
| `postgres` | Supabase | 5432 (k8s) | Customer data (BOMs, orgs, users) |
| `components_v2` | Components-V2 PG | 5432 (k8s) | Component catalog + CNS enrichment |

**Non-SQL Services:**
| Service | Port | Purpose |
|---------|------|---------|
| Redis | 6379 | Caching, session storage |
| RabbitMQ | 5672 (AMQP), 15672 (Mgmt) | Message broker |
| MinIO | 9000 (API), 9001 (Console) | S3-compatible object storage |

---

## Terraform Migration Execution Flow

When running `terraform apply`, all databases, services, and configurations are deployed automatically via Kubernetes resources and Jobs.

### Complete Deployment Timeline

```
terraform apply -var="deploy_app_plane=true" -var="include_app_plane_migrations=true"
       │
       ├─[PHASE 1: Namespaces] ───────────────────────────────────────────────┐
       │   ├── vault-system                                                    │
       │   ├── database-system                                                 │
       │   ├── cache-system                                                    │
       │   ├── auth-system                                                     │
       │   ├── temporal-system                                                 │
       │   ├── control-plane                                                   │
       │   └── app-plane                                                       │
       └──────────────────────────────────────────────────────────────────────┘
       │
       ├─[PHASE 2: Infrastructure Services] ──────────────────────────────────┐
       │   ├── PostgreSQL (database-system) - Control Plane DB                │
       │   │       └── Databases: arc_saas, keycloak, temporal                │
       │   ├── Redis (cache-system) - Session/token caching                   │
       │   └── Vault (vault-system) - Secrets management                      │
       └──────────────────────────────────────────────────────────────────────┘
       │
       ├─[PHASE 3: Control Plane Migrations] ─────────────────────────────────┐
       │   kubernetes_job.db_migration:                                        │
       │   ├── CREATE DATABASE arc_saas, keycloak, temporal                   │
       │   └── EXECUTE: 003_ARC_SAAS_MASTER.sql                               │
       │           ├── Schemas: main, subscription                            │
       │           ├── 30 tables with indexes                                 │
       │           └── Seed: 3 tenants, 9 users, 4 plans                      │
       └──────────────────────────────────────────────────────────────────────┘
       │
       ├─[PHASE 4: Identity Provider] ────────────────────────────────────────┐
       │   Keycloak (auth-system):                                             │
       │   ├── Import realm-ananta-saas.json                                  │
       │   │       ├── 5 roles: super_admin, owner, admin, engineer, analyst  │
       │   │       ├── 5 groups with role mappings                            │
       │   │       ├── 9 users (same UUIDs as database)                       │
       │   │       └── tenant_id/tenant_key attributes                        │
       │   └── Clients: ananta-saas-admin, ananta-saas-api, customer-portal   │
       └──────────────────────────────────────────────────────────────────────┘
       │
       ├─[PHASE 5: Workflow Engine] ──────────────────────────────────────────┐
       │   Temporal (temporal-system):                                         │
       │   ├── Temporal Server (port 7233)                                    │
       │   ├── Temporal UI (port 8080)                                        │
       │   └── Namespaces: arc-saas, enrichment, default                      │
       └──────────────────────────────────────────────────────────────────────┘
       │
       ├─[PHASE 6: Control Plane Services] ───────────────────────────────────┐
       │   control-plane namespace:                                            │
       │   ├── tenant-management-service (port 14000)                         │
       │   ├── orchestrator-service (port 3001)                               │
       │   ├── subscription-service (port 3002)                               │
       │   ├── temporal-worker-service                                        │
       │   └── admin-app (port 80/27555)                                      │
       └──────────────────────────────────────────────────────────────────────┘
       │
       ├─[IF deploy_app_plane=true] ──────────────────────────────────────────┐
       │                                                                        │
       │   ┌─[PHASE 7: App Plane Databases] ─────────────────────────────────┐│
       │   │   supabase-db (StatefulSet):                                     ││
       │   │   ├── Database: postgres                                         ││
       │   │   └── Port: 5432 (internal)                                      ││
       │   │                                                                   ││
       │   │   components-db (StatefulSet):                                   ││
       │   │   ├── Database: components_v2                                    ││
       │   │   └── Port: 5432 (internal)                                      ││
       │   └─────────────────────────────────────────────────────────────────┘│
       │                                                                        │
       │   ┌─[PHASE 8: App Plane Object Storage] ────────────────────────────┐│
       │   │   MinIO (StatefulSet):                                           ││
       │   │   ├── API: port 9000                                             ││
       │   │   ├── Console: port 9001                                         ││
       │   │   └── minio-bucket-init Job creates:                             ││
       │   │           ├── bom-uploads                                        ││
       │   │           ├── documents                                          ││
       │   │           ├── exports                                            ││
       │   │           ├── avatars (public download)                          ││
       │   │           ├── enrichment-audit                                   ││
       │   │           ├── bulk-uploads                                       ││
       │   │           └── novu-storage                                       ││
       │   └─────────────────────────────────────────────────────────────────┘│
       │                                                                        │
       │   ┌─[PHASE 9: App Plane Message Broker] ────────────────────────────┐│
       │   │   RabbitMQ (StatefulSet):                                        ││
       │   │   ├── AMQP: port 5672                                            ││
       │   │   └── Management UI: port 15672                                  ││
       │   │                                                                   ││
       │   │   Redis (StatefulSet):                                           ││
       │   │   └── Port: 6379                                                 ││
       │   └─────────────────────────────────────────────────────────────────┘│
       │                                                                        │
       │   ┌─[PHASE 10: App Plane Migrations] ───────────────────────────────┐│
       │   │   kubernetes_job.app_plane_migration:                            ││
       │   │   ├── 001_SUPABASE_MASTER.sql → supabase-db                      ││
       │   │   │       ├── 82+ tables with RLS policies                       ││
       │   │   │       └── Seed: 3 orgs, 9 users, workspaces, projects        ││
       │   │   ├── 002_COMPONENTS_V2_MASTER.sql → components-db               ││
       │   │   │       ├── component_catalog table (UUID pk)                  ││
       │   │   │       ├── catalog_components view                            ││
       │   │   │       └── 57 tables total                                    ││
       │   │   └── 005_DIRECTUS_ENRICHMENT_TABLES.sql → components-db         ││
       │   │           └── enrichment queue/history tables                    ││
       │   └─────────────────────────────────────────────────────────────────┘│
       │                                                                        │
       │   ┌─[PHASE 11: App Plane Services] ─────────────────────────────────┐│
       │   │   supabase-api (PostgREST): port 3000                            ││
       │   │   supabase-studio: port 3001                                     ││
       │   │   cns-service: port 8080 (internal)                              ││
       │   │   customer-portal: port 80 (Nginx)                               ││
       │   └─────────────────────────────────────────────────────────────────┘│
       │                                                                        │
       └────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                      DEPLOYMENT COMPLETE (~5-8 minutes)
═══════════════════════════════════════════════════════════════════════════════
```

### Port Forwarding for Testing

After deployment, set up port forwarding to access services:

```bash
# Control Plane
kubectl port-forward -n control-plane svc/tenant-management-service 14000:14000 &
kubectl port-forward -n auth-system svc/keycloak 8180:8080 &
kubectl port-forward -n temporal-system svc/temporal-ui 27021:8080 &

# App Plane
kubectl port-forward -n app-plane svc/customer-portal 27100:80 &
kubectl port-forward -n app-plane svc/cns-service 27200:8080 &
kubectl port-forward -n app-plane svc/supabase-api 27810:3000 &
kubectl port-forward -n app-plane svc/supabase-studio 27800:3001 &
kubectl port-forward -n app-plane svc/minio-console 27041:9001 &
kubectl port-forward -n app-plane svc/rabbitmq 27673:15672 &
```

### Service URLs (Local Development)

| Service | URL | Credentials |
|---------|-----|-------------|
| Keycloak | http://localhost:8180 | admin / admin123 |
| Tenant Management API | http://localhost:14000 | JWT Bearer token |
| Temporal UI | http://localhost:27021 | - |
| Customer Portal | http://localhost:27100 | superadmin@ananta.dev / Test1234! |
| CNS Service | http://localhost:27200 | - |
| Supabase Studio | http://localhost:27800 | postgres / postgres |
| MinIO Console | http://localhost:27041 | minioadmin / minioadmin |
| RabbitMQ Mgmt | http://localhost:27673 | admin / admin123 |

### ConfigMap Sources (Terraform References)

| ConfigMap | Namespace | Migration Files | Source Path |
|-----------|-----------|-----------------|-------------|
| `ananta-db-migrations` | database-system | 003, 006 | `database/migrations/` |
| `ananta-app-plane-migrations` | database-system | 001, 002, 005 | `database/migrations/` |
| `ananta-keycloak-realm` | auth-system | realm-ananta-saas.json | `database/keycloak/` |

### Terraform Variables

| Variable | Default | Effect |
|----------|---------|--------|
| `deploy_app_plane` | `false` | Deploys App Plane namespace and services |
| `include_app_plane_migrations` | `false` | Creates ConfigMap + runs App Plane migration job |

**Enable all migrations:**
```bash
cd infrastructure/terraform/environments/local
terraform apply \
  -var="deploy_app_plane=true" \
  -var="include_app_plane_migrations=true"
```

---

## Quick Start - Apply All Migrations

### Using the migration script:

```bash
# Local Docker (default)
./database/scripts/apply-all-migrations.sh

# Kubernetes
./database/scripts/apply-all-migrations.sh --mode k8s

# Dry run (show commands without executing)
./database/scripts/apply-all-migrations.sh --dry-run
```

### Manual execution (Kubernetes):

```bash
# Control Plane
kubectl exec -i -n database-system ananta-local-pg-0 -- psql -U postgres -d arc_saas \
  < database/migrations/003_ARC_SAAS_MASTER.sql

# App Plane - Supabase
kubectl exec -i -n app-plane supabase-db-0 -- psql -U postgres -d postgres \
  < database/migrations/001_SUPABASE_MASTER.sql

# App Plane - Components-V2
kubectl exec -i -n app-plane components-db-0 -- psql -U postgres -d components_v2 \
  < database/migrations/002_COMPONENTS_V2_MASTER.sql

# Enrichment tables (after 002)
kubectl exec -i -n app-plane components-db-0 -- psql -U postgres -d components_v2 \
  < database/migrations/005_DIRECTUS_ENRICHMENT_TABLES.sql
```

---

## Service Initialization

### Keycloak Realm Import

```bash
# Import realm during Keycloak startup (Docker)
docker run -v ./database/keycloak:/opt/keycloak/data/import \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin123 \
  quay.io/keycloak/keycloak:24.0 \
  start-dev --import-realm

# Or via Keycloak Admin CLI
./kcadm.sh create realms -f database/keycloak/realm-ananta-saas.json
```

### MinIO Bucket Setup

```bash
# Run the init script inside MinIO container
docker exec -it minio sh -c "$(cat database/minio/init-buckets.sh)"

# Or with environment variables
MINIO_ENDPOINT=http://localhost:9000 ./database/minio/init-buckets.sh
```

### Redis Configuration

```bash
# Start Redis with custom config
redis-server database/redis/redis.conf

# Or mount in Docker
docker run -v ./database/redis/redis.conf:/usr/local/etc/redis/redis.conf \
  redis:7-alpine redis-server /usr/local/etc/redis/redis.conf
```

### RabbitMQ Configuration

```bash
# Mount config in Docker
docker run -v ./database/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf \
  -v ./database/rabbitmq/enabled_plugins:/etc/rabbitmq/enabled_plugins \
  rabbitmq:3.12-management
```

---

## UUID Conventions

All UUIDs follow a strict prefix convention to maintain consistency across databases:

| Prefix | Entity Type | Database | Example |
|--------|-------------|----------|---------|
| `a0...` | Organizations (App Plane) | Supabase | `a0000000-0000-0000-0000-000000000001` |
| `b0...` | Tenants (Control Plane) | arc_saas | `b0000000-0000-0000-0000-000000000001` |
| `c0...` | Users (All Planes) | All | `c0000000-0000-0000-0000-000000000001` |
| `d1...` | Workspaces | Supabase | `d1000000-0000-0000-0000-000000000001` |
| `e1...` | Projects | Supabase | `e1000000-0000-0000-0000-000000000001` |
| `f1...` | BOMs | Supabase | `f1000000-0000-0000-0000-000000000001` |
| `p0...` | Plans | arc_saas | `p0000000-0000-0000-0000-000000000001` |
| `s0...` | Subscriptions | arc_saas | `s0000000-0000-0000-0000-000000000001` |

## Tenant/Organization Mapping

**CRITICAL**: Control Plane "tenants" map to App Plane "organizations":

| Control Plane (arc_saas) | App Plane (Supabase) | Description |
|--------------------------|----------------------|-------------|
| `b0...001` (tenant) | `a0...001` (org) | Ananta Platform |
| `b0...002` (tenant) | `a0...002` (org) | CNS Staff |
| `b0...000` (tenant) | `a0...000` (org) | Demo Organization |

---

## Seed Users

All users have the **same UUID** across Keycloak, Control Plane, and App Plane:

| User ID | Email | Role | Organization |
|---------|-------|------|--------------|
| `c0...001` | superadmin@ananta.dev | super_admin | Ananta Platform |
| `c0...002` | cns-lead@ananta.dev | owner | CNS Staff |
| `c0...003` | cns-engineer@ananta.dev | engineer | CNS Staff |
| `c0...004` | demo-owner@example.com | owner | Demo Organization |
| `c0...005` | demo-engineer@example.com | engineer | Demo Organization |
| `c0...010` | cbpadmin@ananta.dev | super_admin | Ananta Platform |
| `c0...011` | cnsstaff@ananta.dev | engineer | CNS Staff |
| `c0...012` | backstage-admin@ananta.dev | admin | Ananta Platform |
| `c0...013` | demo-analyst@example.com | analyst | Demo Organization |

## Default Passwords

For local development/testing only:
- All seed users: `Test1234!`
- Keycloak admin: `admin123`
- PostgreSQL: `postgres`
- MinIO: `minioadmin / minioadmin`
- RabbitMQ: `admin / admin123`

---

## Migration Details

### IMPORTANT: Migration Dependencies

| Migration | Target DB | Dependencies | Notes |
|-----------|-----------|--------------|-------|
| `001_SUPABASE_MASTER.sql` | postgres | None | App Plane customer data (82+ tables) |
| `002_COMPONENTS_V2_MASTER.sql` | components_v2 | None | Component catalog SSOT - creates `component_catalog` TABLE |
| `003_ARC_SAAS_MASTER.sql` | arc_saas | None | Control Plane - **AUTHORITATIVE** (30 tables in main/subscription schemas) |
| `004_CONTROL_PLANE_MASTER.sql` | ananta | - | **DEPRECATED** - Overlaps with 003, skip in new deployments |
| `005_DIRECTUS_ENRICHMENT_TABLES.sql` | components_v2 | 002 | Enrichment queue/history - FKs reference `component_catalog(id)` UUID |
| `006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql` | arc_saas | 003 | CNS config - FKs reference `main.tenants(id)` |

### Critical Schema Notes

- **`component_catalog`** is the **TABLE** with UUID primary key (`id UUID PRIMARY KEY`)
- **`catalog_components`** is a **VIEW** mapping to `component_catalog` - do NOT reference in FKs
- **`main.tenants`** is the tenants table in Control Plane (schema: `main`)
- Migration 005/006 FKs are correctly configured to reference tables, not views

---

## Verification Commands

After deployment, verify migrations applied correctly:

```bash
# Control Plane - Check users
kubectl exec -n database-system ananta-local-pg-0 -- \
  psql -U postgres -d arc_saas -c "SELECT email, role FROM main.users ORDER BY id;"

# App Plane - Check organizations
kubectl exec -n app-plane supabase-db-0 -- \
  psql -U postgres -d postgres -c "SELECT id, name FROM organizations;"

# App Plane - Check component_catalog table exists
kubectl exec -n app-plane components-db-0 -- \
  psql -U postgres -d components_v2 -c "\d component_catalog"

# Keycloak - List users in realm
kubectl exec -n auth-system deploy/keycloak -- \
  /opt/keycloak/bin/kcadm.sh get users -r ananta-saas --fields username,email
```

---

## Terraform Integration

These files are referenced by Terraform modules in `infrastructure/terraform/`:

```hcl
# environments/local/main.tf - Control Plane migrations
resource "kubernetes_config_map" "db_migrations" {
  data = {
    "003_ARC_SAAS_MASTER.sql" = file("${local.project_root}/database/migrations/003_ARC_SAAS_MASTER.sql")
    "006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql" = file("${local.project_root}/database/migrations/006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql")
  }
}

# App Plane migrations
resource "kubernetes_config_map" "app_plane_migrations" {
  data = {
    "001_SUPABASE_MASTER.sql" = file("${local.project_root}/database/migrations/001_SUPABASE_MASTER.sql")
    "002_COMPONENTS_V2_MASTER.sql" = file("${local.project_root}/database/migrations/002_COMPONENTS_V2_MASTER.sql")
    "005_DIRECTUS_ENRICHMENT_TABLES.sql" = file("${local.project_root}/database/migrations/005_DIRECTUS_ENRICHMENT_TABLES.sql")
  }
}

# Keycloak realm
resource "kubernetes_config_map" "keycloak_realm" {
  data = {
    "ananta-saas-realm.json" = file("${local.project_root}/database/keycloak/realm-ananta-saas.json")
  }
}
```

---

## DO NOT CREATE DUPLICATE FILES

- All database/service init changes go into these files
- Never create duplicate init files in other locations
- Update this directory only, then reference from other scripts
- Keep Terraform modules pointing to this single source of truth
