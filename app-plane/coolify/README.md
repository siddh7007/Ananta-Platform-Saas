# Coolify Deployment Guide - Ananta Platform SaaS

## Overview

Deploy the complete Ananta Platform to [Coolify](https://coolify.io/), a self-hosted PaaS.

## Deployment Options

| File | Services | Use Case |
|------|----------|----------|
| `docker-compose.app-plane.yml` | 16 | App Plane only (CNS, Django, Supabase) |
| `docker-compose.control-plane.yml` | 20 | Control Plane only (Tenant mgmt, Keycloak, Novu) |
| `docker-compose.full-platform.yml` | 36 | Complete platform (recommended) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COOLIFY SERVER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         SHARED SERVICES                                  ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  ││
│  │  │   Keycloak   │  │   Temporal   │  │    Jaeger    │                  ││
│  │  │   (Auth)     │  │  (Workflows) │  │  (Tracing)   │                  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌────────────────────────────┐  ┌────────────────────────────────────────┐ │
│  │      CONTROL PLANE         │  │            APP PLANE                   │ │
│  │                            │  │                                        │ │
│  │  ┌────────────────────┐   │  │  ┌────────────────────┐               │ │
│  │  │ tenant-management  │   │  │  │    cns-service     │               │ │
│  │  │     service        │   │  │  │     (FastAPI)      │               │ │
│  │  └────────────────────┘   │  │  └────────────────────┘               │ │
│  │  ┌────────────────────┐   │  │  ┌────────────────────┐               │ │
│  │  │  temporal-worker   │   │  │  │   django-backend   │               │ │
│  │  │     service        │   │  │  │                    │               │ │
│  │  └────────────────────┘   │  │  └────────────────────┘               │ │
│  │  ┌────────────────────┐   │  │  ┌────────────────────┐               │ │
│  │  │    Novu (5 svc)    │   │  │  │   cns-worker       │               │ │
│  │  │  (Notifications)   │   │  │  │                    │               │ │
│  │  └────────────────────┘   │  │  └────────────────────┘               │ │
│  │                            │  │                                        │ │
│  │  ┌────────────────────┐   │  │  ┌────────────────────┐               │ │
│  │  │   PostgreSQL       │   │  │  │ Supabase (3 svc)   │               │ │
│  │  │   + Redis          │   │  │  │ + Components V2 DB │               │ │
│  │  │   + MinIO          │   │  │  │ + Redis + RabbitMQ │               │ │
│  │  └────────────────────┘   │  │  │ + MinIO            │               │ │
│  │                            │  │  └────────────────────┘               │ │
│  │  FRONTENDS:               │  │  FRONTENDS:                            │ │
│  │  • admin-app              │  │  • cns-dashboard                       │ │
│  │  • customer-portal        │  │  • backstage-portal                    │ │
│  └────────────────────────────┘  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Count Summary

### Control Plane (20 services)
| Category | Services |
|----------|----------|
| Core Infra | postgres, redis, keycloak |
| Novu | mongodb, redis, api, ws, worker, web |
| Storage | minio, minio-init |
| Observability | jaeger |
| Temporal | postgresql, server, ui |
| Backend | tenant-management, temporal-worker |
| Frontend | admin-app, customer-portal |

### App Plane (16 services)
| Category | Services |
|----------|----------|
| Databases | supabase-db, components-v2-postgres |
| Infra | redis, rabbitmq, minio, minio-init |
| Supabase | api, meta, studio |
| Backend | cns-service, cns-worker, django-backend |
| Frontend | cns-dashboard, customer-portal, backstage-portal |

## Quick Start

### 1. Install Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

### 2. Access Coolify Dashboard

Navigate to `http://your-server-ip:8000`

### 3. Create Project

1. Click **"Add New Resource"** → **"Docker Compose"**
2. Upload or link your compose file
3. Choose: `docker-compose.full-platform.yml`

### 4. Configure Environment Variables

Copy from `.env.full-platform.example` and update all `CHANGE_ME_*` values.

**Generate secure secrets:**
```bash
# 64-char hex (for JWT, API tokens)
openssl rand -hex 32

# 32-char base64 (for Supabase JWT)
openssl rand -base64 32

# Django secret
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 5. Configure Domains

Map these in Coolify UI:

| Service | Suggested Domain |
|---------|-----------------|
| keycloak | auth.yourdomain.com |
| tenant-management-service | api.yourdomain.com |
| admin-app | admin.yourdomain.com |
| customer-portal | app.yourdomain.com |
| cns-service | cns-api.yourdomain.com |
| cns-dashboard | cns.yourdomain.com |
| backstage-portal | backstage.yourdomain.com |
| supabase-studio | db.yourdomain.com |
| temporal-ui | temporal.yourdomain.com |
| novu-web | novu.yourdomain.com |
| jaeger | jaeger.yourdomain.com |

### 6. Deploy

Click **Deploy** in Coolify.

## Server Requirements

| Deployment | RAM | CPU | Storage |
|------------|-----|-----|---------|
| App Plane only | 4GB | 2 cores | 40GB |
| Control Plane only | 4GB | 2 cores | 40GB |
| Full Platform | 8GB+ | 4 cores | 80GB+ |

## Post-Deployment

### Database Migrations

```bash
# SSH into Coolify server

# Supabase
docker exec -i <supabase-db> psql -U postgres -d postgres \
  < /path/to/migrations/001_SUPABASE_MASTER.sql

# Components V2
docker exec -i <components-v2-postgres> psql -U postgres -d components_v2 \
  < /path/to/migrations/002_COMPONENTS_V2_MASTER.sql

# Keycloak realm import
docker exec <keycloak> /opt/keycloak/bin/kc.sh import \
  --file /path/to/realm-export.json
```

### Verify Services

```bash
# Check all containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check logs
docker logs <service-name> --tail 100

# Health checks
curl https://api.yourdomain.com/ping
curl https://cns-api.yourdomain.com/health
```

## File Structure

```
coolify/
├── docker-compose.app-plane.yml       # App Plane services
├── docker-compose.control-plane.yml   # Control Plane services
├── docker-compose.full-platform.yml   # Complete platform
├── .env.coolify.example               # App Plane env template
├── .env.full-platform.example         # Full platform env template
└── README.md                          # This file
```

## Scaling

### Horizontal Scaling (Workers)

```yaml
cns-worker:
  deploy:
    replicas: 3
```

### Resource Limits

```yaml
cns-service:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '0.5'
        memory: 512M
```

## Backup Strategy

### Databases

```bash
# Control Plane DB
docker exec control-plane-postgres pg_dump -U postgres arc_saas > backup_control.sql

# Supabase
docker exec supabase-db pg_dump -U postgres postgres > backup_supabase.sql

# Components V2
docker exec components-v2-postgres pg_dump -U postgres components_v2 > backup_components.sql
```

### Volumes

Configure Coolify automatic backups in Settings → Backups.

## Troubleshooting

### Service Won't Start

```bash
docker logs <container-name> --tail 200
```

### Database Connection Issues

1. Verify environment variables
2. Check container health: `docker inspect <db-container>`
3. Test connectivity: `docker exec <service> nc -zv <db-host> 5432`

### Keycloak Issues

1. Wait for full startup (60-90 seconds)
2. Check realm exists: `https://auth.yourdomain.com/realms/ananta-saas`
3. Verify client configurations

### SSL/Certificate Issues

- Coolify auto-provisions Let's Encrypt
- Ensure DNS A records point to server IP
- Check ports 80/443 are open

## Security Checklist

- [ ] Changed ALL default passwords
- [ ] Generated unique secrets for each service
- [ ] Enabled Coolify 2FA
- [ ] Configured server firewall
- [ ] Set up SSH key authentication
- [ ] Disabled password SSH login
- [ ] Enabled automatic security updates
- [ ] Configured backup retention
- [ ] Set up monitoring alerts
- [ ] Reviewed Keycloak security settings

## Support

- [Coolify Documentation](https://coolify.io/docs)
- [Coolify Discord](https://discord.gg/coolify)
- [GitHub Issues](https://github.com/coollabsio/coolify/issues)
