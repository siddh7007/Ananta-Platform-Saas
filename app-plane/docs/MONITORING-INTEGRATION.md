# App Plane Monitoring Integration Guide

## Current Monitoring Capabilities

### Arc-SaaS (Control Plane) - What's Available

| Component | Status | Details |
|-----------|--------|---------|
| **OpenTelemetry** | Enabled | Jaeger tracing (port 16686) |
| **Prometheus Exporters** | Partial | Exporters exist in temporal-worker, no scraper |
| **Health Endpoints** | Implemented | `/health`, `/health/live`, `/health/ready` |
| **Docker Healthchecks** | Implemented | All infra services |
| **Jaeger UI** | Enabled | http://localhost:16686 |
| **Temporal UI** | Enabled | http://localhost:27021 |

### App Plane - What's Available

| Component | Status | Details |
|-----------|--------|---------|
| **CNS Health Endpoints** | Implemented | `/health/config`, `/health/config/dual-db` |
| **Traefik Health Routes** | Implemented | `/cns-health/*` (bypasses rate limiting) |
| **Docker Healthchecks** | Implemented | All services including CNS |
| **Smoke Tests** | Implemented | `tests/integration/test_health_endpoints_smoke.py` |

---

## Health Endpoint Reference

### CNS Service Health Endpoints

```bash
# Direct access (from host)
curl http://localhost:27200/health/config | jq .
curl http://localhost:27200/health/config/dual-db | jq .

# Via Traefik (for monitoring systems)
curl http://localhost:27500/cns-health/config | jq .
curl http://localhost:27500/cns-health/config/dual-db | jq .

# From Docker network (service-to-service)
curl http://cns-service:8000/health/config
```

### Response Examples

**GET /health/config**
```json
{
  "status": "healthy",
  "database_urls": {
    "DATABASE_URL": "postgresql://postgres:****@components-v2-postgres:5432/components_v2",
    "SUPABASE_DATABASE_URL": "postgresql://postgres:****@supabase-db:5432/postgres",
    "COMPONENTS_V2_DATABASE_URL": "postgresql://postgres:****@components-v2-postgres:5432/components_v2"
  },
  "dual_database_configured": true,
  "warnings": [],
  "errors": [],
  "config_summary": {
    "database": "configured",
    "dual_database": {
      "supabase": "configured",
      "components_v2": "configured"
    }
  },
  "validation_passed": true
}
```

**GET /health/config/dual-db**
```json
{
  "status": "healthy",
  "supabase": {
    "status": "healthy",
    "url_set": true,
    "connected": true,
    "latency_ms": 2.45
  },
  "components_v2": {
    "status": "healthy",
    "url_set": true,
    "connected": true,
    "latency_ms": 1.89
  },
  "routing_valid": true,
  "warnings": []
}
```

---

## Adding Prometheus + Grafana (Optional)

### Option 1: Add to Shared Infrastructure

Create `shared-monitoring/docker-compose.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: shared-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'
    networks:
      - arc-saas
      - app-plane
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.2.0
    container_name: shared-grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin123
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    networks:
      - arc-saas
      - app-plane
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:

networks:
  arc-saas:
    external: true
  app-plane:
    external: true
```

### Prometheus Configuration

Create `shared-monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Control Plane Health
  - job_name: 'arc-saas-tenant-mgmt'
    static_configs:
      - targets: ['tenant-management-service:14000']
    metrics_path: /health
    scrape_interval: 30s

  # App Plane - CNS Service Health
  - job_name: 'app-plane-cns'
    static_configs:
      - targets: ['cns-service:8000']
    metrics_path: /health/config
    scrape_interval: 30s

  # App Plane - CNS Dual Database
  - job_name: 'app-plane-cns-dual-db'
    static_configs:
      - targets: ['cns-service:8000']
    metrics_path: /health/config/dual-db
    scrape_interval: 60s

  # Infrastructure Health
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']  # Prometheus plugin port
```

### Option 2: Use Existing Jaeger + Add Blackbox Exporter

If you want to keep the stack simple, add just a blackbox exporter for endpoint probing:

```yaml
  blackbox-exporter:
    image: prom/blackbox-exporter:v0.24.0
    container_name: shared-blackbox
    ports:
      - "9115:9115"
    volumes:
      - ./blackbox.yml:/etc/blackbox_exporter/config.yml
    networks:
      - arc-saas
      - app-plane
    restart: unless-stopped
```

With `blackbox.yml`:
```yaml
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200]
      method: GET
      follow_redirects: true
```

---

## CI Pipeline Integration

### GitHub Actions - Health Check Job

Add to `.github/workflows/main.yaml`:

```yaml
  health-smoke-tests:
    runs-on: ubuntu-latest
    needs: [build]
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: components_v2
        ports:
          - 5432:5432
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd app-plane/services/cns-service
          pip install -r requirements.txt
          pip install pytest httpx

      - name: Run health endpoint smoke tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/components_v2
          SUPABASE_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          COMPONENTS_V2_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/components_v2
        run: |
          cd app-plane/services/cns-service
          pytest tests/integration/test_health_endpoints_smoke.py -v --tb=short
```

### Local CI Testing

```bash
# Run smoke tests locally
cd app-plane/services/cns-service
pytest tests/integration/test_health_endpoints_smoke.py -v

# Run with coverage
pytest tests/integration/test_health_endpoints_smoke.py -v --cov=app.api.health
```

---

## Alerting Examples (AlertManager)

If you add AlertManager, here are example rules for CNS health:

```yaml
groups:
  - name: cns-service
    rules:
      - alert: CNSServiceDown
        expr: up{job="app-plane-cns"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CNS Service is down"
          description: "CNS Service has been unreachable for more than 1 minute"

      - alert: CNSDualDatabasePartial
        expr: cns_dual_db_status{status="partial"} == 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CNS Dual Database partially degraded"
          description: "One of the dual databases is not responding"

      - alert: CNSDualDatabaseUnhealthy
        expr: cns_dual_db_status{status="unhealthy"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CNS Dual Database routing broken"
          description: "Both databases are unreachable or misconfigured"

      - alert: CNSHighLatency
        expr: cns_db_latency_ms > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CNS database latency high"
          description: "Database latency exceeds 500ms"
```

---

## Quick Reference

### Health Check URLs

| Service | Endpoint | Purpose |
|---------|----------|---------|
| CNS Direct | http://localhost:27200/health/config | Full config diagnostics |
| CNS Direct | http://localhost:27200/health/config/dual-db | Dual-DB connectivity |
| CNS Traefik | http://localhost:27500/cns-health/config | Via reverse proxy |
| Control Plane | http://localhost:14000/health | Full health status |
| Control Plane | http://localhost:14000/health/live | Liveness probe |
| Control Plane | http://localhost:14000/health/ready | Readiness probe |

### Docker Healthcheck Status

```bash
# Check all container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check specific service
docker inspect --format='{{.State.Health.Status}}' app-plane-cns-service
```

### Debugging Health Issues

```bash
# CNS config issues
curl -s http://localhost:27200/health/config | jq '.warnings, .errors'

# Dual-database connectivity
curl -s http://localhost:27200/health/config/dual-db | jq '.supabase.status, .components_v2.status'

# View CNS logs
docker logs app-plane-cns-service --tail 100 | grep -i "dual-db\|config\|error"
```

---

## Summary

**Current State:**
- Health endpoints implemented and exposed via Traefik
- Docker healthchecks configured for CNS service
- Smoke tests available for CI integration
- OpenTelemetry/Jaeger tracing available from Control Plane

**To Add Full Observability:**
1. Add Prometheus server (scrape health endpoints)
2. Add Grafana (visualize metrics/dashboards)
3. Add AlertManager (alert on failures)
4. Integrate smoke tests into CI pipeline

**Minimal Addition (Recommended):**
- Just add the GitHub Actions health-smoke-tests job
- Use existing Docker healthchecks for container orchestration
- Use Jaeger UI for distributed tracing
