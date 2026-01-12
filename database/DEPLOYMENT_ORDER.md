# Ananta Platform - Deployment Order Guide

This document describes the correct deployment order for the Ananta Platform SaaS infrastructure to ensure seamless initialization and startup.

## Deployment Architecture

```
                          +-------------------+
                          |    Terraform      |
                          |  Infrastructure   |
                          +-------------------+
                                   |
           +-------------------------------------------+
           |                       |                   |
           v                       v                   v
    +-------------+        +-------------+      +-------------+
    | StatefulSets|        | Kubernetes  |      | Kubernetes  |
    | (Databases) |        | ConfigMaps  |      | Secrets     |
    +-------------+        +-------------+      +-------------+
           |                       |                   |
           +-----------------------+-------------------+
                                   |
                                   v
                    +-----------------------------+
                    |    Kubernetes Jobs          |
                    | (db_migration,              |
                    |  rabbitmq_stream_init)      |
                    +-----------------------------+
                                   |
                                   v
                    +-----------------------------+
                    |    Deployments              |
                    | (CNS Service, CNS Worker,   |
                    |  Customer Portal, etc.)     |
                    +-----------------------------+
```

## Phase 1: Infrastructure StatefulSets

These must be running before any migrations or applications:

| Order | Resource | Type | Purpose |
|-------|----------|------|---------|
| 1.1 | supabase-db | StatefulSet | App Plane PostgreSQL (tenant data) |
| 1.2 | components-db | StatefulSet | Components-V2 PostgreSQL (component catalog) |
| 1.3 | redis | StatefulSet | Cache layer |
| 1.4 | rabbitmq | StatefulSet | Message broker |
| 1.5 | minio | StatefulSet | Object storage (optional) |

**Verification:**
```bash
kubectl get statefulsets -n app-plane
# All should show READY state
```

## Phase 2: Configuration Resources

Applied alongside StatefulSets (no ordering dependency):

| Resource | Type | Purpose |
|----------|------|---------|
| cns-service-config | ConfigMap | CNS Service configuration |
| cns-worker-config | ConfigMap | CNS Worker configuration |
| db-credentials | Secret | Database credentials |

## Phase 3: Kubernetes Jobs (Migrations)

These run AFTER StatefulSets are ready and BEFORE Deployments start:

| Order | Job | Depends On | Purpose |
|-------|-----|------------|---------|
| 3.1 | db_migration | supabase-db, components-db | Apply SQL migrations |
| 3.2 | rabbitmq_stream_init | rabbitmq | Create streams and exchanges |

**Migration Job Details:**

### db_migration Job
Applies migrations from `database/migrations/`:
1. `001_SUPABASE_MASTER.sql` - Supabase schema (boms, bom_line_items, organizations, etc.)
2. `002_COMPONENTS_V2_MASTER.sql` - Components-V2 schema (components, manufacturers, etc.)
3. `003_ARC_SAAS_MASTER.sql` - Control Plane schema (tenants, subscriptions, etc.)
4. `005_DIRECTUS_ENRICHMENT_TABLES.sql` - Enrichment tables
5. `006_DIRECTUS_CNS_ENRICHMENT_CONFIG.sql` - CNS enrichment config
6. `007_component_catalog_table.sql` - Component catalog table with indexes
7. `008_column_mapping_templates.sql` - Column mapping templates for BOM uploads

### rabbitmq_stream_init Job
Creates RabbitMQ streams and exchanges:

**Exchanges:**
- `platform.events` (fanout) - Platform-wide event broadcast
- `bom.events` (topic) - BOM-specific events with routing
- `enrichment.events` (topic) - Enrichment workflow events

**Streams:**
- `stream.platform.admin` - Platform admin notifications
- `stream.platform.bom` - BOM workflow updates
- `stream.bom.progress` - Real-time BOM processing progress
- `stream.enrichment.updates` - Component enrichment progress
- `stream.workflow.events` - Temporal workflow status events
- `stream.webhook.events` - External webhook delivery

**Verification:**
```bash
# Check job completion
kubectl get jobs -n app-plane
# Both should show COMPLETED

# Check migration logs
kubectl logs job/db-migration -n app-plane

# Check RabbitMQ streams
kubectl logs job/rabbitmq-stream-init -n app-plane
```

## Phase 4: Init Containers (Runtime Verification)

Each deployment has init containers that verify dependencies before the main container starts:

### CNS Service Init Container
```yaml
name: wait-for-schema
command: ["/bin/sh", "-c"]
args:
  - |
    until psql -c "SELECT 1 FROM bom_processing_jobs LIMIT 1" 2>/dev/null; do
      echo "Waiting for bom_processing_jobs table..."
      sleep 5
    done
    until psql -c "SELECT 1 FROM component_catalog LIMIT 1" 2>/dev/null; do
      echo "Waiting for component_catalog table..."
      sleep 5
    done
    echo "Database schemas ready!"
```

### CNS Worker Init Container
```yaml
name: wait-for-dependencies
command: ["/bin/sh", "-c"]
args:
  - |
    # Wait for CNS Service
    until curl -sf http://cns-service:27200/health > /dev/null; do
      echo "Waiting for CNS Service..."
      sleep 5
    done
    # Wait for database schemas
    until psql -c "SELECT 1 FROM bom_processing_jobs LIMIT 1"; do
      echo "Waiting for bom_processing_jobs..."
      sleep 5
    done
    echo "All dependencies ready!"
```

## Phase 5: Application Deployments

These start AFTER migrations complete successfully:

| Order | Deployment | Depends On | Purpose |
|-------|------------|------------|---------|
| 5.1 | cns-service | db_migration, rabbitmq_stream_init | CNS API server |
| 5.2 | cns-worker | cns-service, db_migration, rabbitmq_stream_init | BOM processing workers |
| 5.3 | cns-dashboard | cns-service | React Admin dashboard |
| 5.4 | customer-portal | cns-service | Customer Business Portal |

**Verification:**
```bash
kubectl get deployments -n app-plane
# All should show AVAILABLE

# Check CNS Service health
curl http://localhost:27200/health

# Check logs for errors
kubectl logs deployment/cns-service -n app-plane --tail=50
kubectl logs deployment/cns-worker -n app-plane --tail=50
```

## Terraform Dependency Graph

The Terraform configuration ensures proper ordering through `depends_on`:

```hcl
# CNS Service waits for migrations
resource "kubernetes_deployment" "cns_service" {
  depends_on = [
    kubernetes_stateful_set.supabase_db,
    kubernetes_stateful_set.components_db,
    kubernetes_stateful_set.redis,
    kubernetes_stateful_set.rabbitmq,
    kubernetes_job.db_migration,
    kubernetes_job.rabbitmq_stream_init
  ]
}

# CNS Worker waits for CNS Service and migrations
resource "kubernetes_deployment" "cns_worker" {
  depends_on = [
    kubernetes_stateful_set.supabase_db,
    kubernetes_stateful_set.components_db,
    kubernetes_stateful_set.redis,
    kubernetes_stateful_set.rabbitmq,
    kubernetes_deployment.cns_service,
    kubernetes_job.db_migration,
    kubernetes_job.rabbitmq_stream_init
  ]
}
```

## Troubleshooting

### Migration Job Fails
```bash
# Check job status
kubectl describe job/db-migration -n app-plane

# Check logs
kubectl logs job/db-migration -n app-plane

# Re-run migrations manually
cd database
./scripts/apply-all-migrations.sh
```

### Init Container Stuck
```bash
# Check init container status
kubectl get pods -n app-plane -o wide
kubectl describe pod <pod-name> -n app-plane

# Check init container logs
kubectl logs <pod-name> -c wait-for-schema -n app-plane
```

### Deployment Fails to Start
```bash
# Check events
kubectl get events -n app-plane --sort-by='.lastTimestamp'

# Check pod logs
kubectl logs deployment/<deployment-name> -n app-plane --previous
```

### RabbitMQ Streams Missing
```bash
# Check streams via management API
curl -u guest:guest http://localhost:27673/api/queues

# Manually create streams
cd database/rabbitmq
./init-streams.sh localhost guest guest
```

## Clean Deployment Checklist

For a fresh deployment, ensure:

- [ ] All StatefulSets are running (Phase 1)
- [ ] db_migration job completed successfully (Phase 3.1)
- [ ] rabbitmq_stream_init job completed successfully (Phase 3.2)
- [ ] Init containers pass in all deployments (Phase 4)
- [ ] All deployments show AVAILABLE (Phase 5)
- [ ] Health endpoints return 200 OK
- [ ] RabbitMQ streams exist (check via management UI)
- [ ] Database tables exist (verify with psql)

## Files Reference

| File | Purpose |
|------|---------|
| `database/migrations/*.sql` | SQL migration files |
| `database/scripts/apply-all-migrations.sh` | Migration runner script |
| `database/rabbitmq/init-streams.sh` | RabbitMQ initialization script |
| `infrastructure/terraform/modules/app-plane/kubernetes/main.tf` | Kubernetes resources with dependencies |
| `database/README.md` | Database documentation |

## Migration Order Table

| # | File | Target Database | Schema |
|---|------|-----------------|--------|
| 001 | SUPABASE_MASTER.sql | supabase-db | postgres |
| 002 | COMPONENTS_V2_MASTER.sql | components-db | components_v2 |
| 003 | ARC_SAAS_MASTER.sql | control-plane | arc_saas |
| 005 | DIRECTUS_ENRICHMENT_TABLES.sql | components-db | components_v2 |
| 006 | DIRECTUS_CNS_ENRICHMENT_CONFIG.sql | control-plane | ananta |
| 007 | component_catalog_table.sql | components-db | components_v2 |
| 008 | column_mapping_templates.sql | supabase-db | postgres |

Note: Migration 004 is deprecated and skipped (overlaps with 003).
