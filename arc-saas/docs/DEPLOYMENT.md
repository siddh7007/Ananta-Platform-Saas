# ARC-SaaS Deployment Guide

> **Platform-Agnostic Deployment** - Docker Compose for development and self-hosted production

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Production Deployment](#production-deployment)
4. [Service Configuration](#service-configuration)
5. [Database Setup](#database-setup)
6. [Keycloak Configuration](#keycloak-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Multi-container orchestration |
| Node.js | 20+ | Build tools (optional) |
| Bun | 1.1+ | Faster build/install (optional) |

### System Requirements

| Environment | CPU | RAM | Storage |
|-------------|-----|-----|---------|
| Development | 4 cores | 8GB | 20GB |
| Production | 8+ cores | 16GB+ | 100GB+ SSD |

---

## Quick Start (Development)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd arc-saas
```

### 2. Start Infrastructure Services

```bash
# Start core infrastructure (Postgres, Redis, Keycloak, Temporal)
docker-compose up -d postgres redis keycloak temporal

# Wait for services to be healthy
docker-compose ps
```

### 3. Initialize Database

```bash
# Create required schemas
docker exec -e PGPASSWORD=postgres arc-saas-postgres psql -U postgres -d arc_saas -c "
CREATE SCHEMA IF NOT EXISTS main;
CREATE SCHEMA IF NOT EXISTS subscription;
"

# Run migrations
cd services/tenant-management-service
npm run migrate
```

### 4. Start Backend Services

```bash
# Option A: Docker Compose (recommended)
docker-compose up -d tenant-management-service

# Option B: Local development
cd services/tenant-management-service
npm run start:dev
```

### 5. Start Frontend

```bash
# Option A: Docker Compose
docker-compose up -d admin-app

# Option B: Local development
cd apps/admin-app
cp .env.example .env
npm run dev
```

### 6. Access Applications

| Application | URL | Default Credentials |
|-------------|-----|---------------------|
| Admin App | http://localhost:27555 | via Keycloak |
| Keycloak Admin | http://localhost:8180 | admin / admin |
| Temporal UI | http://localhost:27021 | N/A |
| API Health | http://localhost:14000/health | N/A |

---

## Production Deployment

### Environment Variables

Create `.env` files for each service:

#### Backend Service (.env)

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<secure-password>
DB_DATABASE=arc_saas

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# JWT
JWT_SECRET=<256-bit-secret>
JWT_ISSUER=arc-saas
JWT_EXPIRY=3600

# Keycloak
KEYCLOAK_HOST=keycloak
KEYCLOAK_PORT=8080
KEYCLOAK_REALM=ananta-saas
KEYCLOAK_CLIENT_ID=tenant-management
KEYCLOAK_CLIENT_SECRET=<client-secret>

# Temporal
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=arc-saas
TEMPORAL_TASK_QUEUE=tenant-provisioning

# Novu (Notifications)
NOVU_API_KEY=<novu-api-key>

# Stripe (Billing)
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<webhook-secret>
```

#### Frontend (.env)

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_KEYCLOAK_URL=https://auth.yourdomain.com
VITE_KEYCLOAK_REALM=ananta-saas
VITE_KEYCLOAK_CLIENT_ID=admin-app
VITE_GRAFANA_URL=https://grafana.yourdomain.com
VITE_FEATURE_BILLING=true
VITE_FEATURE_MONITORING=true
```

### Docker Compose Production Override

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  tenant-management-service:
    image: arc-saas/tenant-management-service:latest
    restart: always
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  admin-app:
    image: arc-saas/admin-app:latest
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M

  postgres:
    restart: always
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G

  redis:
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Deploy

```bash
# Build images
docker-compose build

# Deploy with production overrides
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Service Configuration

### Port Reference

| Service | Internal Port | External Port | Protocol |
|---------|---------------|---------------|----------|
| tenant-management-service | 3000 | 14000 | HTTP |
| admin-app | 80 | 27555 | HTTP |
| PostgreSQL | 5432 | 5432 | TCP |
| Redis | 6379 | 6379 | TCP |
| Keycloak | 8080 | 8180 | HTTP |
| Temporal | 7233 | 27020 | gRPC |
| Temporal UI | 8080 | 27021 | HTTP |

### Health Checks

```bash
# Backend API
curl http://localhost:14000/health

# Expected response:
# {"status":"up","checks":{"db":"up","redis":"up","temporal":"up"}}
```

---

## Database Setup

### Initial Schema

```sql
-- Create schemas
CREATE SCHEMA IF NOT EXISTS main;
CREATE SCHEMA IF NOT EXISTS subscription;

-- Create provisioning functions
CREATE OR REPLACE FUNCTION main.create_tenant_schema(tenant_key VARCHAR(50))
RETURNS VOID AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS tenant_%s', tenant_key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION main.drop_tenant_schema(tenant_key VARCHAR(50))
RETURNS VOID AS $$
BEGIN
  EXECUTE format('DROP SCHEMA IF EXISTS tenant_%s CASCADE', tenant_key);
END;
$$ LANGUAGE plpgsql;
```

### Run Migrations

```bash
cd services/tenant-management-service
npm run migrate
```

### Backup & Restore

```bash
# Backup
docker exec arc-saas-postgres pg_dump -U postgres arc_saas > backup.sql

# Restore
docker exec -i arc-saas-postgres psql -U postgres arc_saas < backup.sql
```

---

## Keycloak Configuration

### 1. Create Realm

1. Access Keycloak Admin: http://localhost:8180
2. Create new realm: `ananta-saas`

### 2. Create Clients

#### Admin App Client

| Setting | Value |
|---------|-------|
| Client ID | `admin-app` |
| Client Type | OpenID Connect |
| Client Authentication | OFF (public) |
| Standard Flow | ON |
| Valid Redirect URIs | `http://localhost:27555/*` |
| Web Origins | `http://localhost:27555` |

#### Backend Service Client

| Setting | Value |
|---------|-------|
| Client ID | `tenant-management` |
| Client Type | OpenID Connect |
| Client Authentication | ON (confidential) |
| Service Accounts | ON |

### 3. Create Roles

Create realm roles:
- `super_admin` (Level 5)
- `owner` (Level 4)
- `admin` (Level 3)
- `engineer` (Level 2)
- `analyst` (Level 1)

### 4. Create Admin User

1. Go to Users > Add user
2. Set username, email, first/last name
3. Under Credentials, set password
4. Under Role Mappings, assign `super_admin`

---

## Monitoring Setup

### Grafana (Optional)

```bash
# Start Grafana
docker run -d \
  --name grafana \
  -p 3001:3000 \
  -e GF_SECURITY_ALLOW_EMBEDDING=true \
  -e GF_AUTH_ANONYMOUS_ENABLED=true \
  grafana/grafana:latest
```

### Prometheus (Optional)

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'arc-saas-api'
    static_configs:
      - targets: ['tenant-management-service:3000']
    metrics_path: /metrics
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check PostgreSQL is running
docker logs arc-saas-postgres

# Verify connection
docker exec arc-saas-postgres pg_isready
```

#### Keycloak Not Accessible

```bash
# Check Keycloak logs
docker logs arc-saas-keycloak

# Verify realm exists
curl http://localhost:8180/realms/ananta-saas
```

#### Temporal Workflows Not Running

```bash
# Check Temporal is healthy
docker exec arc-saas-temporal temporal workflow list --namespace arc-saas

# Check worker logs
docker logs arc-saas-temporal-worker
```

#### Frontend Can't Connect to Backend

```bash
# Verify CORS settings
# Check .env has correct VITE_API_URL
# Verify backend is responding
curl http://localhost:14000/health
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f tenant-management-service

# View last 100 lines
docker-compose logs --tail=100 tenant-management-service
```

### Reset Everything

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Rebuild and start fresh
docker-compose up -d --build
```

---

## Security Checklist

- [ ] Change default passwords (PostgreSQL, Redis, Keycloak)
- [ ] Use HTTPS in production (configure reverse proxy)
- [ ] Set strong JWT secrets (256-bit minimum)
- [ ] Configure Keycloak SSL/TLS
- [ ] Enable Redis authentication
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Set up monitoring alerts

---

## Support

- **Documentation**: [docs/](./docs/)
- **Issues**: GitHub Issues
- **Architecture**: [CLAUDE.md](../CLAUDE.md)
