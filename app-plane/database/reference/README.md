# Database Schemas - Components Platform V2

**Generated**: December 10, 2025
**Source**: Live Docker containers via pg_dump/mongosh

---

## Init Scripts (For Fresh Deployments)

### Supabase Init (`../supabase/`)
| File | Lines | Tables | Purpose |
|------|-------|--------|---------|
| `init_full.sql` | 9,307 | 61 | Complete schema for fresh deploy |
| `init_public.sql` | 8,202 | 44 | Business tables only (orgs, BOMs, alerts, billing) |
| `init_auth.sql` | 1,075 | 17 | Supabase auth system |

### CNS Service Init (`../services/cns-service/`)
| File | Lines | Tables | Purpose |
|------|-------|--------|---------|
| `init_full.sql` | 7,551 | 93 | Complete schema for fresh deploy |
| `init_catalog.sql` | 962 | ~15 | Component catalog (categories, components, manufacturers) |
| `init_enrichment.sql` | 1,094 | ~12 | BOM enrichment pipeline (bom_*, enrichment_*, audit_*) |
| `init_directus.sql` | 1,646 | 28 | Directus CMS tables |
| `init_config.sql` | 1,751 | ~25 | Service config (cns_*, redis_*, supplier_*) |

### Temporal Init
| File | Lines | Purpose |
|------|-------|---------|
| `temporal_init.sql` | 801 | Reference only (Temporal-managed) |

---

## Raw Schema Exports (Reference)

| File | Database | Lines | Purpose |
|------|----------|-------|---------|
| `supabase_full_schema.sql` | Supabase PostgreSQL | 9,307 | Multi-tenant customer data (61 tables, RLS, Auth0) |
| `components_v2_schema.sql` | Components V2 PostgreSQL | 7,551 | Central component catalog (93 tables, 1200 categories) |
| `temporal_schema.sql` | Temporal PostgreSQL | 801 | Workflow orchestration state |
| `novu_collections.json` | Novu MongoDB | 22 collections | Notification workflows |

---

## Database Details

### 1. Supabase (Primary Customer Data)
**Container**: `components-v2-supabase-db`
**Port**: 27541
**Database**: `supabase`
**Credentials**: `postgres:supabase-postgres-secure-2024`

**Key Tables**:
- **Core**: `organizations`, `users`, `organization_memberships`, `workspaces`, `workspace_memberships`
- **BOM**: `boms`, `bom_line_items`, `bom_uploads`
- **Enrichment**: `enrichment_queue`, `enrichment_audit_log`, `enrichment_events`
- **Alerts**: `alerts`, `alert_preferences`, `alert_deliveries`, `component_watches`
- **Risk**: `organization_risk_profiles`, `component_base_risk_scores`, `bom_risk_summaries`
- **Billing**: `subscription_plans`, `billing_customers`, `subscriptions`, `invoices`, `payments`

**Features**:
- 60+ Row-Level Security (RLS) policies
- 100+ indexes
- 15+ functions/triggers
- Auth0 multi-tenancy integration

---

### 2. Components V2 (CNS Catalog)
**Container**: `components-v2-postgres`
**Port**: 27010
**Database**: `components_v2`
**Credentials**: `postgres:postgres`

**Key Tables**:
- `CatalogComponent` - Production-ready components (quality >= 95%)
- `EnrichmentQueue` - Staging for human review (quality 70-94%)
- `BOMJob` - Upload/enrichment job tracking
- `EnrichmentHistory` - Audit log

---

### 3. Temporal (Workflow State)
**Container**: `components-v2-temporal-postgres`
**Port**: 27030
**Database**: `temporal`
**Credentials**: `temporal:temporal_secure_2025_change_in_production`

**Purpose**: Durable workflow execution state for BOM enrichment pipelines.

---

### 4. Novu MongoDB (Notifications)
**Container**: `components-v2-novu-mongo`
**Port**: 27853
**Database**: `novu`
**Credentials**: `novu:novu_secret`

**Collections** (22 total):
- `notifications` - Notification records
- `subscribers` - User subscriptions
- `notificationtemplates` - Workflow templates
- `messages` - Delivered messages
- `jobs` - Async processing queue
- `integrations` - Channel integrations (email, in-app, webhook)
- `organizations`, `environments`, `users` - Multi-tenant structure
- `preferences`, `feeds`, `topics` - User preferences

---

## Archived Migrations

The `archived_migrations/` folder contains all 105 original SQL migration files from `supabase/migrations/`.

These are preserved for reference. The exported schemas represent the final applied state.

---

## Quick Reference

### Connection Strings

```bash
# Supabase
postgresql://postgres:supabase-postgres-secure-2024@localhost:27541/supabase

# Components V2
postgresql://postgres:postgres@localhost:27010/components_v2

# Temporal
postgresql://temporal:temporal_secure_2025_change_in_production@localhost:27030/temporal

# Novu MongoDB
mongodb://novu:novu_secret@localhost:27853/novu?authSource=admin
```

### Export Commands Used

```bash
# Supabase
docker exec components-v2-supabase-db pg_dump --schema-only --no-owner --no-privileges \
  -U postgres -d supabase > supabase_full_schema.sql

# Components V2
docker exec components-v2-postgres pg_dump --schema-only --no-owner --no-privileges \
  -U postgres -d components_v2 > components_v2_schema.sql

# Temporal
docker exec components-v2-temporal-postgres pg_dump --schema-only --no-owner --no-privileges \
  -U temporal -d temporal > temporal_schema.sql

# Novu MongoDB
docker exec components-v2-novu-mongo mongosh --username novu --password novu_secret \
  --authenticationDatabase admin novu --eval "JSON.stringify(db.getCollectionInfos(), null, 2)"
```

---

## Key Relationships

```
organizations
├── users (via organization_memberships)
├── workspaces
│   └── workspace_memberships
├── projects
│   └── boms
│       └── bom_line_items
│           ├── enrichment_queue
│           └── alerts
└── billing_customers
    └── subscriptions
```

---

## Fresh Deployment Usage

### Deploy Complete Supabase Schema
```bash
psql -U postgres -d supabase -f ../supabase/init_full.sql
```

### Deploy Complete CNS Service Schema
```bash
psql -U postgres -d components_v2 -f ../services/cns-service/init_full.sql
```

### Deploy Selective (e.g., catalog only)
```bash
psql -U postgres -d components_v2 -f ../services/cns-service/init_catalog.sql
```

---

## Notes

- **Redis**: No schema (key-value cache, port 27012)
- **RabbitMQ**: Configuration-only (exchanges/queues defined in code)
- **MinIO**: Bucket names only (`cns-audit-trail`, `bulk-uploads`)
