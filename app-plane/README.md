# Ananta App Plane - Components Platform

This is the App Plane for Ananta SaaS, providing BOM and Component Management functionality. It integrates with the ARC SaaS Control Plane via secure webhooks.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTROL PLANE (ARC SaaS)                             │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Tenant Mgmt Svc  │  │ Temporal Worker  │  │  Admin Portal    │          │
│  │     :14000       │  │                  │  │     :3000        │          │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘          │
│           │                     │                                           │
└───────────┼─────────────────────┼───────────────────────────────────────────┘
            │                     │
            │ REST API            │ Webhook (tenant.provisioned)
            │                     ▼
┌───────────┼─────────────────────────────────────────────────────────────────┐
│           │              APP PLANE (Components Platform)                     │
│           │                                                                  │
│  ┌────────▼─────────┐                                                       │
│  │  Webhook Bridge  │ ◄─── Receives provisioning events                     │
│  │     :27600       │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                     Supabase (PostgreSQL + RLS)               │          │
│  │                          :27432/:27810                        │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Django Backend │  │   CNS Service   │  │ Customer Portal │            │
│  │     :27000      │  │     :27200      │  │     :27100      │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ Middleware API  │  │    Dashboard    │  │  Audit Logger   │            │
│  │     :27300      │  │     :27400      │  │   (consumer)    │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Control Plane ↔ App Plane Integration

### Webhook Events (Control Plane → App Plane)

These webhooks are triggered by the Temporal worker after provisioning actions:

| Event | Endpoint | Payload | Action |
|-------|----------|---------|--------|
| `tenant.provisioned` | `POST /webhooks/tenant-provisioned` | `{tenantId, tenantKey, tenantName, planId, adminUser, limits}` | Create organization, admin user, default project |
| `subscription.changed` | `POST /webhooks/subscription-changed` | `{tenantId, oldPlanId, newPlanId, newLimits}` | Update organization limits |
| `user.invited` | `POST /webhooks/user-invited` | `{tenantId, userEmail, role}` | Create user in App Plane |
| `tenant.deprovisioned` | `POST /webhooks/tenant-deprovisioned` | `{tenantId, reason}` | Archive/delete tenant data |

### Webhook Security

All webhooks are signed using HMAC-SHA256:
- Header: `X-Webhook-Signature: sha256=<hex-signature>`
- Computed from: `HMAC(payload, APP_PLANE_WEBHOOK_SECRET)`

## Services

| Service | Tech | Port | Description |
|---------|------|------|-------------|
| `webhook-bridge` | Flask/Python | 27600 | Receives Control Plane webhooks |
| `supabase-db` | PostgreSQL 15 | 27432 | Tenant business data (with RLS) |
| `supabase-api` | PostgREST | 27810 | REST API for database |
| `supabase-studio` | React | 27800 | Database admin UI |
| `django-backend` | Django 4.2 | 27000 | Core REST API |
| `customer-portal` | React Admin | 27100 | Customer-facing UI |
| `cns-service` | FastAPI | 27200 | Component normalization (AI) |
| `middleware-api` | Flask | 27300 | Service orchestration |
| `dashboard` | Next.js | 27400 | Analytics dashboard |
| `audit-logger` | Python | - | RabbitMQ consumer |
| `novu-consumer` | Python | - | Notification processing |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Control Plane running (arc-saas docker-compose up)

### Start App Plane

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Edit .env with your configuration
# Important: Set APP_PLANE_WEBHOOK_SECRET to match Control Plane

# 3. Start services
docker-compose up -d

# 4. Verify webhook bridge is healthy
curl http://localhost:27600/health
```

### Using the Unified Script

From the project root:
```bash
# Start everything (Control Plane + App Plane)
./start-platform.sh

# Start only App Plane
./start-platform.sh app

# View logs
./start-platform.sh logs

# Stop all
./start-platform.sh stop
```

## Environment Variables

See [.env.example](.env.example) for full configuration.

Key variables:
```bash
# Required - must match Control Plane
APP_PLANE_WEBHOOK_SECRET=your-webhook-secret

# Database
SUPABASE_DB_PASSWORD=postgres
SUPABASE_JWT_SECRET=your-jwt-secret

# Control Plane (for App Plane → Control Plane calls)
CONTROL_PLANE_URL=http://localhost:14000
```

## Database Schema

The App Plane uses Supabase (PostgreSQL) with Row Level Security:

- `organizations` - Maps to Control Plane tenants
- `users` - Organization members
- `projects` - Workspaces within organization
- `components` - BOM items (parts/components)
- `boms` - Bill of Materials
- `bom_items` - Components in a BOM
- `analyses` - Component/BOM analysis results
- `activity_logs` - Audit trail

See [supabase/init/01-init-schema.sql](supabase/init/01-init-schema.sql) for full schema.

## Provisioning Flow

1. User signs up via Control Plane admin portal
2. Lead → Tenant conversion triggers Temporal workflow
3. Workflow provisions: IdP, DB schema, storage, billing
4. **Step 11**: Workflow calls `notifyTenantProvisioned()` activity
5. Activity sends webhook to `webhook-bridge:27600`
6. Webhook Bridge creates organization, admin user, default project in App Plane DB
7. User receives welcome email with App Plane URL

## Reference

For implementation details, see:
- `../components-platform-v2-ref/` - Full reference implementation (git-ignored)
- `../ARCHITECTURE-DIAGRAMS.md` - Architecture documentation
- `../arc-saas/services/temporal-worker-service/src/activities/app-plane-webhook.activities.ts` - Webhook activity

## Port Summary

| Range | Purpose |
|-------|---------|
| 27000-27099 | Backend APIs |
| 27100-27199 | Frontend UIs |
| 27200-27299 | Specialized services |
| 27300-27399 | Middleware |
| 27400-27499 | Dashboards |
| 27600-27699 | Integration (webhooks) |
| 27800-27899 | Admin tools |
